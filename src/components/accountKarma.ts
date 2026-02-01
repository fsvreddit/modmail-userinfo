import { SettingsFormField, SettingsValues, TriggerContext, User } from "@devvit/public-api";
import json2md from "json2md";
import { formatHeader } from "./componentHelpers.js";

enum AccountKarmaSetting {
    EnableSitewideKarma = "enableAccountKarma",
    EnableLocalKarma = "enableLocalKarma",
}

export const settingsForAccountKarma: SettingsFormField = {
    type: "group",
    label: "Account karma settings",
    fields: [
        {
            name: AccountKarmaSetting.EnableSitewideKarma,
            type: "boolean",
            label: "Include sitewide karma in output",
            defaultValue: true,
        },
        {
            name: AccountKarmaSetting.EnableLocalKarma,
            type: "boolean",
            label: "Include subreddit-specific karma in output",
            defaultValue: false,
        },
    ],
};

export async function getAccountKarma (user: User, settings: SettingsValues, context: TriggerContext): Promise<json2md.DataObject | undefined> {
    const results: json2md.DataObject[] = [];

    if (settings[AccountKarmaSetting.EnableSitewideKarma]) {
        results.push({ p: `${formatHeader("Sitewide karma", settings)}: Post ${user.linkKarma.toLocaleString()}, Comment ${user.commentKarma.toLocaleString()}` });
    }

    if (settings[AccountKarmaSetting.EnableLocalKarma]) {
        try {
            const subKarmaResponse = await context.reddit.getUserKarmaFromCurrentSubreddit(user.username);

            results.push({ p: `${formatHeader("Subreddit karma", settings)}: Post ${subKarmaResponse.fromPosts?.toLocaleString() ?? 0}, Comment ${subKarmaResponse.fromComments?.toLocaleString() ?? 0}` });
        } catch (error) {
            console.error("Error retrieving subreddit-specific karma:");
            console.error(error);
        }
    }

    if (results.length === 0) {
        return;
    }

    return results;
}
