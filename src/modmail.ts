import {Comment, ModNote, Post, TriggerContext, User} from "@devvit/public-api";
import {formatDistanceToNow} from "date-fns";
import {ToolboxClient} from "toolbox-devvit";

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

    const shouldIncludeNativeUsernotes = await context.settings.get<boolean>("includeNativeNotes");
    if (shouldIncludeNativeUsernotes) {
        let modNotes: ModNote[] | undefined;
        console.log("Getting native notes");
        try {
            modNotes = await context.reddit.getModNotes({
                subreddit: subredditName,
                user: user.username,
                filter: "NOTE",
            }).all();
        } catch (error) {
            console.log(error); // Currently, this may crash if there are any notes without a permalink
            modmailMessage += "**Reddit user notes**: Unable to retrieve user notes";
        }

        console.log("Got native usernotes");

        if (modNotes && modNotes.length > 0) {
            modmailMessage += "**Reddit user notes**:\n\n";

            for (const note of modNotes.filter(note => note.userNote)) {
                console.log(note);
                if (!note.userNote || !note.userNote.note) {
                    continue;
                }

                let noteText = "";
                const labelText = getRedditNoteTypeFromEnum(note.userNote.label);
                if (labelText && labelText !== "") {
                    noteText = `[${labelText}] `;
                }

                const noteTarget = await getPostOrCommentFromRedditId(context, note.userNote.redditId);
                if (noteTarget) {
                    noteText += `[${note.userNote.note}](${noteTarget.permalink})`;
                } else {
                    noteText += note.userNote.note;
                }

                noteText += ` by ${note.operator.name ?? "unknown"} on ${note.createdAt.toLocaleDateString(locale)}`;
                console.log(noteText);

                modmailMessage += `* ${noteText}\n`;
            }
            modmailMessage += "\n";
        }
    }

    const shouldIncludeToolboxUsernotes = await context.settings.get<boolean>("includeToolboxNotes");
    if (shouldIncludeToolboxUsernotes) {
        const toolbox = new ToolboxClient(context.reddit);
        try {
            const userNotes = await toolbox.getUsernotesOnUser(subredditName, user.username);
            if (userNotes.length > 0) {
                modmailMessage += "**Toolbox Usernotes**:\n\n";
                for (const note of userNotes) {
                    let modnote = "";
                    const noteType = getToolboxNoteTypeFromEnum(note.noteType);
                    if (noteType) {
                        modnote += `[${noteType}] `;
                    }

                    if (note.contextPermalink && note.contextPermalink !== "") {
                        modnote += `[${note.text}](${note.contextPermalink})`;
                    } else {
                        modnote += note.text;
                    }

                    modnote += ` by ${note.moderatorUsername} on ${note.timestamp.toLocaleDateString(locale)}`;

                    modmailMessage += `* ${modnote}\n`;
                }
                modmailMessage += "\n";
            }
        } catch (e) {
            console.log("Failed to retrieve Toolbox usernotes. The Toolbox wiki page may not exist on this subreddit.");
        }
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

async function getPostOrCommentFromRedditId (context: TriggerContext, redditId: `t5_${string}` | `t1_${string}` | `t3_${string}` | undefined): Promise <Post | Comment | undefined> {
    if (!redditId || redditId.startsWith("t5")) {
        return;
    } else if (redditId.startsWith("t1")) {
        // Comment
        return context.reddit.getCommentById(redditId);
    } else if (redditId.startsWith("t3")) {
        // Post
        return context.reddit.getPostById(redditId);
    }
}
