import {TriggerContext} from "@devvit/public-api";
import {AppUpgrade} from "@devvit/protos";

export async function onAppUpgrade (event: AppUpgrade, context: TriggerContext) {
    // Clear down existing scheduler jobs, if any. Previous app versions used the scheduler.
    const currentJobs = await context.scheduler.listJobs();
    await Promise.all(currentJobs.map(job => context.scheduler.cancelJob(job.id)));
}
