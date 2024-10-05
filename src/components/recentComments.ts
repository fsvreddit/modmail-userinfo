import { Comment, SettingsFormField, SettingsValues, TriggerContext } from "@devvit/public-api";
import { GeneralSetting } from "../settings.js";
import { getSubredditName } from "../utility.js";
import { IncludeRecentContentOption, numericFieldBetween, selectFieldHasOptionChosen } from "../settingsHelpers.js";

enum RecentCommentsSetting {
    IncludeRecentComments = "includeRecentComments",
    NumberOfCommentsToInclude = "numberOfCommentsToInclude",
}

export const settingsForRecentComments: SettingsFormField = {
    type: "group",
    label: "Recent comment activity in your subreddit",
    fields: [
        {
            type: "select",
            name: RecentCommentsSetting.IncludeRecentComments,
            label: "Include recent comments in summary",
            options: [
                { label: "None", value: IncludeRecentContentOption.None },
                { label: "Visible and Removed comments", value: IncludeRecentContentOption.VisibleAndRemoved },
                { label: "Removed comments only", value: IncludeRecentContentOption.Removed },
            ],
            defaultValue: [IncludeRecentContentOption.Removed],
            multiSelect: false,
            onValidate: selectFieldHasOptionChosen,
        },
        {
            type: "number",
            name: RecentCommentsSetting.NumberOfCommentsToInclude,
            label: "Number of recent comments to show in summary",
            defaultValue: 3,
            onValidate: ({ value }) => numericFieldBetween(value, 0, 10),
        },
    ],
};

export async function getRecentComments (recentComments: Comment[], settings: SettingsValues, context: TriggerContext): Promise<string | undefined> {
    const [includeRecentComments] = settings[RecentCommentsSetting.IncludeRecentComments] as string[] | undefined ?? [IncludeRecentContentOption.None];
    const numberOfRemovedCommentsToInclude = settings[RecentCommentsSetting.NumberOfCommentsToInclude] as number | undefined ?? 3;

    if (numberOfRemovedCommentsToInclude === 0 || includeRecentComments as IncludeRecentContentOption === IncludeRecentContentOption.None) {
        return;
    }

    const [locale] = settings[GeneralSetting.LocaleForDateOutput] as string[] | undefined ?? ["en-US"];
    const subredditName = await getSubredditName(context);

    const filteredComments = recentComments
        .filter(x => (includeRecentComments as IncludeRecentContentOption === IncludeRecentContentOption.VisibleAndRemoved || x.removed) && x.subredditName === subredditName)
        .slice(0, numberOfRemovedCommentsToInclude);

    if (filteredComments.length === 0) {
        return;
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
        result += `> ${comment.body.split("\n").join("\n> ")}`; // string.replaceAll not available without es2021
        result += "\n\n";
    }

    result += "---";

    return result;
}
