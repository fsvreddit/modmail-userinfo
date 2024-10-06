import { SettingsFormField, SettingsValues, User } from "@devvit/public-api";

enum AccountKarmaSetting {
    EnableOption = "enableAccountKarma",
}

export const settingsForAccountKarma: SettingsFormField = {
    name: AccountKarmaSetting.EnableOption,
    type: "boolean",
    label: "Include sitewide karma in output",
    defaultValue: true,
};

export function getAccountKarma (user: User, settings: SettingsValues): string | undefined {
    if (!settings[AccountKarmaSetting.EnableOption]) {
        return;
    }

    return `**Sitewide karma**: Post ${user.linkKarma.toLocaleString()}, Comment ${user.commentKarma.toLocaleString()}`;
}
