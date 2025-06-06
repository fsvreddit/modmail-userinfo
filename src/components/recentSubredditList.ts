import { Comment, SettingsFormField, SettingsValues, TriggerContext } from "@devvit/public-api";
import { addDays } from "date-fns";
import { numericFieldBetween } from "../settingsHelpers.js";
import _ from "lodash";
import json2md from "json2md";

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
    const redisKey = `subredditVisibilityCheck-${subredditName}`;
    const cachedValue = await context.redis.get(redisKey);
    if (cachedValue) {
        return cachedValue === "true";
    }

    let isVisible = true;
    try {
        const subreddit = await context.reddit.getSubredditInfoByName(subredditName);
        const subredditType = subreddit.type?.toLowerCase();
        isVisible = subredditType === "public" || subredditType === "restricted" || subredditType === "archived";

        // Cache the value for a week, unlikely to change that often.
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

export async function getRecentSubreddits (recentComments: Comment[], settings: SettingsValues, context: TriggerContext): Promise<json2md.DataObject[] | undefined> {
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
    const filteredSubCommentCounts: SubCommentCount[] = [];

    const subredditName = await context.reddit.getCurrentSubredditName();
    if (numberOfSubsToReportOn > 0) {
        for (const subCommentItem of subCommentCounts.sort((a, b) => b.commentCount - a.commentCount)) {
            // Deliberately doing call within loop so that we can limit the number of calls made.
            const isSubVisible = await getSubredditVisibility(context, subCommentItem.subName);
            if (isSubVisible || subCommentItem.subName === subredditName) {
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

    const [subHistoryDisplayStyle] = settings[RecentSubredditSetting.SubHistoryDisplayStyle] as SubHistoryDisplayStyleOption[] | undefined ?? [SubHistoryDisplayStyleOption.SingleParagraph];
    const result: json2md.DataObject[] = [];

    if (subHistoryDisplayStyle === SubHistoryDisplayStyleOption.Bullet) {
        result.push({ p: "**Recent comments across Reddit**" });
        result.push({ ul: filteredSubCommentCounts.map(item => `/r/${item.subName}: ${item.commentCount}`) });
    } else {
        result.push({ p: `**Recent comments across Reddit**: ${filteredSubCommentCounts.map(item => `/r/${item.subName} (${item.commentCount})`).join(", ")}` });
    }

    return result;
}
