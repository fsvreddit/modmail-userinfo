import { Comment, SettingsValues, TriggerContext } from "@devvit/public-api";
import { AppSetting, IncludeRecentContentOption } from "../settings.js";
import { getSubredditName } from "../utility.js";

export async function getRecentComments (recentComments: Comment[], settings: SettingsValues, context: TriggerContext): Promise<string> {
    const [includeRecentComments] = settings[AppSetting.IncludeRecentComments] as string[] | undefined ?? [IncludeRecentContentOption.None];
    const numberOfRemovedCommentsToInclude = settings[AppSetting.NumberOfCommentsToInclude] as number | undefined ?? 3;

    if (numberOfRemovedCommentsToInclude === 0 || includeRecentComments as IncludeRecentContentOption === IncludeRecentContentOption.None) {
        return "";
    }

    const [locale] = settings[AppSetting.LocaleForDateOutput] as string[] | undefined ?? ["en-US"];
    const subredditName = await getSubredditName(context);

    const filteredComments = recentComments
        .filter(x => (includeRecentComments as IncludeRecentContentOption === IncludeRecentContentOption.VisibleAndRemoved || x.removed) && x.subredditName === subredditName)
        .slice(0, numberOfRemovedCommentsToInclude);

    if (filteredComments.length === 0) {
        return "";
    }

    let result: string;

    if (includeRecentComments as IncludeRecentContentOption === IncludeRecentContentOption.VisibleAndRemoved) {
        result = `**Recent comments on ${subredditName}**:\n\n`;
    } else {
        result = `**Recently removed comments on ${subredditName}**:\n\n`;
    }

    for (const comment of filteredComments) {
        result += `[${comment.createdAt.toLocaleDateString(locale)}](${comment.permalink})`;
        if (includeRecentComments as IncludeRecentContentOption === IncludeRecentContentOption.VisibleAndRemoved && comment.removed) {
            result += " (removed)";
        }
        result += ":\n\n";
        result += `> ${comment.body.split("\n").join("\n> ")}\n\n`; // string.replaceAll not available without es2021
    }

    result += "---\n\n";

    return result;
}
