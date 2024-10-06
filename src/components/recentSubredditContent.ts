import { Comment, SettingsFormField, SettingsValues, TriggerContext } from "@devvit/public-api";
import { getSubredditName } from "../utility.js";
import { differenceInDays, subDays } from "date-fns";
import pluralize from "pluralize";

enum RecentSubredditCommentSetting {
    EnableCommentCount = "enableRecentSubredditComments",
    EnablePostCount = "enableRecentSubredditPosts",
    NumberOfDays = "recentSubredditCommentsDays",
}

export const settingsForRecentSubredditComments: SettingsFormField = {
    type: "group",
    label: "Recent content count for your subreddit",
    fields: [
        {
            name: RecentSubredditCommentSetting.EnableCommentCount,
            type: "boolean",
            label: "Enable output of recent subreddit comment counts",
            defaultValue: false,
        },
        {
            name: RecentSubredditCommentSetting.EnablePostCount,
            type: "boolean",
            label: "Enable output of recent subreddit post counts",
            defaultValue: false,
        },
        {
            name: RecentSubredditCommentSetting.NumberOfDays,
            type: "number",
            label: "How many days to include data for",
            helpText: "Note: This app can only look back on the user's most recent 1000 posts or comments.",
            defaultValue: 28,
        },
    ],
};

export async function getRecentSubredditCommentCount (userComments: Comment[], settings: SettingsValues, context: TriggerContext): Promise<string | undefined> {
    if (!settings[RecentSubredditCommentSetting.EnableCommentCount]) {
        return;
    }

    const numberOfDays = settings[RecentSubredditCommentSetting.NumberOfDays] as number | undefined;
    if (!numberOfDays) {
        return;
    }

    const allComments = [...userComments];

    const lastComment = allComments[userComments.length - 1];
    if (allComments.length > 0 && lastComment.createdAt > subDays(new Date(), numberOfDays)) {
        // Get more.
        const timeframe = numberOfDays < 31 ? "month" : undefined;
        const nextComments = await context.reddit.getCommentsByUser({
            username: userComments[0].authorName,
            after: userComments[userComments.length - 1].id,
            sort: "new",
            timeframe,
            limit: 1000 - allComments.length,
        }).all();

        allComments.push(...nextComments);
    }

    const subredditComments = userComments.filter(comment => comment.subredditId === context.subredditId && comment.createdAt > subDays(new Date(), numberOfDays));

    let actualNumberOfDays: number | undefined;
    if (userComments.length > 0) {
        const oldestComment = allComments[allComments.length - 1];
        actualNumberOfDays = oldestComment.createdAt < subDays(new Date(), numberOfDays) ? numberOfDays : differenceInDays(new Date(), oldestComment.createdAt);
    }

    const subredditName = await getSubredditName(context);
    let result = `**Recent comments on /r/${subredditName}**: ${subredditComments.length}`;

    if (actualNumberOfDays && actualNumberOfDays < numberOfDays) {
        result += ` in last ${actualNumberOfDays} ${pluralize("day", actualNumberOfDays)} (unable to look back further)`;
    } else {
        result += ` in last ${numberOfDays} ${pluralize("day", numberOfDays)}`;
    }

    return result;
}

export async function getRecentSubredditPostCount (username: string, settings: SettingsValues, context: TriggerContext): Promise<string | undefined> {
    if (!settings[RecentSubredditCommentSetting.EnableCommentCount]) {
        return;
    }

    const numberOfDays = settings[RecentSubredditCommentSetting.NumberOfDays] as number | undefined;
    if (!numberOfDays) {
        return;
    }

    const timeframe = numberOfDays < 31 ? "month" : undefined;
    const posts = await context.reddit.getPostsByUser({
        username,
        sort: "new",
        timeframe,
        limit: 1000,
    }).all();

    const subredditPosts = posts.filter(post => post.subredditId === context.subredditId && post.createdAt > subDays(new Date(), numberOfDays));

    let actualNumberOfDays: number | undefined;
    if (posts.length > 0) {
        const oldestPost = posts[posts.length - 1];
        actualNumberOfDays = oldestPost.createdAt < subDays(new Date(), numberOfDays) ? numberOfDays : differenceInDays(new Date(), oldestPost.createdAt);
    }

    const subredditName = await getSubredditName(context);
    let result = `**Recent posts on /r/${subredditName}**: ${subredditPosts.length}`;

    if (actualNumberOfDays && actualNumberOfDays < numberOfDays) {
        result += ` (recent history only covers ${actualNumberOfDays} ${pluralize("day", actualNumberOfDays)})`;
    } else {
        result += ` in last ${numberOfDays} ${pluralize("day", numberOfDays)}`;
    }

    return result;
}
