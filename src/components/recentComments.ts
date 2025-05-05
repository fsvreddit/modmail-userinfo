import { Comment, SettingsFormField, SettingsValues, TriggerContext } from "@devvit/public-api";
import { GeneralSetting } from "../settings.js";
import { IncludeRecentContentOption, numericFieldBetween, selectFieldHasOptionChosen } from "../settingsHelpers.js";
import json2md from "json2md";

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

export async function getRecentComments (recentComments: Comment[], settings: SettingsValues, context: TriggerContext): Promise<json2md.DataObject[] | undefined> {
    const [includeRecentComments] = settings[RecentCommentsSetting.IncludeRecentComments] as IncludeRecentContentOption[] | undefined ?? [IncludeRecentContentOption.None];
    const numberOfRemovedCommentsToInclude = settings[RecentCommentsSetting.NumberOfCommentsToInclude] as number | undefined ?? 3;

    if (numberOfRemovedCommentsToInclude === 0 || includeRecentComments === IncludeRecentContentOption.None) {
        return;
    }

    const [locale] = settings[GeneralSetting.LocaleForDateOutput] as string[] | undefined ?? ["en-US"];

    const filteredComments = recentComments
        .filter(comment => comment.subredditId === context.subredditId)
        .filter(comment => includeRecentComments === IncludeRecentContentOption.VisibleAndRemoved || comment.removed)
        .slice(0, numberOfRemovedCommentsToInclude);

    if (filteredComments.length === 0) {
        return;
    }

    const subredditName = await context.reddit.getCurrentSubredditName();
    const result: json2md.DataObject[] = [];

    if (includeRecentComments === IncludeRecentContentOption.VisibleAndRemoved) {
        result.push({ p: `**Recent comments on ${subredditName}**:` });
    } else {
        result.push({ p: `**Recently removed comments on ${subredditName}**:` });
    }

    for (const comment of filteredComments) {
        let line = `[${comment.createdAt.toLocaleDateString(locale)}](${comment.permalink})`;
        if (includeRecentComments === IncludeRecentContentOption.VisibleAndRemoved && comment.removed) {
            line += " (removed):";
        } else {
            line += ":";
        }
        result.push({ p: line });
        result.push({ blockquote: comment.body });
    }

    result.push({ hr: {} });

    return result;
}
