import {Comment, ModNote, Post, RedditAPIClient, TriggerContext, User} from "@devvit/public-api";
import {formatDistanceToNow} from "date-fns";
import {ToolboxClient, Usernote} from "toolbox-devvit";

interface CombinedUserNote extends Usernote {
    noteSource: "Reddit" | "Toolbox"
}

export async function createUserSummaryModmail (context: TriggerContext, user: User, subredditName: string): Promise<string> {
    console.log("About to create summary modmail");
    let modmailMessage = `Possible relevant information for /u/${user.username}:\n\n`;

    modmailMessage += `**Age**: ${formatDistanceToNow(user.createdAt)}\n\n`;

    modmailMessage += `**Sitewide Karma**: Post ${user.linkKarma}, Comment ${user.commentKarma}\n\n`;

    if (user.nsfw) {
        modmailMessage += "**NSFW Account**: Yes\n\n";
    }

    const userComments = await user.getComments({
        sort: "new",
        limit: 100,
    }).all();

    // Build up a list of subreddits and the count of comments in those subreddits
    let commentList: Array<{subName: string, commentCount: number}> = [];
    for (const comment of userComments) {
        const item = commentList.find(x => x.subName === comment.subredditName);
        if (item) {
            // Item already in array - increment
            item.commentCount++;
        } else {
            // First comment for this subreddit - insert new item into array
            commentList.push({
                subName: comment.subredditName,
                commentCount: 1,
            });
        }
    }

    const numberOfSubsToReportOn = await context.settings.get<number>("numberOfSubsToIncludeInSummary") ?? 10;

    commentList = commentList
        .sort((a, b) => b.commentCount - a.commentCount) // Sort descending...
        .slice(0, numberOfSubsToReportOn); // Then take top N entries

    if (commentList.length > 0) {
        const subHistoryDisplayStyle = await context.settings.get<string>("subHistoryDisplayStyle") ?? "bullet";
        modmailMessage += "**Recent Comments**: ";
        if (subHistoryDisplayStyle === "bullet") {
            modmailMessage += "\n\n";
        }

        for (const item of commentList) {
            if (subHistoryDisplayStyle === "bullet") {
                modmailMessage += `* /r/${item.subName}: ${item.commentCount}\n`;
            } else {
                modmailMessage += `/r/${item.subName} (${item.commentCount}), `;
            }
        }

        if (subHistoryDisplayStyle === "bullet") {
            modmailMessage += "\n";
        } else {
            // Remove trailing comma, add newlines
            modmailMessage = `${modmailMessage.substring(0, modmailMessage.length - 2)}\n\n`;
        }
    }

    const locale = await context.settings.get<string>("localeForDateOutput") ?? "en-GB";

    const numberOfRemovedCommentsToInclude = await context.settings.get<number>("numberOfCommentsToInclude") ?? 3;

    if (numberOfRemovedCommentsToInclude > 0) {
        const filteredComments = userComments
            .filter(x => x.removed && x.subredditName === subredditName)
            .slice(0, numberOfRemovedCommentsToInclude);

        if (filteredComments.length > 0) {
            modmailMessage += "**Recently removed comments**:\n\n";

            for (const comment of filteredComments) {
                modmailMessage += `[${comment.createdAt.toLocaleDateString(locale)}](${comment.permalink}):\n\n`;
                modmailMessage += `> ${comment.body.split("\n").join("\n> ")}\n\n`; // string.replaceAll not available without es2021
            }

            modmailMessage += "---\n\n";
        }
    }

    const combinedNotesRetriever: Promise<(CombinedUserNote | undefined)[]>[] = [];

    const shouldIncludeNativeUsernotes = await context.settings.get<boolean>("includeNativeNotes");
    if (shouldIncludeNativeUsernotes) {
        combinedNotesRetriever.push(getRedditModNotesAsUserNotes(context.reddit, subredditName, user.username));
    }

    const shouldIncludeToolboxUsernotes = await context.settings.get<boolean>("includeToolboxNotes");
    if (shouldIncludeNativeUsernotes) {
        combinedNotesRetriever.push(getToolboxNotesAsUserNotes(context.reddit, subredditName, user.username));
    }

    const notesResults = await Promise.all(combinedNotesRetriever);
    const allUserNotes: CombinedUserNote[] = [];

    for (const resultSet of notesResults) {
        for (const item of resultSet) {
            if (item) {
                allUserNotes.push(item);
            }
        }
    }

    if (allUserNotes.length > 0) {
        allUserNotes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        modmailMessage += "**User Notes**:\n\n";

        for (const note of allUserNotes) {
            let modnote = "";
            if (note.noteType) {
                modnote += `[${note.noteType}] `;
            }

            if (note.contextPermalink && note.contextPermalink !== "") {
                modnote += `[${note.text}](${note.contextPermalink})`;
            } else {
                modnote += note.text;
            }

            modnote += ` by ${note.moderatorUsername} on ${note.timestamp.toLocaleDateString(locale)}`;

            if (shouldIncludeNativeUsernotes && shouldIncludeToolboxUsernotes) {
                // Include whether these are Toolbox or Native notes, if both are configured.
                modnote += ` (${note.noteSource})`;
            }

            modmailMessage += `* ${modnote}\n`;
        }
        modmailMessage += "\n";
    }

    console.log(modmailMessage);

    return modmailMessage;
}

function getRedditNoteTypeFromEnum (noteType: string | undefined): string | undefined {
    const noteTypes = [
        {key: "BOT_BAN", text: "Bot Ban"},
        {key: "PERMA_BAN", text: "Permaban"},
        {key: "BAN", text: "Ban"},
        {key: "ABUSE_WARNING", text: "Abuse Warning"},
        {key: "SPAM_WARNING", text: "Spam Warning"},
        {key: "SPAM_WATCH", text: "Spam Watch"},
        {key: "SOLID_CONTRIBUTOR", text: "Solid Contributor"},
        {key: "HELPFUL_USER", text: "Helpful"},
    ];

    const result = noteTypes.find(x => x.key === noteType);
    if (result) {
        return result.text;
    }
}

function getToolboxNoteTypeFromEnum (noteType: string | undefined): string | undefined {
    const noteTypes = [
        {key: "gooduser", text: "Good Contributor"},
        {key: "spamwatch", text: "Spam Watch"},
        {key: "spamwarn", text: "Spam Warning"},
        {key: "abusewarn", text: "Abuse Warning"},
        {key: "ban", text: "Ban"},
        {key: "permban", text: "Permanent Ban"},
        {key: "botban", text: "Bot Ban"},
    ];

    const result = noteTypes.find(x => x.key === noteType);
    if (result) {
        return result.text;
    }
}

async function getPostOrCommentFromRedditId (reddit: RedditAPIClient, redditId: `t5_${string}` | `t1_${string}` | `t3_${string}` | undefined): Promise <Post | Comment | undefined> {
    if (!redditId || redditId.startsWith("t5")) {
        return;
    } else if (redditId.startsWith("t1")) {
        // Comment
        return reddit.getCommentById(redditId);
    } else if (redditId.startsWith("t3")) {
        // Post
        return reddit.getPostById(redditId);
    }
}

async function getUserNoteFromRedditModNote (reddit: RedditAPIClient, modNote: ModNote): Promise<CombinedUserNote | undefined> {
    // Function to transform a Reddit mod note into the Toolbox Usernote format, for ease of handling.
    if (!modNote.userNote || !modNote.userNote.note) {
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

async function getRedditModNotesAsUserNotes (reddit: RedditAPIClient, subredditName: string, userName: string): Promise<(CombinedUserNote | undefined)[]> {
    try {
        const modNotes = await reddit.getModNotes({
            subreddit: subredditName,
            user: userName,
            filter: "NOTE",
        }).all();

        const results = await Promise.all(modNotes.map(modNote => getUserNoteFromRedditModNote(reddit, modNote)));
        console.log(`Native mod notes found: ${results.length}`);
        return results;
    } catch (error) {
        console.log(error); // Currently, this may crash if there are any notes without a permalink
        return [];
    }
}

async function getUserNoteFromToolboxUserNote (userNote: Usernote): Promise<CombinedUserNote> {
    return {
        noteSource: "Toolbox",
        moderatorUsername: userNote.moderatorUsername,
        text: userNote.text,
        timestamp: userNote.timestamp,
        username: userNote.username,
        contextPermalink: userNote.contextPermalink,
        noteType: getToolboxNoteTypeFromEnum(userNote.noteType),
    };
}

async function getToolboxNotesAsUserNotes (reddit: RedditAPIClient, subredditName: string, userName: string): Promise<CombinedUserNote[]> {
    const toolbox = new ToolboxClient(reddit);
    try {
        const userNotes = await toolbox.getUsernotesOnUser(subredditName, userName);
        const results = await Promise.all(userNotes.map(userNote => getUserNoteFromToolboxUserNote(userNote)));
        console.log(`Toolbox notes found: ${results.length}`);
        return results;
    } catch (e) {
        console.log("Failed to retrieve Toolbox usernotes. The Toolbox wiki page may not exist on this subreddit.");
        return [];
    }
}
