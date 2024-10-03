import { Devvit } from "@devvit/public-api";
import { onModmailReceiveEvent, sendDelayedSummary } from "./modmail.js";
import { appSettings } from "./settings.js";
import { checkIfAppIsWorking, scheduleJobOnAppUpgradeOrInstall } from "./monitoring.js";

Devvit.addSettings(appSettings);

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
