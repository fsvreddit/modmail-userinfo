import { TriggerContext, User } from '@devvit/public-api';
import { formatDistanceToNow } from 'date-fns';
import { ToolboxClient } from 'toolbox-devvit';


export async function createUserSummaryModmail(context: TriggerContext, user: User, subredditName: string): Promise<string>
{
    console.log("About to create summary modmail");
    var modmailMessage = `Possible relevant information for ${user.username}:\n\n`;

    modmailMessage += `**Age**: ${formatDistanceToNow(user.createdAt)}\n\n`

    modmailMessage += `**Karma**: Post ${user.linkKarma}, Comment ${user.commentKarma}\n\n`;

    if (user.nsfw)
        modmailMessage += "**NSFW Account**: Yes\n\n";

    const userComments = await user.getComments({
        sort: "new",
        limit: 100
    }).all();

    var commentList = new Map<string, number>();

    for (var comment of userComments)
    {
        var currentCount = commentList.get(comment.subredditName);
        if (!currentCount)
            currentCount = 1;
        else
            currentCount += 1;
        
        commentList.set(comment.subredditName, currentCount);
    }

    if (commentList.size > 0)
    {
        modmailMessage += "**Recent Comments**:\n\n";
        for (const item of commentList)
        {
            modmailMessage += `* /r/${item[0]}: ${item[1]}\n`;
        }
        modmailMessage += "\n";
    }

    var locale = await context.settings.get('localeForDateOutput') as string | undefined;
    if (!locale)
        locale = "en-GB";

    var numberOfRemovedCommentsToInclude = await context.settings.get('numberOfCommentsToInclude') as number | undefined;
    if (!numberOfRemovedCommentsToInclude)
        numberOfRemovedCommentsToInclude = 3;

    if (numberOfRemovedCommentsToInclude > 0)
    {
        let foundCommentCount: number = 0;
        for (const comment of userComments.filter(x => x.removed && x.subredditName == subredditName))
        {
            if (foundCommentCount < numberOfRemovedCommentsToInclude)
            {
                if (foundCommentCount == 0)
                modmailMessage += "**Recently removed comments**:\n\n"

                modmailMessage += `[${comment.createdAt.toLocaleDateString(locale)}](${comment.permalink}):\n\n`
                modmailMessage += `> ${comment.body.split("\n").join("\n> ")}\n\n`; // string.replaceAll not available without es2021

                foundCommentCount++;
            }
        }

        if (foundCommentCount > 0)
        modmailMessage += "---\n\n";
    }

    const shouldIncludeUsernotes = await context.settings.get('includeToolboxNotes') as boolean | undefined;
    if (shouldIncludeUsernotes)
    {
        const toolbox = new ToolboxClient(context.reddit);
        var userNotes = await toolbox.getUsernotesOnUser(subredditName, user.username);
        if (userNotes && userNotes.length > 0)
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
      
    console.log(modmailMessage);

    return modmailMessage;
}