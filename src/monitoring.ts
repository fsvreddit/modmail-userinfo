import { TriggerContext } from "@devvit/public-api";
import { AppInstall, AppUpgrade } from "@devvit/protos";
import { formatDistanceToNow } from "date-fns";
import { AppSetting } from "./settings.js";

export async function checkIfAppIsWorking (_: unknown, context: TriggerContext) {
    const currentSubreddit = await context.reddit.getCurrentSubreddit();
    const settings = await context.settings.getAll();

    const monitoringSubreddit = settings[AppSetting.MonitoringSubreddit] as string | undefined;
    if (currentSubreddit.name.toLowerCase() !== monitoringSubreddit) {
        return;
    }

    const webhookUrl = settings[AppSetting.MonitoringWebhook] as string | undefined;
    if (!webhookUrl) {
        return;
    }

    const redisKey = "existingErrorStatus";
    let errorMessage: string | undefined;
    try {
        await context.reddit.modMail.getConversations({
            subreddits: [currentSubreddit.name],
            state: "all",
        });
        console.log("Monitoring: App appears to be working.");
        const existingState = await context.redis.get(redisKey);
        if (existingState) {
            // App was down previously. Notify that all is well.
            const downSince = new Date(parseInt(existingState));
            const messageToSend = `Modmail quick user summary is back up! Approximate downtime: ${formatDistanceToNow(downSince)}`;
            await sendMessageToWebhook(webhookUrl, messageToSend);
            await context.redis.del(redisKey);
        }
        return;
    } catch (error) {
        errorMessage = JSON.stringify(error);
        console.log("Monitoring: Error reading modmails.");
        console.log(error);
    }

    // Is the error message anything other than a 403 Forbidden? If it is, it's likely to be platform trouble, so no need to alert.
    if (!errorMessage.includes("403 Forbidden")) {
        console.log("Monitoring: Error is not a 403 Forbidden error.");
        return;
    }

    // If we've got here, we encountered an error retrieving modmails.
    const existingState = await context.redis.get(redisKey);
    if (existingState) {
        const downSince = new Date(parseInt(existingState));
        console.log(`Monitoring: App was already down. Downtime duration: ${formatDistanceToNow(downSince)}`);
        return;
    }

    // App is newly down. Send a Discord notification if webhook is defined.
    const messageToSend = `Modmail Quick User Summary appears to be down! Latest error message:\n\n${errorMessage}`;
    await sendMessageToWebhook(webhookUrl, messageToSend);
}

async function sendMessageToWebhook (webhookUrl: string, message: string) {
    const params = {
        content: message,
    };

    await fetch(
        webhookUrl,
        {
            method: "post",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        },
    );
}

export async function scheduleJobOnAppUpgradeOrInstall (_: AppInstall | AppUpgrade, context: TriggerContext) {
    await scheduleJobs(context);
}

export async function scheduleJobs (context: TriggerContext, conversationId?: string) {
    const currentJobs = await context.scheduler.listJobs();

    // Remove any scheduled monitoring jobs
    const monitoringJobs = currentJobs.filter(job => job.name === "checkIfAppIsWorking");
    if (monitoringJobs.length > 0) {
        await Promise.all(monitoringJobs.map(job => context.scheduler.cancelJob(job.id)));
        console.log("Scheduler: Removed existing jobs.");
    }

    // Check if we need to add a scheduled monitoring job
    const currentSubreddit = await context.reddit.getCurrentSubreddit();

    const settings = await context.settings.getAll();

    const monitoringSubreddit = settings[AppSetting.MonitoringSubreddit] as string | undefined;
    if (currentSubreddit.name.toLowerCase() !== monitoringSubreddit) {
        console.log(`Scheduler: /r/${currentSubreddit.name} is not a permitted monitoring subreddit.`);
        return;
    }

    await context.scheduler.runJob({
        name: "checkIfAppIsWorking",
        cron: "*/30 * * * *", // Every half hour
    });

    console.log("Scheduler: Monitoring job has been scheduled.");

    if (conversationId) {
        await context.reddit.modMail.reply({
            conversationId,
            body: "A job will run every 30 minutes to check if the app is up or not.",
        });
    }
}
