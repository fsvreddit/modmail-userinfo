import { Devvit } from "@devvit/public-api";
import { onModmailReceiveEvent, sendDelayedSummary } from "./modmail.js";
import { generalSettings } from "./settings.js";
import { checkIfAppIsWorking, scheduleJobOnAppUpgradeOrInstall, settingsForMonitoring } from "./monitoring.js";
import { settingsForUserFlair } from "./components/accountFlair.js";
import { settingsForRecentSubreddits } from "./components/recentSubredditList.js";
import { settingsForRecentComments } from "./components/recentComments.js";
import { settingsForRecentPosts } from "./components/recentPosts.js";
import { settingsForModNotes } from "./components/modNotes.js";
import { settingsForAccountAge } from "./components/accountAge.js";
import { settingsForAccountKarma } from "./components/accountKarma.js";
import { settingsForAccountNSFW } from "./components/accountNSFW.js";
import { settingsForRecentSubredditComments } from "./components/recentSubredditComments.js";

Devvit.addSettings([
    settingsForAccountAge,
    settingsForAccountKarma,
    settingsForAccountNSFW,
    settingsForUserFlair,
    settingsForRecentSubreddits,
    settingsForRecentSubredditComments,
    settingsForRecentComments,
    settingsForRecentPosts,
    settingsForModNotes,
    generalSettings,
    ...settingsForMonitoring,
]);

Devvit.addTrigger({
    event: "ModMail",
    onEvent: onModmailReceiveEvent,
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    onEvent: scheduleJobOnAppUpgradeOrInstall,
});

Devvit.addSchedulerJob({
    name: "sendDelayedSummary",
    onRun: sendDelayedSummary,
});

Devvit.addSchedulerJob({
    name: "checkIfAppIsWorking",
    onRun: checkIfAppIsWorking,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
    http: true,
});

export default Devvit;
