import {Devvit} from "@devvit/public-api";
import {onModmailReceiveEvent, sendDelayedSummaries} from "./modmail.js";

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
        onValidate: async ({value}) => {
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
        multiSelect: false,
    },
    {
        type: "number",
        name: "numberOfCommentsToInclude",
        label: "Number of recently removed comments to show in summary",
        defaultValue: 3,
        onValidate: async ({value}) => {
            if (!value || value < 0 || value > 100) {
                return "Value must be between 0 and 100";
            }
        },
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
        defaultValue: "Automoderator,ModSupportBot",
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
        multiSelect: false,
        onValidate: async ({value}) => {
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
    name: "sendDelayedSummaries",
    onRun: sendDelayedSummaries,
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    async onEvent (_, context) {
        // Clear down existing scheduler jobs, if any, in case a new release changes the schedule
        const currentJobs = await context.scheduler.listJobs();
        for (const job of currentJobs) {
            console.log("Deleted a job");
            await context.scheduler.cancelJob(job.id);
        }

        await context.scheduler.runJob({
            cron: "* * * * *", // Every minute of every day
            name: "sendDelayedSummaries",
        });
    },
});

Devvit.configure({
    redditAPI: true,
    kvStore: true,
});

export default Devvit;
