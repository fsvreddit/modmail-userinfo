import { TriggerContext, User } from '@devvit/public-api';
import { formatDistanceToNow } from 'date-fns';
import { ToolboxClient } from 'toolbox-devvit';


export async function createUserSummaryModmail(context: TriggerContext, user: User, subredditName: string): Promise<string>
{
    console.log("About to create summary modmail");
    var modmailMessage = `Possible relevant information for /u/${user.username}:\n\n`;

    modmailMessage += `**Age**: ${formatDistanceToNow(user.createdAt)}\n\n`

    modmailMessage += `**Karma**: Post ${user.linkKarma}, Comment ${user.commentKarma}\n\n`;

    if (user.nsfw)
        modmailMessage += "**NSFW Account**: Yes\n\n";

    const userComments = await user.getComments({
        sort: "new",
        limit: 100
    }).all();

    // Build up a list of subreddits and the count of comments in those subreddits
    var commentList = new Array<{subName: string, commentCount: number}>;
    for (var comment of userComments)
    {
        var item = commentList.find(x => x.subName == comment.subredditName);
        if (item)
        {
            // Item already in array - increment
            item.commentCount++;
        }
        else
        {
            // First comment for this subreddit - insert new item into array
            commentList.push({
                subName: comment.subredditName,
                commentCount: 1
            });
        }
    }

    var numberOfSubsToReportOn = await context.settings.get<number>('numberOfSubsToIncludeInSummary');
    if (!numberOfSubsToReportOn)
        numberOfSubsToReportOn = 10;

    commentList = commentList
        .sort((a, b) => b.commentCount - a.commentCount) // Sort descending...
        .slice(0, numberOfSubsToReportOn); // Then take top N entries

    if (commentList.length > 0)
    {
        const subHistoryDisplayStyle = await context.settings.get<string>('subHistoryDisplayStyle') ?? 'bullet';
        modmailMessage += "**Recent Comments**: ";
        if (subHistoryDisplayStyle == 'bullet') {
            modmailMessage += "\n\n";
        }
        
        for (const item of commentList)
        {
            if (subHistoryDisplayStyle == 'bullet') {
                modmailMessage += `* /r/${item.subName}: ${item.commentCount}\n`;
            } else {
                modmailMessage += `/r/${item.subName} (${item.commentCount}), `;
            }
        }
        if (subHistoryDisplayStyle == 'bullet') {
            modmailMessage += "\n";
        } else {
            // Remove trailing comma, add newlines
            modmailMessage = modmailMessage.substring(0, modmailMessage.length - 2) + "\n\n";
        }
    }

    var locale = await context.settings.get<string>('localeForDateOutput');
    if (!locale)
        locale = "en-GB";

    var numberOfRemovedCommentsToInclude = await context.settings.get<number>('numberOfCommentsToInclude');
    if (!numberOfRemovedCommentsToInclude)
        numberOfRemovedCommentsToInclude = 3;

    if (numberOfRemovedCommentsToInclude > 0)
    {
        const filteredComments = userComments
            .filter(x => x.removed && x.subredditName == subredditName)
            .slice(0, numberOfRemovedCommentsToInclude);

        if (filteredComments.length > 0)
        {
            modmailMessage += "**Recently removed comments**:\n\n";

            for (const comment of filteredComments)
            {
                modmailMessage += `[${comment.createdAt.toLocaleDateString(locale)}](${comment.permalink}):\n\n`
                modmailMessage += `> ${comment.body.split("\n").join("\n> ")}\n\n`; // string.replaceAll not available without es2021
            }

            modmailMessage += "---\n\n";
        }
    }

    const shouldIncludeUsernotes = await context.settings.get<boolean>('includeToolboxNotes');
    if (shouldIncludeUsernotes)
    {
        const toolbox = new ToolboxClient(context.reddit);
        try
        {
            var userNotes = await toolbox.getUsernotesOnUser(subredditName, user.username);
            if (userNotes.length > 0)
            {
                modmailMessage += "**Toolbox Usernotes**:\n\n";
                for (const note of userNotes)        
                {
                    var modnote = "";
                    if (note.noteType && note.noteType != "")
                        modnote += `[${note.noteType}] `;

                    if (note.contextPermalink && note.contextPermalink != "")
                    {
                        modnote += `[${note.text}](${note.contextPermalink})`
                    }
                    else
                    {
                        modnote += note.text;
                    }

                    modnote += ` by ${note.moderatorUsername} on ${note.timestamp.toLocaleDateString(locale)}`;

                    modmailMessage += `* ${modnote}\n`;
                }
                modmailMessage += "\n";
            }
        }
        catch(e)
        {
            console.log("Failed to retrieve Toolbox usernotes. The Toolbox wiki page may not exist on this subreddit.")
        }
    }
      
    console.log(modmailMessage);

    return modmailMessage;
}