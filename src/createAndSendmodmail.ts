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
import _ from "lodash";
import { getRecentSubredditCommentCount } from "./components/recentSubredditComments.js";

export async function createAndSendSummaryModmail (context: TriggerContext, user: User, subName: string, conversationId: string): Promise<boolean> {
    const modmailMessage = await createUserSummaryModmail(context, user);
    if (!modmailMessage) {
        return false;
    }

    await context.reddit.modMail.reply({
        body: modmailMessage,
        conversationId,
        isInternal: true,
    });

    return true;
}

export async function createUserSummaryModmail (context: TriggerContext, user: User): Promise<string | undefined> {
    console.log(`About to create summary modmail for ${user.username}`);

    const settings = await context.settings.getAll();

    let modmailMessage = "";
    const textForStartOfSummary = settings[GeneralSetting.TextForStartOfSummary] as string | undefined;
    if (textForStartOfSummary) {
        modmailMessage = textForStartOfSummary.replace("{{username}}", user.username) + "\n\n";
    }

    const userComments = await user.getComments({
        sort: "new",
        limit: 1000,
    }).all();

    // Retrieve all components, removing any blanks.
    const components = _.compact([
        getAccountAge(user, settings),
        getAccountKarma(user, settings),
        getAccountNSFW(user, settings),
        ...await Promise.all([
            getAccountFlair(user, settings, context),
            getRecentSubreddits(userComments, settings, context),
            getRecentSubredditCommentCount(userComments, settings, context),
            getRecentComments(userComments, settings, context),
            getRecentPosts(user.username, settings, context),
            getModNotes(user.username, settings, context),
        ]),
    ]);

    if (components.length === 0) {
        // No components enabled, or returning data!
        console.log(`No components returned data for ${user.username}.`);
        return;
    }

    modmailMessage += components.join();

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

            const summaryAdded = await createAndSendSummaryModmail(context, user, subredditName, conversationId);
            if (summaryAdded && conversationIsArchived) {
                await context.reddit.modMail.archiveConversation(conversationId);
            }
        }
    } catch (error) {
        // If one fails, log to console and continue.
        console.log(`Error sending modmail summary for conversation ${conversationId}!`);
        console.log(error);
    }
}
