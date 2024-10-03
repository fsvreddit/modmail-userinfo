import { SettingsValues, TriggerContext, User } from "@devvit/public-api";
import { AppSetting } from "../settings.js";
import markdownEscape from "markdown-escape";
import { getSubredditName } from "../utility.js";

export async function getAccountFlair (user: User, settings: SettingsValues, context: TriggerContext): Promise<string> {
    if (!settings[AppSetting.IncludeUserFlair]) {
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
