import { SettingsFormField, SettingsFormFieldValidatorEvent } from "@devvit/public-api";

export enum AppSetting {
    IncludeNativeNotes = "includeNativeNotes",
    IncludeToolboxNotes = "includeToolboxNotes",
    IncludeUserFlair = "includeUserFlair",
    NumberOfSubsInSummary = "numberOfSubsToIncludeInSummary",
    SubHistoryDisplayStyle = "subHistoryDisplayStyle",
    IncludeRecentComments = "includeRecentComments",
    NumberOfCommentsToInclude = "numberOfCommentsToInclude",
    IncludeRecentPosts = "includeRecentPosts",
    NumberOfPostsToInclude = "numberOfPostsToInclude",
    ModsToIgnoreRemovalsFrom = "modsToIgnoreRemovalsFrom",
    CreateSummaryOnOutgoingMessages = "createSummaryOutgoing",
    CreateSummaryForModerators = "createSummaryForModerators",
    CreateSummaryForAdmins = "createSummaryForAdmins",
    UsernamesToIgnore = "usernamesToIgnore",
    LocaleForDateOutput = "localeForDateOutput",
    CopyOPAfterSummary = "copyOPAfterSummary",
    DelaySendAfterBan = "delaySendAfterBan",
    DelaySendAfterOtherModmails = "delaySendAfterOtherModmails",
    MonitoringSubreddit = "monitoringSubreddit",
    MonitoringWebhook = "monitoringWebhook",
}

export enum SubHistoryDisplayStyleOption {
    Bullet = "bullet",
    SingleParagraph = "singlepara",
}

export enum IncludeRecentContentOption {
    None = "none",
    VisibleAndRemoved = "all",
    Removed = "removed",
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
function selectFieldHasOptionChosen (event: SettingsFormFieldValidatorEvent<string[]>): void | string {
    if (!event.value || event.value.length !== 1) {
        return "You must choose an option";
    }
}

export const appSettings: SettingsFormField[] = [
    {
        type: "boolean",
        name: AppSetting.IncludeNativeNotes,
        label: "Include native Reddit user notes in Modmail User Summary",
        helpText: "If you do not use Reddit's native usernotes, including them may be misleading.",
        defaultValue: false,
    },
    {
        type: "boolean",
        name: AppSetting.IncludeToolboxNotes,
        label: "Include Toolbox usernotes in Modmail User Summary",
        helpText: "If you do not use Toolbox usernotes, or have migrated away from them, including them in the modmail summary may be misleading.",
        defaultValue: false,
    },
    {
        type: "boolean",
        name: AppSetting.IncludeUserFlair,
        label: "Include user's flair in summary (if they have one)",
        defaultValue: false,
    },
    {
        type: "number",
        name: AppSetting.NumberOfSubsInSummary,
        label: "Number of subreddits to include in comment summary",
        helpText: "Limit the number of subreddits listed to this number. If a user participates in lots of subreddits, a large number might be distracting",
        defaultValue: 10,
        onValidate: ({ value }) => {
            if (value && (value < 0 || value > 100)) {
                return "Value must be between 0 and 100";
            }
        },
    },
    {
        type: "select",
        name: AppSetting.SubHistoryDisplayStyle,
        label: "Output style for subreddit history",
        options: [
            { label: "Bulleted list (one subreddit per line)", value: SubHistoryDisplayStyleOption.Bullet },
            { label: "Single paragraph (all subreddits on one line - more compact)", value: SubHistoryDisplayStyleOption.SingleParagraph },
        ],
        defaultValue: [SubHistoryDisplayStyleOption.SingleParagraph],
        multiSelect: false,
    },
    {
        type: "select",
        name: AppSetting.IncludeRecentComments,
        label: "Include recent comments in summary",
        options: [
            { label: "None", value: IncludeRecentContentOption.None },
            { label: "Visible and Removed comments", value: IncludeRecentContentOption.VisibleAndRemoved },
            { label: "Removed comments only", value: IncludeRecentContentOption.Removed },
        ],
        defaultValue: [IncludeRecentContentOption.Removed],
        multiSelect: false,
        onValidate: selectFieldHasOptionChosen,
    },
    {
        type: "number",
        name: AppSetting.NumberOfCommentsToInclude,
        label: "Number of recent comments to show in summary",
        defaultValue: 3,
        onValidate: ({ value }) => {
            if (value && (value < 0 || value > 10)) {
                return "Value must be between 0 and 10";
            }
        },
    },
    {
        type: "select",
        name: AppSetting.IncludeRecentPosts,
        label: "Include recent posts in summary",
        options: [
            { label: "None", value: IncludeRecentContentOption.None },
            { label: "Visible and Removed posts", value: IncludeRecentContentOption.VisibleAndRemoved },
            { label: "Removed posts only", value: IncludeRecentContentOption.Removed },
        ],
        defaultValue: [IncludeRecentContentOption.None],
        multiSelect: false,
        onValidate: selectFieldHasOptionChosen,
    },
    {
        type: "number",
        name: AppSetting.NumberOfPostsToInclude,
        label: "Number of recent posts to show in summary",
        defaultValue: 3,
    },
    {
        type: "string",
        name: AppSetting.ModsToIgnoreRemovalsFrom,
        label: "Moderators to ignore removals from if 'recent posts' option is 'Removed only'",
        helpText: "Comma separated, not case sensitive",
    },
    {
        type: "boolean",
        name: AppSetting.CreateSummaryOnOutgoingMessages,
        label: "Create modmail summary on outgoing modmails",
        defaultValue: true,
    },
    {
        type: "boolean",
        name: AppSetting.CreateSummaryForModerators,
        label: "Create modmail summary when receiving modmail from subreddit moderators",
        defaultValue: false,
    },
    {
        type: "boolean",
        name: AppSetting.CreateSummaryForAdmins,
        label: "Create modmail summary when receiving modmail from admins",
        defaultValue: false,
    },
    {
        type: "string",
        name: AppSetting.UsernamesToIgnore,
        label: "Do not create summaries for these users",
        helpText: "Comma-separated, not case sensitive",
        defaultValue: "AutoModerator,ModSupportBot",
    },
    {
        type: "select",
        name: AppSetting.LocaleForDateOutput,
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
    {
        type: "boolean",
        name: AppSetting.CopyOPAfterSummary,
        label: "Copy initial message as new message after summary",
        helpText: "Helps make the preview of modmails more useful by allowing you to see the initial message text. Sent on incoming modmail only.",
        defaultValue: false,
    },
    {
        type: "boolean",
        name: AppSetting.DelaySendAfterBan,
        label: "Delay before adding summary on outgoing modmails",
        helpText: "If the summary is added too soon after banning a user, 'Recently removed comments' may not include comments removed around the time of a ban. Enable this option to wait before adding summary.",
        defaultValue: false,
    },
    {
        type: "boolean",
        name: AppSetting.DelaySendAfterOtherModmails,
        label: "Delay before adding summary on other modmails",
        defaultValue: false,
    },
    {
        type: "string",
        name: AppSetting.MonitoringSubreddit,
        label: "Monitoring Subreddit",
        helpText: "The name of a subreddit (omitting the leading /r/) that half hourly monitoring jobs will run on",
        scope: "app",
    },
    {
        type: "string",
        name: AppSetting.MonitoringWebhook,
        label: "Webhook to send uptime alerts to",
        scope: "app",
    },
];
