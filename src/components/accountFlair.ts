import { SettingsFormField, SettingsValues, TriggerContext, User } from "@devvit/public-api";
import markdownEscape from "markdown-escape";

enum AccountFlairSetting {
    IncludeUserFlair = "includeUserFlair",
}

export const settingsForUserFlair: SettingsFormField = {
    type: "boolean",
    name: AccountFlairSetting.IncludeUserFlair,
    label: "Include user's flair in summary",
    defaultValue: false,
};

export async function getAccountFlair (user: User, settings: SettingsValues, context: TriggerContext): Promise<string | undefined> {
    if (!settings[AccountFlairSetting.IncludeUserFlair]) {
        return;
    }

    const subredditName = await context.reddit.getCurrentSubredditName();
    const userFlair = await user.getUserFlairBySubreddit(subredditName);
    if (userFlair?.flairText) {
        return `**User Flair**: ${markdownEscape(userFlair.flairText)}`;
    }
}
