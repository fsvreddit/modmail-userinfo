import { SettingsFormField, SettingsValues, TriggerContext } from "@devvit/public-api";
import { GeneralSetting } from "../settings.js";
import { getSubredditName } from "../utility.js";
import markdownEscape from "markdown-escape";
import { IncludeRecentContentOption, selectFieldHasOptionChosen } from "../settingsHelpers.js";

enum RecentPostsSetting {
    IncludeRecentPosts = "includeRecentPosts",
    NumberOfPostsToInclude = "numberOfPostsToInclude",
    ModsToIgnoreRemovalsFrom = "modsToIgnoreRemovalsFrom",
}

export const settingsForRecentPosts: SettingsFormField = {
    type: "group",
    label: "Recent comment activity in your subreddit",
    fields: [
        {
            type: "select",
            name: RecentPostsSetting.IncludeRecentPosts,
            label: "Include recent posts in summary",
            options: [
                { label: "None", value: IncludeRecentContentOption.None },
                { label: "Visible and Removed posts", value: IncludeRecentContentOption.VisibleAndRemoved },
                { label: "Removed posts only", value: IncludeRecentContentOption.Removed },
            ],
            defaultValue: [IncludeRecentContentOption.None],
            multiSelect: false,
            onValidate: selectFieldHasOptionChosen,
        },
        {
            type: "string",
            name: RecentPostsSetting.ModsToIgnoreRemovalsFrom,
            label: "Moderators to ignore removals from if 'recent posts' option is 'Removed only'",
            helpText: "Comma separated, not case sensitive",
        },
        {
            type: "number",
            name: RecentPostsSetting.NumberOfPostsToInclude,
            label: "Number of recent posts to show in summary",
            defaultValue: 3,
        },
    ],
};

export async function getRecentPosts (username: string, settings: SettingsValues, context: TriggerContext): Promise<string | undefined> {
    const [includeRecentPosts] = settings[RecentPostsSetting.IncludeRecentPosts] as string[] | undefined ?? [IncludeRecentContentOption.None];
    const numberOfPostsToInclude = settings[RecentPostsSetting.NumberOfPostsToInclude] as number | undefined ?? 3;

    if (numberOfPostsToInclude === 0 || includeRecentPosts as IncludeRecentContentOption === IncludeRecentContentOption.None) {
        return;
    }

    const modsToIgnoreRemovalsFromSetting = settings[RecentPostsSetting.ModsToIgnoreRemovalsFrom] as string | undefined ?? "";
    const modsToIgnoreRemovalsFrom = modsToIgnoreRemovalsFromSetting.split(",").map(x => x.trim().toLowerCase());

    const [locale] = settings[GeneralSetting.LocaleForDateOutput] as string[] | undefined ?? ["en-US"];
    const subredditName = await getSubredditName(context);

    let recentPosts = await context.reddit.getPostsByUser({
        username,
        sort: "new",
        limit: 100,
    }).all();

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    recentPosts = recentPosts.filter(post => post.subredditName === subredditName && (((post.removed || post.spam) && post.removedBy && !modsToIgnoreRemovalsFrom.includes(post.removedBy.toLowerCase())) || includeRecentPosts as IncludeRecentContentOption === IncludeRecentContentOption.VisibleAndRemoved)).slice(0, numberOfPostsToInclude);
    if (recentPosts.length === 0) {
        return;
    }

    let result = `**Recent ${includeRecentPosts as IncludeRecentContentOption === IncludeRecentContentOption.Removed ? "removed " : ""} posts on ${subredditName}**\n\n`;
    for (const post of recentPosts) {
        result += `* [${markdownEscape(post.title)}](${post.permalink}) (${post.createdAt.toLocaleDateString(locale)})\n`;
    }
    result += "\n";

    return result;
}
