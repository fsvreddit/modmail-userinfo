import { SettingsFormField, SettingsValues, User } from "@devvit/public-api";
import json2md from "json2md";

enum ShadowbanCheckSetting {
    EnableOption = "enableShadowbanOutput",
}

export const settingsForShadowbanCheck: SettingsFormField = {
    name: ShadowbanCheckSetting.EnableOption,
    type: "boolean",
    label: "If user is shadowbanned, create a basic summary explaining this",
    defaultValue: true,
};

export function getUserShadowbanText (username: string, user: User | undefined, settings: SettingsValues): json2md.DataObject | undefined {
    if (!settings[ShadowbanCheckSetting.EnableOption]) {
        return;
    }

    if (user) {
        // Should never happen, but just in case someone calls this from the wrong place.
        return;
    }

    return { p: `User ${username} appears to be shadowbanned or suspended.` };
}
