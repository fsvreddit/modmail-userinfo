import { GetConversationResponse, JSONObject, ModMailConversationState, ModNote, RedditAPIClient, ScheduledJobEvent, TriggerContext, User, WikiPage } from "@devvit/public-api";
import { ModMail } from "@devvit/protos";
import { addDays, addSeconds, formatDistanceToNow } from "date-fns";
import { ToolboxClient, Usernote } from "toolbox-devvit";
import { RawSubredditConfig, RawUsernoteType } from "toolbox-devvit/dist/types/RawSubredditConfig.js";
import _ from "lodash";
import markdownEscape from "markdown-escape";
import { IncludeRecentContentOption, AppSetting, SubHistoryDisplayStyleOption } from "./settings.js";
import { scheduleJobs } from "./monitoring.js";
import { getPostOrCommentFromRedditId } from "./utility.js";

interface CombinedUserNote extends Usernote {
    noteSource: "Reddit" | "Toolbox";
}

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
    const modmailMessage = await createUserSummaryModmail(context, user, subName);

    await context.reddit.modMail.reply({
        body: modmailMessage,
        conversationId,
        isInternal: true,
    });
}

async function getSubredditVisibility (context: TriggerContext, subredditName: string): Promise<boolean> {
    if (subredditName.startsWith("u_")) {
        // Not a subreddit - comment on user profile
        return true;
    }

    // Check Redis cache for subreddit visibility.
    const redisKey = `subredditVisibility-${subredditName}`;
    const cachedValue = await context.redis.get(redisKey);
    if (cachedValue) {
        console.log(`Visibility for ${subredditName} already cached (${cachedValue})`);
        return cachedValue === "true";
    }

    let isVisible = true;
    try {
        const subreddit = await context.reddit.getSubredditByName(subredditName);
        isVisible = subreddit.type === "public" || subreddit.type === "restricted" || subreddit.type === "archived";

        // Cache the value for a week, unlikely to change that often.
        console.log(`Caching visibility for ${subredditName} (${JSON.stringify(isVisible)})`);
        await context.redis.set(redisKey, JSON.stringify(isVisible), { expiration: addDays(new Date(), 7) });
    } catch (error) {
        // Error retrieving subreddit. Subreddit is most likely to be public but gated due to controversial topics.
        console.log(`Could not retrieve information for /r/${subredditName}`);
        console.log(error);
    }

    return isVisible;
}

interface SubCommentCount {
    subName: string;
    commentCount: number;
}

export async function createUserSummaryModmail (context: TriggerContext, user: User, subredditName: string): Promise<string> {
    console.log(`About to create summary modmail for ${user.username}`);

    let modmailMessage = `Possible relevant information for /u/${user.username}:\n\n`;

    modmailMessage += `**Age**: ${formatDistanceToNow(user.createdAt)}\n\n`;

    modmailMessage += `**Sitewide karma**: Post ${user.linkKarma}, Comment ${user.commentKarma}\n\n`;

    if (user.nsfw) {
        modmailMessage += "**NSFW account**: Yes\n\n";
    }

    const settings = await context.settings.getAll();
    if (settings[AppSetting.IncludeUserFlair]) {
        const userFlair = await user.getUserFlairBySubreddit(subredditName);
        if (userFlair?.flairText) {
            modmailMessage += `**User Flair**: ${markdownEscape(userFlair.flairText)}\n\n`;
        }
    }

    const userComments = await user.getComments({
        sort: "new",
        limit: 100,
    }).all();

    // Build up a list of subreddits and the count of comments in those subreddits
    const countedSubs = _.countBy(userComments.map(x => x.subredditName));
    const subCommentCounts = Object.keys(countedSubs).map(x => ({ subName: x, commentCount: countedSubs[x] } as SubCommentCount));

    // Filter comment list for subreddits for visibility. This is because we don't want to show counts for private subreddits
    // that this app might be installed in, but that an average person wouldn't necessarily know of. We want to protect users'
    // privacy somewhat so limit output to what a normal user would see.
    const numberOfSubsToReportOn = settings[AppSetting.NumberOfSubsInSummary] as number | undefined ?? 10;
    console.log(`Content found in ${subCommentCounts.length} subreddits. Need to return no more than ${numberOfSubsToReportOn}`);

    const filteredSubCommentCounts: SubCommentCount[] = [];

    if (numberOfSubsToReportOn > 0) {
        for (const subCommentItem of subCommentCounts.sort((a, b) => b.commentCount - a.commentCount)) {
            if (subCommentItem.subName === subredditName) {
                filteredSubCommentCounts.push(subCommentItem);
            } else {
                // Deliberately doing call within loop so that we can limit the number of calls made.
                const isSubVisible = await getSubredditVisibility(context, subCommentItem.subName);
                if (isSubVisible) {
                    filteredSubCommentCounts.push(subCommentItem);
                }
            }

            // Stop checking more subs if we have enough entries.
            if (filteredSubCommentCounts.length >= numberOfSubsToReportOn) {
                break;
            }
        }
    }

    if (filteredSubCommentCounts.length > 0) {
        const [subHistoryDisplayStyle] = settings[AppSetting.SubHistoryDisplayStyle] as string[] | undefined ?? [SubHistoryDisplayStyleOption.SingleParagraph];
        modmailMessage += "**Recent comments across Reddit**: ";

        if (subHistoryDisplayStyle as SubHistoryDisplayStyleOption === SubHistoryDisplayStyleOption.Bullet) {
            modmailMessage += "\n\n";
            modmailMessage += filteredSubCommentCounts.map(item => `* /r/${item.subName}: ${item.commentCount}`).join("\n");
        } else {
            modmailMessage += filteredSubCommentCounts.map(item => `/r/${item.subName} (${item.commentCount})`).join(", ");
        }

        modmailMessage += "\n\n";
    }

    const [locale] = settings[AppSetting.LocaleForDateOutput] as string[] | undefined ?? ["en-US"];

    const [includeRecentComments] = settings[AppSetting.IncludeRecentComments] as string[] | undefined ?? [IncludeRecentContentOption.None];
    const numberOfRemovedCommentsToInclude = settings[AppSetting.NumberOfCommentsToInclude] as number | undefined ?? 3;

    if (numberOfRemovedCommentsToInclude > 0 && includeRecentComments as IncludeRecentContentOption !== IncludeRecentContentOption.None) {
        const filteredComments = userComments
            .filter(x => (includeRecentComments as IncludeRecentContentOption === IncludeRecentContentOption.VisibleAndRemoved || x.removed) && x.subredditName === subredditName)
            .slice(0, numberOfRemovedCommentsToInclude);

        if (filteredComments.length > 0) {
            if (includeRecentComments as IncludeRecentContentOption === IncludeRecentContentOption.VisibleAndRemoved) {
                modmailMessage += `**Recent comments on ${subredditName}**:\n\n`;
            } else {
                modmailMessage += `**Recently removed comments on ${subredditName}**:\n\n`;
            }

            for (const comment of filteredComments) {
                modmailMessage += `[${comment.createdAt.toLocaleDateString(locale)}](${comment.permalink})`;
                if (includeRecentComments as IncludeRecentContentOption === IncludeRecentContentOption.VisibleAndRemoved && comment.removed) {
                    modmailMessage += " (removed)";
                }
                modmailMessage += ":\n\n";
                modmailMessage += `> ${comment.body.split("\n").join("\n> ")}\n\n`; // string.replaceAll not available without es2021
            }

            modmailMessage += "---\n\n";
        }
    }

    const modsToIgnoreRemovalsFromSetting = settings[AppSetting.ModsToIgnoreRemovalsFrom] as string | undefined ?? "";
    const modsToIgnoreRemovalsFrom = modsToIgnoreRemovalsFromSetting.split(",").map(x => x.trim().toLowerCase());

    const [includeRecentPosts] = settings[AppSetting.IncludeRecentPosts] as string[] | undefined ?? [IncludeRecentContentOption.None];
    const numberOfPostsToInclude = settings[AppSetting.NumberOfPostsToInclude] as number | undefined ?? 3;
    if (numberOfPostsToInclude > 0 && includeRecentPosts as IncludeRecentContentOption !== IncludeRecentContentOption.None) {
        let recentPosts = await context.reddit.getPostsByUser({
            username: user.username,
            sort: "new",
            limit: 100,
        }).all();

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        recentPosts = recentPosts.filter(post => post.subredditName === subredditName && (((post.removed || post.spam) && post.removedBy && !modsToIgnoreRemovalsFrom.includes(post.removedBy.toLowerCase())) || includeRecentPosts as IncludeRecentContentOption === IncludeRecentContentOption.VisibleAndRemoved)).slice(0, numberOfPostsToInclude);
        if (recentPosts.length > 0) {
            modmailMessage += `**Recent ${includeRecentPosts as IncludeRecentContentOption === IncludeRecentContentOption.Removed ? "removed " : ""} posts on ${subredditName}**\n\n`;
            for (const post of recentPosts) {
                modmailMessage += `* [${markdownEscape(post.title)}](${post.permalink}) (${post.createdAt.toLocaleDateString(locale)})\n`;
            }
            modmailMessage += "\n";
        }
    }

    const combinedNotesRetriever: Promise<CombinedUserNote[]>[] = [];

    const shouldIncludeNativeUsernotes = settings[AppSetting.IncludeNativeNotes] as boolean | undefined ?? false;
    if (shouldIncludeNativeUsernotes) {
        combinedNotesRetriever.push(getRedditModNotesAsUserNotes(context.reddit, subredditName, user.username));
    }

    const shouldIncludeToolboxUsernotes = settings[AppSetting.IncludeToolboxNotes] as boolean | undefined ?? false;
    if (shouldIncludeToolboxUsernotes) {
        combinedNotesRetriever.push(getToolboxNotesAsUserNotes(context.reddit, subredditName, user.username));
    }

    const notesResults = await Promise.all(combinedNotesRetriever);
    const allUserNotes = _.flatten(notesResults);

    if (allUserNotes.length > 0) {
        allUserNotes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        modmailMessage += "**User notes**:\n\n";

        for (const note of allUserNotes) {
            let modnote = "";
            if (note.noteType) {
                modnote += `[${note.noteType}] `;
            }

            if (note.contextPermalink && note.contextPermalink !== "") {
                modnote += `[${markdownEscape(note.text)}](${note.contextPermalink})`;
            } else {
                modnote += markdownEscape(note.text);
            }

            modnote += ` by ${markdownEscape(note.moderatorUsername)} on ${note.timestamp.toLocaleDateString(locale)}`;

            if (shouldIncludeNativeUsernotes && shouldIncludeToolboxUsernotes) {
                // Include whether these are Toolbox or Native notes, if both are configured.
                modnote += ` (${note.noteSource})`;
            }

            modmailMessage += `* ${modnote}\n`;
        }
        modmailMessage += "\n";
    }

    return modmailMessage;
}

function getRedditNoteTypeFromEnum (noteType: string | undefined): string | undefined {
    const noteTypes = [
        { key: "BOT_BAN", text: "Bot Ban" },
        { key: "PERMA_BAN", text: "Permaban" },
        { key: "BAN", text: "Ban" },
        { key: "ABUSE_WARNING", text: "Abuse Warning" },
        { key: "SPAM_WARNING", text: "Spam Warning" },
        { key: "SPAM_WATCH", text: "Spam Watch" },
        { key: "SOLID_CONTRIBUTOR", text: "Solid Contributor" },
        { key: "HELPFUL_USER", text: "Helpful" },
    ];

    const result = noteTypes.find(x => x.key === noteType);
    if (result) {
        return result.text;
    }
}

function getToolboxNoteTypeFromEnum (noteType: string | undefined, noteTypes: RawUsernoteType[]): string | undefined {
    const result = noteTypes.find(x => x.key === noteType);
    if (result) {
        return result.text;
    }
}

async function getUserNoteFromRedditModNote (reddit: RedditAPIClient, modNote: ModNote): Promise<CombinedUserNote | undefined> {
    // Function to transform a Reddit mod note into the Toolbox Usernote format, for ease of handling.
    if (!modNote.userNote?.note) {
        return;
    }

    const noteTarget = await getPostOrCommentFromRedditId(reddit, modNote.userNote.redditId);

    return {
        noteSource: "Reddit",
        moderatorUsername: modNote.operator.name ?? "unknown",
        text: modNote.userNote.note,
        timestamp: modNote.createdAt,
        username: modNote.user.name ?? "",
        contextPermalink: noteTarget === undefined ? undefined : noteTarget.permalink,
        noteType: getRedditNoteTypeFromEnum(modNote.userNote.label),
    };
}

async function getRedditModNotesAsUserNotes (reddit: RedditAPIClient, subredditName: string, userName: string): Promise<CombinedUserNote[]> {
    try {
        const modNotes = await reddit.getModNotes({
            subreddit: subredditName,
            user: userName,
            filter: "NOTE",
        }).all();

        const results = await Promise.all(modNotes.map(modNote => getUserNoteFromRedditModNote(reddit, modNote)));
        console.log(`Native mod notes found: ${results.length}`);
        return _.compact(results);
    } catch (error) {
        console.log(error); // Currently, this may crash if there are any notes without a permalink
        return [];
    }
}

async function getToolboxNotesAsUserNotes (reddit: RedditAPIClient, subredditName: string, userName: string): Promise<CombinedUserNote[]> {
    const toolbox = new ToolboxClient(reddit);
    try {
        const userNotes = await toolbox.getUsernotesOnUser(subredditName, userName);
        console.log(`Toolbox notes found: ${userNotes.length}`);

        if (userNotes.length === 0) {
            return [];
        }

        let toolboxConfigPage: WikiPage;
        try {
            toolboxConfigPage = await reddit.getWikiPage(subredditName, "toolbox");
        } catch (error) {
            // This shouldn't happen if there are any Toolbox notes, but need to check.
            console.log("Error retrieving Toolbox configuration.");
            console.log(error);
            return [];
        }

        const toolboxConfig = JSON.parse(toolboxConfigPage.content) as RawSubredditConfig;

        const results = userNotes.map(userNote => ({
            noteSource: "Toolbox",
            moderatorUsername: userNote.moderatorUsername,
            text: userNote.text,
            timestamp: userNote.timestamp,
            username: userNote.username,
            contextPermalink: userNote.contextPermalink,
            noteType: getToolboxNoteTypeFromEnum(userNote.noteType, toolboxConfig.usernoteColors),
        }) as CombinedUserNote);

        return results;
    } catch {
        console.log("Failed to retrieve Toolbox usernotes. The Toolbox wiki page may not exist on this subreddit.");
        return [];
    }
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
