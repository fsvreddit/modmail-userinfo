import { SettingsFormField, SettingsValues, TriggerContext } from "@devvit/public-api";
import json2md from "json2md";
import { formatDate, formatHeader } from "./componentHelpers.js";
import { numericFieldBetween } from "../settingsHelpers.js";

enum TopPostsByKarmaSetting {
    EnableOption = "enableTopPostsByKarma",
    TimeFrameInMonths = "topPostsByKarmaTimeFrameInMonths",
    TopPostsByKarmaEntries = "topPostsByKarmaEntries",
}

export const settingsForTopPostsByKarma: SettingsFormField = {
    type: "group",
    label: "Top Posts by Karma settings",
    helpText: "Includes the top posts by karma from any subreddit in the summary.",
    fields: [
        {
            name: TopPostsByKarmaSetting.EnableOption,
            type: "boolean",
            label: "Enable top posts by karma in the summary",
            defaultValue: false,
        },
        {
            name: TopPostsByKarmaSetting.TimeFrameInMonths,
            type: "number",
            label: "Time frame in months to include top posts from",
            helpText: "Note: This app can only look back on the user's most recent 1000 posts.",
            defaultValue: 6,
            onValidate: ({ value }) => numericFieldBetween(value, 1),
        },
        {
            name: TopPostsByKarmaSetting.TopPostsByKarmaEntries,
            type: "number",
            label: "Number of top posts by karma to include",
            defaultValue: 5,
            onValidate: ({ value }) => numericFieldBetween(value, 1, 10),
        },
    ],
};

export async function getTopPostsByKarma (username: string, settings: SettingsValues, context: TriggerContext): Promise<json2md.DataObject[] | undefined> {
    if (!settings[TopPostsByKarmaSetting.EnableOption]) {
        return;
    }

    const numberOfEntries = settings[TopPostsByKarmaSetting.TopPostsByKarmaEntries] as number | undefined;
    if (!numberOfEntries || numberOfEntries <= 0) {
        return;
    }

    const topPosts = await context.reddit.getPostsByUser({
        username,
        sort: "top",
        limit: numberOfEntries,
    }).all();

    if (topPosts.length === 0) {
        return;
    }

    const header = formatHeader("Top posts by karma", settings);

    return [
        { p: header },
        { ul: topPosts.map(post => `${formatDate(post.createdAt, settings)} [${post.title}](${post.permalink}) on r/${post.subredditName} (${post.score} karma)`).slice(0, numberOfEntries) },
    ];
}
