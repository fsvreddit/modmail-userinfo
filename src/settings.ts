import {SettingsFormField} from "@devvit/public-api";

export enum SettingsName {
    IncludeNativeNotes = "includeNativeNotes",
    IncludeToolboxNotes = "includeToolboxNotes",
    NumberOfSubsInSummary = "numberOfSubsToIncludeInSummary",
    SubHistoryDisplayStyle = "subHistoryDisplayStyle",
    NumberOfCommentsToInclude = "numberOfCommentsToInclude",
    IncludeRecentPosts = "includeRecentPosts",
    CreateSummaryForModerators = "createSummaryForModerators",
    UsernamesToIgnore = "usernamesToIgnore",
    LocaleForDateOutput = "localeForDateOutput",
    CopyOPAfterSummary = "copyOPAfterSummary",
    DelaySendAfterBan = "delaySendAfterBan",
}

export enum SubHistoryDisplayStyleOption {
    Bullet = "bullet",
    SingleParagraph = "singlepara",
}

export enum IncludeRecentPostsOption {
    None = "none",
    VisibleAndRemoved = "all",
    Removed = "removed",
}

export const appSettings: SettingsFormField[] = [
    {
        type: "boolean",
        name: SettingsName.IncludeNativeNotes,
        label: "Include native Reddit user notes in Modmail User Summary",
        helpText: "If you do not use Reddit's native usernotes, including them may be misleading.",
        defaultValue: false,
    },
    {
        type: "boolean",
        name: SettingsName.IncludeToolboxNotes,
        label: "Include Toolbox usernotes in Modmail User Summary",
        helpText: "If you do not use Toolbox usernotes, or have migrated away from them, including them in the modmail summary may be misleading.",
        defaultValue: false,
    },
    {
        type: "number",
        name: SettingsName.NumberOfSubsInSummary,
        label: "Number of subreddits to include in comment summary",
        helpText: "Limit the number of subreddits listed to this number. If a user participates in lots of subreddits, a large number might be distracting",
        defaultValue: 10,
        onValidate: ({value}) => {
            if (!value || value < 0 || value > 100) {
                return "Value must be between 0 and 100";
            }
        },
    },
    {
        type: "select",
        name: SettingsName.SubHistoryDisplayStyle,
        label: "Output style for subreddit history",
        options: [
            {label: "Bulleted list (one subreddit per line)", value: SubHistoryDisplayStyleOption.Bullet},
            {label: "Single paragraph (all subreddits on one line - more compact)", value: SubHistoryDisplayStyleOption.SingleParagraph},
        ],
        defaultValue: [SubHistoryDisplayStyleOption.SingleParagraph],
        multiSelect: false,
    },
    {
        type: "number",
        name: SettingsName.NumberOfCommentsToInclude,
        label: "Number of recently removed comments to show in summary",
        helpText: "Summary will only include comments removed by a moderator. Comments filtered or removed by AutoModerator will not show.",
        defaultValue: 3,
        onValidate: ({value}) => {
            if (!value || value < 0 || value > 10) {
                return "Value must be between 0 and 10";
            }
        },
    },
    {
        type: "select",
        name: SettingsName.IncludeRecentPosts,
        label: "Include up to 3 recent posts in summary",
        options: [
            {label: "None", value: IncludeRecentPostsOption.None},
            {label: "Visible and Removed posts", value: IncludeRecentPostsOption.VisibleAndRemoved},
            {label: "Removed posts only", value: IncludeRecentPostsOption.Removed},
        ],
        defaultValue: ["none"],
        multiSelect: false,
    },
    {
        type: "boolean",
        name: SettingsName.CreateSummaryForModerators,
        label: "Create modmail summary when receiving modmail from subreddit moderators",
        defaultValue: false,
    },
    {
        type: "string",
        name: SettingsName.UsernamesToIgnore,
        label: "Do not create summaries for these users",
        helpText: "Comma-separated, not case sensitive",
        defaultValue: "AutoModerator,ModSupportBot",
    },
    {
        type: "select",
        name: SettingsName.LocaleForDateOutput,
        label: "Format for date output",
        options: [
            {value: "en-GB", label: "date/month/year"},
            {value: "en-US", label: "month/date/year"},
            {value: "ja-JP", label: "year/month/date"},
        ],
        defaultValue: ["en-US"],
        multiSelect: false,
    },
    {
        type: "boolean",
        name: SettingsName.CopyOPAfterSummary,
        label: "Copy initial message as new message after summary",
        helpText: "Helps make the preview of modmails more useful by allowing you to see the initial message text. Sent on incoming modmail only.",
        defaultValue: false,
    },
    {
        type: "boolean",
        name: SettingsName.DelaySendAfterBan,
        label: "Delay before adding summary after banning a user",
        helpText: "If the summary is added too soon after banning a user, 'Recently removed comments' may not include comments removed around the time of a ban. Enable this option to wait before adding summary.",
        defaultValue: false,
    },
];
