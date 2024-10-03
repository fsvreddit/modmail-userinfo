import { SettingsValues, TriggerContext } from "@devvit/public-api";
import { AppSetting, IncludeRecentContentOption } from "../settings.js";
import { getSubredditName } from "../utility.js";
import markdownEscape from "markdown-escape";

export async function getRecentPosts (username: string, settings: SettingsValues, context: TriggerContext): Promise<string> {
    const [includeRecentPosts] = settings[AppSetting.IncludeRecentPosts] as string[] | undefined ?? [IncludeRecentContentOption.None];
    const numberOfPostsToInclude = settings[AppSetting.NumberOfPostsToInclude] as number | undefined ?? 3;

    if (numberOfPostsToInclude === 0 || includeRecentPosts as IncludeRecentContentOption === IncludeRecentContentOption.None) {
        return "";
    }

    const modsToIgnoreRemovalsFromSetting = settings[AppSetting.ModsToIgnoreRemovalsFrom] as string | undefined ?? "";
    const modsToIgnoreRemovalsFrom = modsToIgnoreRemovalsFromSetting.split(",").map(x => x.trim().toLowerCase());

    const [locale] = settings[AppSetting.LocaleForDateOutput] as string[] | undefined ?? ["en-US"];
    const subredditName = await getSubredditName(context);

    let recentPosts = await context.reddit.getPostsByUser({
        username,
        sort: "new",
        limit: 100,
    }).all();

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    recentPosts = recentPosts.filter(post => post.subredditName === subredditName && (((post.removed || post.spam) && post.removedBy && !modsToIgnoreRemovalsFrom.includes(post.removedBy.toLowerCase())) || includeRecentPosts as IncludeRecentContentOption === IncludeRecentContentOption.VisibleAndRemoved)).slice(0, numberOfPostsToInclude);
    if (recentPosts.length === 0) {
        return "";
    }

    let result = `**Recent ${includeRecentPosts as IncludeRecentContentOption === IncludeRecentContentOption.Removed ? "removed " : ""} posts on ${subredditName}**\n\n`;
    for (const post of recentPosts) {
        result += `* [${markdownEscape(post.title)}](${post.permalink}) (${post.createdAt.toLocaleDateString(locale)})\n`;
    }
    result += "\n";

    return result;
}
