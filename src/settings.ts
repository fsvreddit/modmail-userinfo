import { SettingsFormField, SettingsFormFieldValidatorEvent } from "@devvit/public-api";

export enum IncludeRecentContentOption {
    None = "none",
    VisibleAndRemoved = "all",
    Removed = "removed",
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export function selectFieldHasOptionChosen (event: SettingsFormFieldValidatorEvent<string[]>): void | string {
    if (!event.value || event.value.length !== 1) {
        return "You must choose an option";
    }
}

export enum GeneralSetting {
    CopyOPAfterSummary = "copyOPAfterSummary",
    DelaySendAfterBan = "delaySendAfterBan",
    DelaySendAfterIncomingModmails = "delaySendAfterOtherModmails",
    CreateSummaryOnOutgoingMessages = "createSummaryOutgoing",
    CreateSummaryForModerators = "createSummaryForModerators",
    CreateSummaryForAdmins = "createSummaryForAdmins",
    UsernamesToIgnore = "usernamesToIgnore",
    LocaleForDateOutput = "localeForDateOutput",
}

export const generalSettings: SettingsFormField = {
    type: "group",
    label: "General settings",
    fields: [
        {
            type: "boolean",
            name: GeneralSetting.CopyOPAfterSummary,
            label: "Copy initial message as new message after summary",
            helpText: "Helps make the preview of modmails more useful by allowing you to see the initial message text. Sent on incoming modmail only.",
            defaultValue: false,
        },
        {
            type: "boolean",
            name: GeneralSetting.DelaySendAfterBan,
            label: "Delay before adding summary on outgoing modmails",
            helpText: "If the summary is added too soon after banning a user, 'Recently removed comments' may not include comments removed around the time of a ban. Enable this option to wait before adding summary.",
            defaultValue: false,
        },
        {
            type: "boolean",
            name: GeneralSetting.DelaySendAfterIncomingModmails,
            label: "Delay before adding summary on incoming modmails",
            defaultValue: false,
        },
        {
            type: "boolean",
            name: GeneralSetting.CreateSummaryOnOutgoingMessages,
            label: "Create modmail summary on outgoing modmails",
            defaultValue: true,
        },
        {
            type: "boolean",
            name: GeneralSetting.CreateSummaryForModerators,
            label: "Create modmail summary when receiving modmail from subreddit moderators",
            defaultValue: false,
        },
        {
            type: "boolean",
            name: GeneralSetting.CreateSummaryForAdmins,
            label: "Create modmail summary when receiving modmail from admins",
            defaultValue: false,
        },
        {
            type: "string",
            name: GeneralSetting.UsernamesToIgnore,
            label: "Do not create summaries for these users",
            helpText: "Comma-separated, not case sensitive",
            defaultValue: "AutoModerator,ModSupportBot",
        },
        {
            type: "select",
            name: GeneralSetting.LocaleForDateOutput,
            label: "Format for date output",
            options: [
                { value: "en-GB", label: "date/month/year" },
                { value: "en-US", label: "month/date/year" },
                { value: "ja-JP", label: "year/month/date" },
            ],
            defaultValue: ["en-US"],
            multiSelect: false,
            onValidate: selectFieldHasOptionChosen,
        },
    ],
};
