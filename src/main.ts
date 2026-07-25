import { Devvit } from "@devvit/public-api";
import { sendDelayedSummary } from "./createAndSendMessage.js";
import { SchedulerJob } from "./scheduler.js";
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
import { settingsForRecentSubredditComments } from "./components/recentSubredditContent.js";
import { onModmailReceiveEvent } from "./handleModmailReceive.js";
import { settingsForShadowbanCheck } from "./components/shadowbanInfo.js";
import { settingsForSocialLinks } from "./components/socialLinks.js";
import { settingsForBioText } from "./components/accountBioText.js";

Devvit.addSettings([
    settingsForAccountAge,
    settingsForAccountKarma,
    settingsForAccountNSFW,
    settingsForUserFlair,
    settingsForBioText,
    settingsForSocialLinks,
    settingsForRecentSubreddits,
    settingsForRecentSubredditComments,
    settingsForRecentComments,
    settingsForRecentPosts,
    settingsForModNotes,
    settingsForShadowbanCheck,
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
    name: SchedulerJob.SendDelayedSummary,
    onRun: sendDelayedSummary,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.MonitoringJob,
    onRun: checkIfAppIsWorking,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
    http: true,
});

export default Devvit;
