import { GetConversationResponse, JSONObject, ModMailConversationState, ScheduledJobEvent, TriggerContext, User } from "@devvit/public-api";
import { ModMail } from "@devvit/protos";
import { addDays, addSeconds } from "date-fns";
import { AppSetting } from "./settings.js";
import { scheduleJobs } from "./monitoring.js";
import { getRecentSubreddits } from "./components/recentSubredditList.js";
import { getRecentComments } from "./components/recentComments.js";
import { getRecentPosts } from "./components/recentPosts.js";
import { getModNotes } from "./components/modNotes.js";
import { getAccountAge } from "./components/accountAge.js";
import { getAccountKarma } from "./components/accountKarma.js";
import { getAccountNSFW } from "./components/accountNSFW.js";
import { getAccountFlair } from "./components/accountFlair.js";

export async function onModmailReceiveEvent (event: ModMail, context: TriggerContext) {
    console.log("Received modmail trigger event.");

    if (event.messageAuthor && event.messageAuthor.name === context.appName) {
        console.log("Modmail event triggered by this app. Quitting.");
        return;
    }

    const redisKey = `processed-${event.conversationId}`;
    const alreadyProcessed = await context.redis.get(redisKey);
    if (alreadyProcessed) {
        console.log("Already processed an action for this conversation. Either a reply or a duplicate trigger.");
        return;
    }

    // Make a note that we've processed this conversation.
    await context.redis.set(redisKey, new Date().getTime().toString(), { expiration: addDays(new Date(), 7) });

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

    console.log("Got conversation response");

    if (!conversationResponse.conversation) {
        console.log("No conversation");
        return;
    }

    if (!event.messageAuthor) {
        console.log("No message author");
        return;
    }

    const messagesInConversation = Object.values(conversationResponse.conversation.messages);

    const firstMessage = messagesInConversation[0];
    console.log(`First Message ID: ${firstMessage.id ?? "undefined"}`);

    // Ensure that the modmail has a participant i.e. is about a user, and not a sub to sub modmail or internal discussion
    if (!conversationResponse.conversation.participant?.name) {
        console.log("There is no participant for the modmail conversation e.g. internal mod discussion");

        // Special handling: Schedule jobs if !monitor command is run, and this is the monitoring subreddit.
        if (firstMessage.body?.includes("!monitor")) {
            const monitoringSubreddit = await context.settings.get<string>(AppSetting.MonitoringSubreddit);
            const subreddit = await context.reddit.getCurrentSubreddit();
            if (subreddit.name.toLowerCase() === monitoringSubreddit?.toLowerCase()) {
                await scheduleJobs(context, event.conversationId);
            }
        }
        return;
    }

    // Check that the first message in the entire conversation was for this person.
    if (!firstMessage.id || !event.messageId.includes(firstMessage.id)) {
        console.log("Message isn't the very first. Quitting");
        return;
    }

    console.log(`Current conversation state: ${conversationResponse.conversation.state ?? "Unknown"}`);

    // Check to see if conversation is already archived e.g. from a ban message
    const conversationIsArchived = conversationResponse.conversation.state === ModMailConversationState.Archived;

    // Get the details of the user who is the "participant" (i.e. the subject of the modmail, even if they aren't the OP)
    const user = await context.reddit.getUserByUsername(conversationResponse.conversation.participant.name);
    if (!user) {
        console.log(`User ${conversationResponse.conversation.participant.name} could not be resolved. Likely shadowbanned or suspended.`);
        return;
    }

    let subredditName: string;
    if (event.conversationSubreddit) {
        subredditName = event.conversationSubreddit.name;
    } else {
        // Very unlikely that this case will occur except for sub2sub modmail, in which case we should have already quit.
        const subReddit = await context.reddit.getCurrentSubreddit();
        subredditName = subReddit.name;
    }

    const settings = await context.settings.getAll();

    if (!(settings[AppSetting.CreateSummaryOnOutgoingMessages] ?? true) && user.username !== event.messageAuthor.name) {
        console.log("Outgoing modmail. Skipping summary creation.");
        return;
    }

    // Check if user is on the ignore list.
    const usersToIgnore = settings[AppSetting.UsernamesToIgnore] as string | undefined;
    if (usersToIgnore) {
        const userList = usersToIgnore.split(",");
        if (userList.some(x => x.trim().toLowerCase() === user.username.toLowerCase())) {
            console.log(`User /u/${user.username} is on the ignore list, skipping`);
            return;
        }
    }

    // Check if user is a mod, and if app is configured to send summaries for mods
    if (conversationResponse.conversation.participant.isMod) {
        if (!settings[AppSetting.CreateSummaryForModerators]) {
            console.log(`${user.username} is a moderator of /r/${subredditName}, skipping`);
            return;
        }
    }

    // And likewise for admins
    if (conversationResponse.conversation.participant.isAdmin) {
        if (!settings[AppSetting.CreateSummaryForAdmins]) {
            console.log(`${user.username} is an admin, skipping`);
            return;
        }
    }

    const delaySendAfterBan = settings[AppSetting.DelaySendAfterBan] as boolean | undefined ?? false;
    const delaySendAfterOtherModmails = settings[AppSetting.DelaySendAfterIncomingModmails] as boolean | undefined ?? false;

    if ((conversationIsArchived && delaySendAfterBan) || (!conversationIsArchived && delaySendAfterOtherModmails)) {
        console.log("Queueing message to send 10 seconds from now.");
        await context.scheduler.runJob({
            name: "sendDelayedSummary",
            data: {
                conversationId: event.conversationId,
                subredditName,
            },
            runAt: addSeconds(new Date(), 10),
        });

        return;
    }

    await createAndSendSummaryModmail(context, user, subredditName, event.conversationId);

    const copyOPAfterSummary = settings[AppSetting.CopyOPAfterSummary] as boolean | undefined ?? false;
    // If option enabled, and the message is from the participant, copy the OP's body as a new message.
    if (copyOPAfterSummary && !conversationIsArchived) {
        console.log("Copying original message after summary");
        const firstMessage = Object.values(conversationResponse.conversation.messages)[0];
        if (firstMessage.author?.isParticipant && firstMessage.bodyMarkdown) {
            let newMessageBody = `Original message from /u/${user.username}:\n\n> `;
            newMessageBody += firstMessage.bodyMarkdown.split("\n").join("\n> ");
            await context.reddit.modMail.reply({
                body: newMessageBody,
                conversationId: event.conversationId,
                isInternal: true,
            });
        }
    }

    // If conversation was previously archived (e.g. a ban) archive it again.
    if (conversationIsArchived) {
        await context.reddit.modMail.archiveConversation(event.conversationId);
    }
}

async function createAndSendSummaryModmail (context: TriggerContext, user: User, subName: string, conversationId: string) {
    const modmailMessage = await createUserSummaryModmail(context, user);

    await context.reddit.modMail.reply({
        body: modmailMessage,
        conversationId,
        isInternal: true,
    });
}

export async function createUserSummaryModmail (context: TriggerContext, user: User): Promise<string> {
    console.log(`About to create summary modmail for ${user.username}`);

    let modmailMessage = `Possible relevant information for /u/${user.username}:\n\n`;

    const settings = await context.settings.getAll();
    const userComments = await user.getComments({
        sort: "new",
        limit: 100,
    }).all();

    modmailMessage += getAccountAge(user);
    modmailMessage += getAccountKarma(user);
    modmailMessage += getAccountNSFW(user);
    modmailMessage += await getAccountFlair(user, settings, context);
    modmailMessage += await getRecentSubreddits(userComments, settings, context);
    modmailMessage += await getRecentComments(userComments, settings, context);
    modmailMessage += await getRecentPosts(user.username, settings, context);
    modmailMessage += await getModNotes(user.username, settings, context);

    return modmailMessage;
}

export async function sendDelayedSummary (event: ScheduledJobEvent<JSONObject | undefined>, context: TriggerContext) {
    const conversationId = event.data?.conversationId as string | undefined;
    if (!conversationId) {
        return;
    }

    const subredditName = event.data?.subredditName as string | undefined;
    if (!subredditName) {
        return;
    }

    console.log("Processing delayed summary.");

    try {
        const conversationResponse = await context.reddit.modMail.getConversation({ conversationId });

        // Sanity checks to ensure that conversation is in the right state.
        if (conversationResponse.conversation?.participant?.name) {
            const conversationIsArchived = conversationResponse.conversation.state === ModMailConversationState.Archived;

            const user = await context.reddit.getUserByUsername(conversationResponse.conversation.participant.name);
            if (!user) {
                console.log(`User ${conversationResponse.conversation.participant.name} could not be resolved. Likely shadowbanned or suspended.`);
                return;
            }

            await createAndSendSummaryModmail(context, user, subredditName, conversationId);
            if (conversationIsArchived) {
                await context.reddit.modMail.archiveConversation(conversationId);
            }
        }
    } catch (error) {
        // If one fails, log to console and continue.
        console.log(`Error sending modmail summary for conversation ${conversationId}!`);
        console.log(error);
    }
}
