import { SettingsFormField, SettingsValues, TriggerContext, User } from "@devvit/public-api";
import markdownEscape from "markdown-escape";
import { getSubredditName } from "../utility.js";

enum AccountFlairSetting {
    IncludeUserFlair = "includeUserFlair",
}

export const settingsForUserFlair: SettingsFormField = {
    type: "boolean",
    name: AccountFlairSetting.IncludeUserFlair,
    label: "Include user's flair in summary (if they have one)",
    defaultValue: false,
};

export async function getAccountFlair (user: User, settings: SettingsValues, context: TriggerContext): Promise<string> {
    if (!settings[AccountFlairSetting.IncludeUserFlair]) {
        return "";
    }

    const subredditName = await getSubredditName(context);
    const userFlair = await user.getUserFlairBySubreddit(subredditName);
    if (userFlair?.flairText) {
        return `**User Flair**: ${markdownEscape(userFlair.flairText)}\n\n`;
    } else {
        return "";
    }
}