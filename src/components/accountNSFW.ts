import { SettingsFormField, SettingsValues, User } from "@devvit/public-api";

enum AccountNSFWSetting {
    EnableOption = "enableNSFWOutput",
}

export const settingsForAccountNSFW: SettingsFormField = {
    type: "group",
    label: "Account NSFW Output",
    fields: [
        {
            name: AccountNSFWSetting.EnableOption,
            type: "boolean",
            label: "Include a line if account is marked as NSFW",
            defaultValue: true,
        },
    ],
};

export function getAccountNSFW (user: User, settings: SettingsValues): string {
    if (!settings[AccountNSFWSetting.EnableOption]) {
        return "";
    }

    if (user.nsfw) {
        return "**NSFW account**: Yes\n\n";
    } else {
        return "";
    }
}
