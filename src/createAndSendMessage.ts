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
import { getRecentSubredditCommentCount, getRecentSubredditPostCount } from "./components/recentSubredditContent.js";
import { getUserShadowbanText } from "./components/shadowbanInfo.js";

export async function createAndSendSummaryModmail (context: TriggerContext, username: string, user: User | undefined, conversationId: string): Promise<boolean> {
    const modmailMessage = await createUserSummaryModmail(context, username, user);
    if (!modmailMessage) {
        console.log(`Nothing to send for ${username}`);
        return false;
    }

    await context.reddit.modMail.reply({
        body: modmailMessage,
        conversationId,
        isInternal: true,
    });

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

    let components: string[];
    if (user) {
        const userComments = await user.getComments({
            sort: "new",
            limit: 100,
        }).all();

        // Retrieve all components, removing any blanks
        components = _.compact([
            getAccountAge(user, settings),
            getAccountKarma(user, settings),
            getAccountNSFW(user, settings),
            ...await Promise.all([
                getAccountFlair(user, settings, context),
                getRecentSubreddits(userComments, settings, context),
                getRecentSubredditCommentCount(userComments, settings, context),
                getRecentSubredditPostCount(username, settings, context),
                getRecentComments(userComments, settings, context),
                getRecentPosts(user.username, settings, context),
                getModNotes(user.username, settings, context),
            ]),
        ]);
    } else {
        components = _.compact([
            getUserShadowbanText(username, user, settings),
        ]);
    }

    if (components.length === 0) {
        // No components enabled, or returning data!
        console.log(`No components returned data for ${username}.`);
        return;
    }

    modmailMessage += components.join("\n\n");

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

        // Sanity checks to ensure that conversation is in the right state
        if (conversationResponse.conversation?.participant?.name) {
            const conversationIsArchived = conversationResponse.conversation.state === ModMailConversationState.Archived;

            let user: User | undefined;
            try {
                user = await context.reddit.getUserByUsername(conversationResponse.conversation.participant.name);
            } catch {
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
