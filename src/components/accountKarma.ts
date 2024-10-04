import { SettingsFormField, SettingsValues, User } from "@devvit/public-api";

enum AccountKarmaSetting {
    EnableOption = "enableAccountKarma",
}

export const settingsForAccountKarma: SettingsFormField = {
    type: "group",
    label: "Account Karma",
    fields: [
        {
            name: AccountKarmaSetting.EnableOption,
            type: "boolean",
            label: "Include sitewide karma in output",
            defaultValue: true,
        },
    ],
};

export function getAccountKarma (user: User, settings: SettingsValues): string {
    if (!settings[AccountKarmaSetting.EnableOption]) {
        return "";
    }

    return `**Sitewide karma**: Post ${user.linkKarma}, Comment ${user.commentKarma}\n\n`;
}
