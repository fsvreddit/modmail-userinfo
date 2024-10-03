import { Comment, SettingsValues, TriggerContext } from "@devvit/public-api";
import { addDays } from "date-fns";
import { AppSetting, SubHistoryDisplayStyleOption } from "../settings.js";
import _ from "lodash";
import { getSubredditName } from "../utility.js";

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

export async function getRecentSubreddits (recentComments: Comment[], settings: SettingsValues, context: TriggerContext): Promise<string> {
    // Build up a list of subreddits and the count of comments in those subreddits

    const numberOfSubsToReportOn = settings[AppSetting.NumberOfSubsInSummary] as number | undefined ?? 10;
    if (numberOfSubsToReportOn === 0) {
        return "";
    }

    const countedSubs = _.countBy(recentComments.map(x => x.subredditName));
    const subCommentCounts = Object.keys(countedSubs).map(x => ({ subName: x, commentCount: countedSubs[x] } as SubCommentCount));

    // Filter comment list for subreddits for visibility. This is because we don't want to show counts for private subreddits
    // that this app might be installed in, but that an average person wouldn't necessarily know of. We want to protect users'
    // privacy somewhat so limit output to what a normal user would see.
    console.log(`Content found in ${subCommentCounts.length} subreddits. Need to return no more than ${numberOfSubsToReportOn}`);

    const filteredSubCommentCounts: SubCommentCount[] = [];

    if (numberOfSubsToReportOn > 0) {
        for (const subCommentItem of subCommentCounts.sort((a, b) => b.commentCount - a.commentCount)) {
            const subredditName = await getSubredditName(context);
            if (subCommentItem.subName === subredditName) {
                filteredSubCommentCounts.push(subCommentItem);
            } else {
                // Deliberately doing call within loop so that we can limit the number of calls made.
                const isSubVisible = await getSubredditVisibility(context, subCommentItem.subName);
                if (isSubVisible) {
                    filteredSubCommentCounts.push(subCommentItem);
                }
            }

            // Stop checking more subs if we have enough entries.
            if (filteredSubCommentCounts.length >= numberOfSubsToReportOn) {
                break;
            }
        }
    }

    if (filteredSubCommentCounts.length === 0) {
        return "";
    }

    const [subHistoryDisplayStyle] = settings[AppSetting.SubHistoryDisplayStyle] as string[] | undefined ?? [SubHistoryDisplayStyleOption.SingleParagraph];
    let result = "**Recent comments across Reddit**: ";

    if (subHistoryDisplayStyle as SubHistoryDisplayStyleOption === SubHistoryDisplayStyleOption.Bullet) {
        result += "\n\n";
        result += filteredSubCommentCounts.map(item => `* /r/${item.subName}: ${item.commentCount}`).join("\n");
    } else {
        result += filteredSubCommentCounts.map(item => `/r/${item.subName} (${item.commentCount})`).join(", ");
    }

    result += "\n\n";
    return result;
}
