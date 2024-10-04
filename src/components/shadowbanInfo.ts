import { SettingsFormField, SettingsValues } from "@devvit/public-api";

enum ShadowbanCheckSetting {
    EnableOption = "enableShadowbanOutput",
}

export const settingsForShadowbanCheck: SettingsFormField = {
    type: "group",
    label: "Shadowban/Suspended User Notification",
    fields: [
        {
            name: ShadowbanCheckSetting.EnableOption,
            type: "boolean",
            label: "Create a stub summary if user is suspended or shadowbanned",
            defaultValue: true,
        },
    ],
};

export function getUserShadowbanText (username: string, settings: SettingsValues): string | undefined {
    if (settings[ShadowbanCheckSetting.EnableOption]) {
        return;
    }

    return `User ${username} appears to be shadowbanned or suspended.\n\n`;
}
