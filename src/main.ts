import {Devvit} from "@devvit/public-api";
import {onModmailReceiveEvent, sendDelayedSummary} from "./modmail.js";
import {appSettings} from "./settings.js";
import {onAppUpgrade} from "./installActions.js";

Devvit.addSettings(appSettings);

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
    onEvent: onAppUpgrade,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
