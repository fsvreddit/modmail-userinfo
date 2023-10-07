import {Devvit, ModMailConversationState} from "@devvit/public-api";
import {createUserSummaryModmail} from "./modmail.js";

Devvit.addSettings([
    {
        type: "boolean",
        name: "includeNativeNotes",
        label: "Include native Reddit user notes in Modmail User Summary",
        helpText: "If you do not use Reddit's native usernotes, including them may be misleading.",
        defaultValue: false,
    },
    {
        type: "boolean",
        name: "includeToolboxNotes",
        label: "Include Toolbox usernotes in Modmail User Summary",
        helpText: "If you do not use Toolbox usernotes, or have migrated away from them, including them in the modmail summary may be misleading.",
        defaultValue: false,
    },
    {
        type: "number",
        name: "numberOfSubsToIncludeInSummary",
        label: "Number of subreddits to include in comment summary",
        helpText: "Limit the number of subreddits listed to this number. If a user participates in lots of subreddits, a large number might be distracting",
        defaultValue: 10,
        onValidate: async ({value}) => {
            if (!value || value < 0 || value > 100) {
                return "Value must be between 0 and 100";
            }
        },
    },
    {
        type: "select",
        name: "subHistoryDisplayStyle",
        label: "Output style for subreddit history",
        options: [
            {label: "Bulleted list (one subreddit per line)", value: "bullet"},
            {label: "Single paragraph (all subreddits on one line - more compact)", value: "singlepara"},
        ],
        multiSelect: false,
    },
    {
        type: "number",
        name: "numberOfCommentsToInclude",
        label: "Number of recently removed comments to show in summary",
        defaultValue: 3,
        onValidate: async ({value}) => {
            if (!value || value < 0 || value > 100) {
                return "Value must be between 0 and 100";
            }
        },
    },
    {
        type: "boolean",
        name: "createSummaryForModerators",
        label: "Create modmail summary when receiving modmail from subreddit moderators",
        defaultValue: false,
    },
    {
        type: "string",
        name: "usernamesToIgnore",
        label: "Do not create summaries for these users",
        helpText: "Comma-separated, not case sensitive",
        defaultValue: "Automoderator,ModSupportBot",
    },
    {
        type: "select",
        name: "localeForDateOutput",
        label: "Format for date output",
        options: [
            {value: "en-GB", label: "date/month/year"},
            {value: "en-US", label: "month/date/year"},
            {value: "ja-JP", label: "year/month/date"},
        ],
        multiSelect: false,
        onValidate: async ({value}) => {
            if (!value) {
                "You must select a date format";
            }
        },
    },
    {
        type: "boolean",
        name: "copyOPAfterSummary",
        label: "Copy initial message as new message after summary",
        helpText: "Helps make the preview of modmails more useful by allowing you to see the initial message text. Sent on incoming modmail only.",
        defaultValue: false,
    },
]);

Devvit.addTrigger({
    event: "ModMail",
    async onEvent (event, context) {
        console.log("Received modmail trigger event.");

        if (!event.messageAuthor) {
            return;
        }

        if (event.messageAuthor.id === context.appAccountId) {
            console.log("Modmail event triggered by this app. Quitting.");
            return;
        }

        const conversationResponse = await context.reddit.modMail.getConversation({
            conversationId: event.conversationId,
        });

        if (!conversationResponse.conversation) {
            return;
        }

        // Ensure that we are responding to the first message in the chain - only want to create a summary once.
        if (!conversationResponse.conversation.numMessages || conversationResponse.conversation.numMessages > 1) {
            return;
        }

        // Ensure that the modmail has a participant i.e. is about a user, and not a sub to sub modmail or internal discussion
        if (!conversationResponse.conversation.participant || !conversationResponse.conversation.participant.name) {
            console.log("There is no participant for the modmail conversation e.g. internal mod discussion");
            return;
        }

        // Check to see if conversation is already archived e.g. from a ban message
        const conversationIsArchived = conversationResponse.conversation.state === ModMailConversationState.Archived;

        // Get the details of the user who is the "participant" (i.e. the subject of the modmail, even if they aren't the OP)
        const user = await context.reddit.getUserByUsername(conversationResponse.conversation.participant.name);
        const subReddit = await context.reddit.getSubredditById(context.subredditId);

        // Check if user is on the ignore list.
        const usersToIgnore = await context.settings.get<string>("usernamesToIgnore");
        if (usersToIgnore) {
            const userList = usersToIgnore.split(",");
            if (userList.some(x => x.trim().toLowerCase() === user.username.toLowerCase())) {
                console.log(`User /u/${user.username} is on the ignore list, skipping`);
                return;
            }
        }

        // Check if user is a mod, and if app is configured to send summaries for mods
        const createSummaryForModerators = await context.settings.get<boolean>("createSummaryForModerators");
        if (conversationResponse.conversation.participant.isMod && !createSummaryForModerators) {
            console.log(`${user.username} is a moderator of /r/${subReddit.name}, skipping`);
            return;
        }

        // All checks passed. Retrieve text for modmail summary.
        const modmailMessage = await createUserSummaryModmail(context, user, subReddit.name);

        await context.reddit.modMail.reply({
            body: modmailMessage,
            conversationId: event.conversationId,
            isInternal: true,
        });

        const copyOPAfterSummary = await context.settings.get<boolean>("copyOPAfterSummary");
        // If option enabled, and the message is from the participant, copy the OP's body as a new message.
        if (copyOPAfterSummary && !conversationIsArchived) {
            const firstMessage = Object.values(conversationResponse.conversation.messages)[0];
            if (firstMessage.author?.isParticipant && firstMessage.bodyMarkdown) {
                await context.reddit.modMail.reply({
                    body: firstMessage.bodyMarkdown,
                    conversationId: event.conversationId,
                    isInternal: true,
                });
            }
        }

        // If conversation was previously archived (e.g. a ban) archive it again.
        if (conversationIsArchived) {
            await context.reddit.modMail.archiveConversation(event.conversationId);
        }
    },
});

Devvit.configure({
    redditAPI: true,
});

export default Devvit;
