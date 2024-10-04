import { Comment, SettingsFormField, SettingsValues, TriggerContext } from "@devvit/public-api";
import { addDays } from "date-fns";
import _ from "lodash";
import { getSubredditName } from "../utility.js";
import { numericFieldBetween } from "../settingsHelpers.js";

enum RecentSubredditSetting {
    NumberOfSubsInSummary = "numberOfSubsToIncludeInSummary",
    NumberOfCommentsToCount = "numberOfCommentsForSubList",
    SubHistoryDisplayStyle = "subHistoryDisplayStyle",
}

enum SubHistoryDisplayStyleOption {
    Bullet = "bullet",
    SingleParagraph = "singlepara",
}

export const settingsForRecentSubreddits: SettingsFormField = {
    type: "group",
    label: "Recent activity across Reddit",
    fields: [
        {
            type: "number",
            name: RecentSubredditSetting.NumberOfSubsInSummary,
            label: "Number of subreddits to include in comment summary",
            helpText: "Limit the number of subreddits listed to this number. If a user participates in lots of subreddits, a large number might be distracting. Set to 0 to disable this output",
            defaultValue: 10,
            onValidate: ({ value }) => numericFieldBetween(value, 0, 100),
        },
        {
            type: "number",
            name: RecentSubredditSetting.NumberOfCommentsToCount,
            label: "Number of recent comments to count subreddits over",
            defaultValue: 100,
            onValidate: ({ value }) => numericFieldBetween(value, 0, 1000),
        },
        {
            type: "select",
            name: RecentSubredditSetting.SubHistoryDisplayStyle,
            label: "Output style for subreddit history",
            options: [
                { label: "Bulleted list (one subreddit per line)", value: SubHistoryDisplayStyleOption.Bullet },
                { label: "Single paragraph (all subreddits on one line - more compact)", value: SubHistoryDisplayStyleOption.SingleParagraph },
            ],
            defaultValue: [SubHistoryDisplayStyleOption.SingleParagraph],
            multiSelect: false,
        },
    ],
};

async function getSubredditVisibility (context: TriggerContext, subredditName: string): Promise<boolean> {
    if (subredditName.startsWith("u_")) {
        // Not a subreddit - comment on user profile
        return true;
    }

    // Check Redis cache for subreddit visibility.
    const redisKey = `subredditVisibility-${subredditName}`;
    const cachedValue = await context.redis.get(redisKey);
    if (cachedValue) {
        console.log(`Visibility for ${subredditName} already cached (${cachedValue})`);
        return cachedValue === "true";
    }

    let isVisible = true;
    try {
        const subreddit = await context.reddit.getSubredditByName(subredditName);
        isVisible = subreddit.type === "public" || subreddit.type === "restricted" || subreddit.type === "archived";

        // Cache the value for a week, unlikely to change that often.
        console.log(`Caching visibility for ${subredditName} (${JSON.stringify(isVisible)})`);
        await context.redis.set(redisKey, JSON.stringify(isVisible), { expiration: addDays(new Date(), 7) });
    } catch (error) {
        // Error retrieving subreddit. Subreddit is most likely to be public but gated due to controversial topics.
        console.log(`Could not retrieve information for /r/${subredditName}`);
        console.log(error);
    }

    return isVisible;
}

interface SubCommentCount {
    subName: string;
    commentCount: number;
}

export async function getRecentSubreddits (recentComments: Comment[], settings: SettingsValues, context: TriggerContext): Promise<string | undefined> {
    // Build up a list of subreddits and the count of comments in those subreddits

    const numberOfSubsToReportOn = settings[RecentSubredditSetting.NumberOfSubsInSummary] as number | undefined ?? 10;
    if (numberOfSubsToReportOn === 0) {
        return;
    }

    const numberOfCommentsToCheck = settings[RecentSubredditSetting.NumberOfCommentsToCount] as number | undefined ?? 100;
    if (numberOfCommentsToCheck === 0) {
        return;
    }

    const countedSubs = _.countBy(recentComments.slice(0, numberOfCommentsToCheck).map(x => x.subredditName));
    const subCommentCounts = _.toPairs(countedSubs).map(([subName, commentCount]) => ({ subName, commentCount } as SubCommentCount));

    // Filter comment list for subreddits for visibility. This is because we don't want to show counts for private subreddits
    // that this app might be installed in, but that an average person wouldn't necessarily know of. We want to protect users'
    // privacy somewhat so limit output to what a normal user would see.
    console.log(`Content found in ${subCommentCounts.length} subreddits. Need to return no more than ${numberOfSubsToReportOn}`);

    const filteredSubCommentCounts: SubCommentCount[] = [];

    const subredditName = await getSubredditName(context);
    if (numberOfSubsToReportOn > 0) {
        for (const subCommentItem of subCommentCounts.sort((a, b) => b.commentCount - a.commentCount)) {
            // Deliberately doing call within loop so that we can limit the number of calls made.
            const isSubVisible = await getSubredditVisibility(context, subCommentItem.subName);
            if (subCommentItem.subName === subredditName || isSubVisible) {
                filteredSubCommentCounts.push(subCommentItem);
            }

            // Stop checking more subs if we have enough entries.
            if (filteredSubCommentCounts.length >= numberOfSubsToReportOn) {
                break;
            }
        }
    }

    if (filteredSubCommentCounts.length === 0) {
        return;
    }

    const [subHistoryDisplayStyle] = settings[RecentSubredditSetting.SubHistoryDisplayStyle] as string[] | undefined ?? [SubHistoryDisplayStyleOption.SingleParagraph];
    let result = "**Recent comments across Reddit**: ";

    if (subHistoryDisplayStyle as SubHistoryDisplayStyleOption === SubHistoryDisplayStyleOption.Bullet) {
        result += "\n\n";
        result += filteredSubCommentCounts.map(item => `* /r/${item.subName}: ${item.commentCount}`).join("\n");
    } else {
        result += filteredSubCommentCounts.map(item => `/r/${item.subName} (${item.commentCount})`).join(", ");
    }

    return result;
}
