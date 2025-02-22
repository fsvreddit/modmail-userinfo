import { JobContext, SettingsFormField, TriggerContext } from "@devvit/public-api";
import { AppInstall, AppUpgrade } from "@devvit/protos";
import { formatDistanceToNow } from "date-fns";

export enum MonitoringSetting {
    MonitoringSubreddit = "monitoringSubreddit",
    MonitoringWebhook = "monitoringWebhook",
}

export const settingsForMonitoring: SettingsFormField[] = [
    {
        type: "string",
        name: MonitoringSetting.MonitoringSubreddit,
        label: "Monitoring Subreddit",
        helpText: "The name of a subreddit (omitting the leading /r/) that half hourly monitoring jobs will run on",
        scope: "app",
    },
    {
        type: "string",
        name: MonitoringSetting.MonitoringWebhook,
        label: "Webhook to send uptime alerts to",
        scope: "app",
    },
];

export const MONITORING_JOB_NAME = "checkIfAppIsWorking";

export async function checkIfAppIsWorking (_: unknown, context: JobContext) {
    const subredditName = await context.reddit.getCurrentSubredditName();
    const settings = await context.settings.getAll();

    const monitoringSubreddit = settings[MonitoringSetting.MonitoringSubreddit] as string | undefined;
    if (subredditName.toLowerCase() !== monitoringSubreddit) {
        return;
    }

    const webhookUrl = settings[MonitoringSetting.MonitoringWebhook] as string | undefined;
    if (!webhookUrl) {
        return;
    }

    const redisKey = "existingErrorStatus";
    let errorMessage: string | undefined;
    try {
        await context.reddit.modMail.getConversations({
            subreddits: [subredditName],
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

    // If we get here, we encountered an error retrieving modmails
    const existingState = await context.redis.get(redisKey);
    if (existingState) {
        const downSince = new Date(parseInt(existingState));
        console.log(`Monitoring: App was already down. Downtime duration: ${formatDistanceToNow(downSince)}`);
        return;
    }

    // App is newly down. Send a Discord notification if webhook is defined
    const messageToSend = `Modmail Quick User Summary appears to be down! Latest error message:\n\n${errorMessage}`;
    await sendMessageToWebhook(webhookUrl, messageToSend);

    await context.redis.set(redisKey, new Date().getTime().toString());
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

export async function scheduleJobOnAppUpgradeOrInstall (_: AppInstall | AppUpgrade, context: JobContext) {
    await scheduleJobs(context);
}

export async function scheduleJobs (context: TriggerContext | JobContext, conversationId?: string) {
    const currentJobs = await context.scheduler.listJobs();

    // Remove any scheduled monitoring jobs
    const monitoringJobs = currentJobs.filter(job => job.name === MONITORING_JOB_NAME);
    if (monitoringJobs.length > 0) {
        await Promise.all(monitoringJobs.map(job => context.scheduler.cancelJob(job.id)));
        console.log("Scheduler: Removed existing jobs.");
    }

    // Check if we need to add a scheduled monitoring job
    const currentSubreddit = await context.reddit.getCurrentSubredditName();

    const settings = await context.settings.getAll();

    const monitoringSubreddit = settings[MonitoringSetting.MonitoringSubreddit] as string | undefined;
    if (currentSubreddit.toLowerCase() !== monitoringSubreddit) {
        console.log(`Scheduler: /r/${currentSubreddit} is not a permitted monitoring subreddit.`);
        return;
    }

    await context.scheduler.runJob({
        name: MONITORING_JOB_NAME,
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
