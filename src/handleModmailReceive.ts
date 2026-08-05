import { ConversationData, GetConversationResponse, MessageData, ModMailConversationState, TriggerContext, User } from "@devvit/public-api";
import { ModMail } from "@devvit/protos";
import { addSeconds } from "date-fns";
import { GeneralSetting } from "./settings.js";
import { MonitoringSetting, scheduleJobs } from "./monitoring.js";
import { createAndSendSummaryModmail } from "./createAndSendMessage.js";
import { isModerator } from "devvit-helpers";
import { hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-helpers";
import { SchedulerJob } from "./scheduler.js";

function getSortedMessages (conversation: ConversationData): MessageData[] {
    return Object.values(conversation.messages).sort((a, b) => {
        const dateA = new Date(a.date ?? Date.now());
        const dateB = new Date(b.date ?? Date.now());
        return dateA.getTime() - dateB.getTime();
    });
}

export async function onModmailReceiveEvent (event: ModMail, context: TriggerContext) {
    if (!event.messageAuthor || event.messageAuthor.name === context.appSlug) {
        return;
    }

    if (await hasTriggerBeenHandled(context.redis, event.messageId)) {
        console.warn("This modmail event has already been handled, skipping.");
        return;
    }

    console.log("Received a new modmail trigger event.");

    let conversationResponse: GetConversationResponse;
    try {
        conversationResponse = await context.reddit.modMail.getConversation({
            conversationId: event.conversationId,
        });
    } catch (error) {
        console.log("Error retrieving conversation:");
        console.log(error);
        return;
    }

    if (!conversationResponse.conversation) {
        return;
    }

    const messagesInConversation = getSortedMessages(conversationResponse.conversation);

    const firstMessage = messagesInConversation[0];

    const username = conversationResponse.conversation.participant?.name;
    // Ensure that the modmail has a participant i.e. is about a user, and not a sub to sub modmail or internal discussion
    if (!conversationResponse.conversation.participant || !username) {
        console.log("There is no participant for the modmail conversation e.g. internal mod discussion");

        // Special handling: Schedule jobs if !monitor command is run, and this is the monitoring subreddit
        if (firstMessage.body?.includes("!monitor")) {
            const monitoringSubreddit = await context.settings.get<string>(MonitoringSetting.MonitoringSubreddit);
            const subredditName = await context.reddit.getCurrentSubredditName();
            if (subredditName.toLowerCase() === monitoringSubreddit?.toLowerCase()) {
                await scheduleJobs(context, event.conversationId);
            }
        }
        return;
    }

    // Get the details of the user who is the "participant" (i.e. the subject of the modmail, even if they aren't the OP)
    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(username);
    } catch {
        //
    }

    if (!user) {
        console.log(`User ${username} could not be resolved. Likely shadowbanned or suspended.`);
    }

    const settings = await context.settings.getAll();

    const subredditName = context.subredditName ?? await context.reddit.getCurrentSubredditName();
    const currentMessage = messagesInConversation.find(message => message.id && event.messageId.includes(message.id));
    if (currentMessage?.bodyMarkdown?.includes("!usersummary") && settings[GeneralSetting.EnableUserSummaryCommand]) {
        if (await isModerator(context.reddit, subredditName, event.messageAuthor.name)) {
            console.log("Received !usersummary command from a moderator, sending summary.");
            await createAndSendSummaryModmail(context, username, user, event.conversationId);
            return;
        } else {
            console.log("Received !usersummary command from a non-moderator, ignoring.");
        }
    }

    // Check that the first message in the entire conversation was for this person
    if (!firstMessage.id || !event.messageId.includes(firstMessage.id)) {
        console.log("Message isn't the very first. Quitting");
        return;
    }

    // Check to see if conversation is already archived e.g. from a ban message
    const conversationIsArchived = conversationResponse.conversation.state === ModMailConversationState.Archived;

    if (!(settings[GeneralSetting.CreateSummaryOnOutgoingMessages] ?? true) && username !== event.messageAuthor.name) {
        console.log("Outgoing modmail. Skipping summary creation.");
        return;
    }

    // Check if user is on the ignore list
    const usersToIgnore = settings[GeneralSetting.UsernamesToIgnore] as string | undefined;
    if (usersToIgnore) {
        const userList = usersToIgnore.split(",");
        if (userList.some(x => x.trim().toLowerCase() === username.toLowerCase())) {
            console.log(`User /u/${username} is on the ignore list, skipping`);
            return;
        }
    }

    // Check if user is a mod, and if app is configured to send summaries for mods
    if (!settings[GeneralSetting.CreateSummaryForModerators]) {
        const userIsModerator = conversationResponse.conversation.participant.isMod ?? await isModerator(context.reddit, subredditName, username);
        if (userIsModerator) {
            console.log(`${username} is a moderator of /r/${subredditName}, skipping`);
            return;
        }
    }

    // And likewise for admins
    if (conversationResponse.conversation.participant.isAdmin && !settings[GeneralSetting.CreateSummaryForAdmins]) {
        console.log(`${username} is an admin, skipping`);
        return;
    }

    if (settings[GeneralSetting.ExcludeUsersByFlair]) {
        const flairs = settings[GeneralSetting.ExcludeUsersByFlair] as string | undefined ?? "";
        const flairsToIgnore = flairs.split("\n").map(x => x.trim().toLowerCase()).filter(x => x.length > 0);
        const userFlair = await user?.getUserFlairBySubreddit(subredditName);
        if (userFlair?.flairText) {
            if (flairsToIgnore.includes(userFlair.flairText.toLowerCase())) {
                console.log(`User /u/${username} has a flair that is on the ignore list, skipping`);
                return;
            }
        }
    }

    const delaySendAfterBan = settings[GeneralSetting.DelaySendAfterBan] as boolean | undefined ?? false;
    const delaySendAfterOtherModmails = settings[GeneralSetting.DelaySendAfterIncomingModmails] as boolean | undefined ?? false;

    if ((conversationIsArchived && delaySendAfterBan) || (!conversationIsArchived && delaySendAfterOtherModmails)) {
        console.log("Queueing message to send 10 seconds from now.");
        await context.scheduler.runJob({
            name: SchedulerJob.SendDelayedSummary,
            data: {
                conversationId: event.conversationId,
                subredditName,
                jobGuid: crypto.randomUUID(),
            },
            runAt: addSeconds(new Date(), 10),
        });

        return;
    }

    const summaryAdded = await createAndSendSummaryModmail(context, username, user, event.conversationId);
    if (!summaryAdded) {
        return;
    }

    const copyOPAfterSummary = settings[GeneralSetting.CopyOPAfterSummary] as boolean | undefined ?? false;
    // If option enabled, and the message is from the participant, copy the OP's body as a new message
    if (copyOPAfterSummary && !conversationIsArchived) {
        console.log("Copying original message after summary");
        const firstMessage = Object.values(conversationResponse.conversation.messages)[0];
        if (firstMessage.author?.isParticipant && firstMessage.bodyMarkdown) {
            let newMessageBody = `Original message from /u/${username}:\n\n> `;
            newMessageBody += firstMessage.bodyMarkdown.split("\n").join("\n> ");
            await context.reddit.modMail.reply({
                body: newMessageBody,
                conversationId: event.conversationId,
                isInternal: true,
            });
        }
    }

    // If conversation was previously archived (e.g. a ban) archive it again
    if (conversationIsArchived) {
        await context.reddit.modMail.archiveConversation(event.conversationId);
    }
}
