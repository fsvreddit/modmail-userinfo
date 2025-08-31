import { SettingsFormField, SettingsValues, TriggerContext, User } from "@devvit/public-api";
import json2md from "json2md";
import markdownEscape from "markdown-escape";
import { formatHeader } from "./componentHelpers.js";

enum AccountFlairSetting {
    IncludeUserFlair = "includeUserFlair",
}

export const settingsForUserFlair: SettingsFormField = {
    type: "boolean",
    name: AccountFlairSetting.IncludeUserFlair,
    label: "Include user's flair in summary",
    defaultValue: false,
};

export async function getAccountFlair (user: User, settings: SettingsValues, context: TriggerContext): Promise<json2md.DataObject | undefined> {
    if (!settings[AccountFlairSetting.IncludeUserFlair]) {
        return;
    }

    const subredditName = await context.reddit.getCurrentSubredditName();
    const userFlair = await user.getUserFlairBySubreddit(subredditName);
    if (userFlair?.flairText) {
        return { p: `${formatHeader("User Flair", settings)}: ${markdownEscape(userFlair.flairText)}` };
    }
}
