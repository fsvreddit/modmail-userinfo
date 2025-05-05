import { SettingsFormField, SettingsValues, User } from "@devvit/public-api";
import json2md from "json2md";

enum AccountKarmaSetting {
    EnableOption = "enableAccountKarma",
}

export const settingsForAccountKarma: SettingsFormField = {
    name: AccountKarmaSetting.EnableOption,
    type: "boolean",
    label: "Include sitewide karma in output",
    defaultValue: true,
};

export function getAccountKarma (user: User, settings: SettingsValues): json2md.DataObject | undefined {
    if (!settings[AccountKarmaSetting.EnableOption]) {
        return;
    }

    return { p: `**Sitewide karma**: Post ${user.linkKarma.toLocaleString()}, Comment ${user.commentKarma.toLocaleString()}` };
}
