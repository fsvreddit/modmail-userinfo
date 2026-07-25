import { JSONObject, ModMailConversationState, ScheduledJobEvent, TriggerContext, User } from "@devvit/public-api";
import { GeneralSetting } from "./settings.js";
import { getRecentSubreddits } from "./components/recentSubredditList.js";
import { getRecentComments } from "./components/recentComments.js";
import { getRecentPosts } from "./components/recentPosts.js";
import { getModNotes } from "./components/modNotes.js";
import { getAccountAge } from "./components/accountAge.js";
import { getAccountKarma } from "./components/accountKarma.js";
import { getAccountNSFW } from "./components/accountNSFW.js";
import { getAccountFlair } from "./components/accountFlair.js";
import { compact } from "lodash";
import { getRecentSubredditCommentCount, getRecentSubredditPostCount } from "./components/recentSubredditContent.js";
import { getUserShadowbanText } from "./components/shadowbanInfo.js";
import json2md from "json2md";
import { getUserSocialLinks } from "./components/socialLinks.js";
import { getUserBioText } from "./components/accountBioText.js";
import { hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-helpers";
import { addHours } from "date-fns";
import { getModLogEntries } from "./components/modLog.js";

function splitMessage (message: string, maxLength = 10000): string[] {
    const messages: string[] = [];
    let currentMessage = "";

    for (const line of message.split("\n")) {
        if ((currentMessage + line + "\n").length > maxLength) {
            messages.push(currentMessage);
            currentMessage = "";
        }
        currentMessage += line + "\n";
    }

    if (currentMessage.length > 0) {
        messages.push(currentMessage);
    }

    return messages;
}

export async function createAndSendSummaryModmail (context: TriggerContext, username: string, user: User | undefined, conversationId: string): Promise<boolean> {
    const modmailMessage = await createUserSummaryModmail(context, username, user);
    if (!modmailMessage) {
        console.log(`Nothing to send for ${username}`);
        return false;
    }

    const splitMessages = splitMessage(modmailMessage);

    for (const message of splitMessages) {
        await context.reddit.modMail.reply({
            body: message,
            conversationId,
            isInternal: true,
        });
    }

    console.log(`Summary sent for ${username}`);

    return true;
}

export async function createUserSummaryModmail (context: TriggerContext, username: string, user?: User): Promise<string | undefined> {
    console.log(`About to create summary modmail for ${username}`);

    const settings = await context.settings.getAll();

    let modmailMessage = "";
    const textForStartOfSummary = settings[GeneralSetting.TextForStartOfSummary] as string | undefined;
    if (textForStartOfSummary) {
        modmailMessage = textForStartOfSummary.replace("{{username}}", username) + "\n\n";
    }

    let components: json2md.DataObject[];
    if (user) {
        const userComments = await user.getComments({
            sort: "new",
            limit: 100,
        }).all();

        // Retrieve all components, removing any blanks
        const allComponents: (json2md.DataObject | json2md.DataObject[] | undefined)[] = [
            getAccountAge(user, settings),
            await getAccountKarma(user, settings, context),
            getAccountNSFW(user, settings),
        ];

        allComponents.push(...await Promise.all([
            getAccountFlair(user, settings, context),
            getUserBioText(user, settings, context),
            getUserSocialLinks(user, settings),
            getRecentSubreddits(userComments, settings, context),
            getRecentSubredditCommentCount(userComments, settings, context),
            getRecentSubredditPostCount(username, settings, context),
            getRecentComments(userComments, settings, context),
            getRecentPosts(user.username, settings, context),
            getModNotes(user.username, settings, context),
        ]));

        allComponents.push(await getModLogEntries(user, settings, context));

        components = compact(allComponents).flat();
    } else {
        components = compact([
            getUserShadowbanText(username, user, settings),
        ]);
    }

    if (components.length === 0) {
        // No components enabled, or returning data!
        console.log(`No components returned data for ${username}.`);
        return;
    }

    modmailMessage += json2md(components);

    return modmailMessage;
}

export async function sendDelayedSummary (event: ScheduledJobEvent<JSONObject | undefined>, context: TriggerContext) {
    const jobGuid = event.data?.jobGuid as string | undefined;

    if (jobGuid && await hasTriggerBeenHandled(context.redis, `job:${jobGuid}`, { expiration: addHours(new Date(), 1) })) {
        console.log(`Job ${jobGuid} has already been handled, skipping.`);
        return;
    }

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

        // Sanity checks to ensure that conversation is in the right state
        if (conversationResponse.conversation?.participant?.name) {
            const conversationIsArchived = conversationResponse.conversation.state === ModMailConversationState.Archived;

            let user: User | undefined;
            try {
                user = await context.reddit.getUserByUsername(conversationResponse.conversation.participant.name);
            } catch {
                //
            }

            if (!user) {
                console.log(`User ${conversationResponse.conversation.participant.name} could not be resolved. Likely shadowbanned or suspended.`);
            }

            const summaryAdded = await createAndSendSummaryModmail(context, conversationResponse.conversation.participant.name, user, conversationId);
            if (summaryAdded && conversationIsArchived) {
                await context.reddit.modMail.archiveConversation(conversationId);
            }
        }
    } catch (error) {
        // If one fails, log to console and continue
        console.log(`Error sending modmail summary for conversation ${conversationId}!`);
        console.log(error);
    }
}
