import { SettingsFormField, SettingsValues, User } from "@devvit/public-api";
import { differenceInDays, differenceInHours, Duration, formatDistanceToNow, formatDuration, intervalToDuration } from "date-fns";
import { selectFieldHasOptionChosen } from "../settings.js";

enum AccountAgeSetting {
    EnableOption = "enableAccountAge",
    AccountAgeFormat = "accountAgeFormat",
}

enum AccountAgeFormat {
    Approximate = "approximate",
    Exact = "exact",
}

export const settingsForAccountAge: SettingsFormField = {
    type: "group",
    label: "Account Age",
    fields: [
        {
            name: AccountAgeSetting.EnableOption,
            type: "boolean",
            label: "Include account age in output",
            defaultValue: true,
        },
        {
            name: AccountAgeSetting.AccountAgeFormat,
            type: "select",
            label: "Account age output format",
            options: [
                { label: "Approximate (e.g. 'about one year')", value: AccountAgeFormat.Approximate },
                { label: "Exact (e.g. '1 year 4 days')", value: AccountAgeFormat.Exact },
            ],
            defaultValue: [AccountAgeFormat.Approximate],
            multiSelect: false,
            onValidate: selectFieldHasOptionChosen,
        },
    ],
};

export function getAccountAge (user: User, settings: SettingsValues): string {
    if (!settings[AccountAgeSetting.EnableOption]) {
        return "";
    }

    const [accountAgeFormat] = settings[AccountAgeSetting.AccountAgeFormat] as AccountAgeFormat[] | undefined ?? [AccountAgeFormat.Approximate];
    if (accountAgeFormat === AccountAgeFormat.Approximate) {
        return `**Age**: ${formatDistanceToNow(user.createdAt)}\n\n`;
    } else {
        const units: (keyof Duration)[] = ["years", "months", "days"];
        if (differenceInDays(new Date(), user.createdAt) < 2) {
            units.push("hours");
        }
        if (differenceInHours(new Date(), user.createdAt) < 6) {
            units.push("minutes");
        }
        const duration = intervalToDuration({ start: user.createdAt, end: new Date() });
        return `**Age**: ${formatDuration(duration, { format: units })}\n\n`;
    }
}
