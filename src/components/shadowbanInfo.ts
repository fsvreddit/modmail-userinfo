import { SettingsFormField, SettingsValues, User } from "@devvit/public-api";

enum ShadowbanCheckSetting {
    EnableOption = "enableShadowbanOutput",
}

export const settingsForShadowbanCheck: SettingsFormField = {
    name: ShadowbanCheckSetting.EnableOption,
    type: "boolean",
    label: "If user is shadowbanned, create a basic summary explaining this",
    defaultValue: true,
};

export function getUserShadowbanText (username: string, user: User | undefined, settings: SettingsValues): string | undefined {
    if (!settings[ShadowbanCheckSetting.EnableOption]) {
        return;
    }

    if (user) {
        // Should never happen, but just in case someone calls this from the wrong place.
        return;
    }

    return `User ${username} appears to be shadowbanned or suspended.`;
}
