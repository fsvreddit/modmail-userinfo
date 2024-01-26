import {Devvit} from "@devvit/public-api";
import {onModmailReceiveEvent, sendDelayedSummary} from "./modmail.js";

Devvit.addSettings([
    {
        type: "boolean",
        name: "includeNativeNotes",
        label: "Include native Reddit user notes in Modmail User Summary",
        helpText: "If you do not use Reddit's native usernotes, including them may be misleading.",
        defaultValue: false,
    },
    {
        type: "boolean",
        name: "includeToolboxNotes",
        label: "Include Toolbox usernotes in Modmail User Summary",
        helpText: "If you do not use Toolbox usernotes, or have migrated away from them, including them in the modmail summary may be misleading.",
        defaultValue: false,
    },
    {
        type: "number",
        name: "numberOfSubsToIncludeInSummary",
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
        name: "subHistoryDisplayStyle",
        label: "Output style for subreddit history",
        options: [
            {label: "Bulleted list (one subreddit per line)", value: "bullet"},
            {label: "Single paragraph (all subreddits on one line - more compact)", value: "singlepara"},
        ],
        defaultValue: ["singlepara"],
        multiSelect: false,
    },
    {
        type: "number",
        name: "numberOfCommentsToInclude",
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
        name: "includeRecentPosts",
        label: "Include up to 3 recent posts in summary",
        options: [
            {label: "None", value: "none"},
            {label: "Visible and Removed posts", value: "all"},
            {label: "Removed posts only", value: "removed"},
        ],
        defaultValue: ["none"],
        multiSelect: false,
    },
    {
        type: "boolean",
        name: "createSummaryForModerators",
        label: "Create modmail summary when receiving modmail from subreddit moderators",
        defaultValue: false,
    },
    {
        type: "string",
        name: "usernamesToIgnore",
        label: "Do not create summaries for these users",
        helpText: "Comma-separated, not case sensitive",
        defaultValue: "AutoModerator,ModSupportBot",
    },
    {
        type: "select",
        name: "localeForDateOutput",
        label: "Format for date output",
        options: [
            {value: "en-GB", label: "date/month/year"},
            {value: "en-US", label: "month/date/year"},
            {value: "ja-JP", label: "year/month/date"},
        ],
        defaultValue: ["en-US"],
        multiSelect: false,
        onValidate: ({value}) => {
            if (!value) {
                "You must select a date format";
            }
        },
    },
    {
        type: "boolean",
        name: "copyOPAfterSummary",
        label: "Copy initial message as new message after summary",
        helpText: "Helps make the preview of modmails more useful by allowing you to see the initial message text. Sent on incoming modmail only.",
        defaultValue: false,
    },
    {
        type: "boolean",
        name: "delaySendAfterBan",
        label: "Delay before adding summary after banning a user",
        helpText: "If the summary is added too soon after banning a user, 'Recently removed comments' may not include comments removed around the time of a ban. Enable this option to wait before adding summary.",
        defaultValue: false,
    },
]);

Devvit.addTrigger({
    event: "ModMail",
    onEvent: onModmailReceiveEvent,
});

Devvit.addSchedulerJob({
    name: "sendDelayedSummary",
    onRun: sendDelayedSummary,
});

Devvit.addTrigger({
    event: "AppUpgrade",
    async onEvent (_, context) {
        // Clear down existing scheduler jobs, if any. Previous app versions used the scheduler.
        const currentJobs = await context.scheduler.listJobs();
        await Promise.all(currentJobs.map(job => context.scheduler.cancelJob(job.id)));
    },
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
