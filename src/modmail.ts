import { Context, User } from '@devvit/public-api';
import { ToolboxClient } from 'toolbox-devvit';
import { formatAccountAgeForDisplay } from './utility.js';


export async function createUserSummaryModmail(context: Context, user: User, subredditName: string): Promise<string>
{
    console.log("About to create summary modmail");
    var modmailMessage = `Possible relevant information for ${user.username}:\r\n\r\n`;

    const accountAge = Math.round(Math.abs(new Date().getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    modmailMessage += `**Age**: ${formatAccountAgeForDisplay(accountAge)}\r\n\r\n`;

    modmailMessage += `**Karma**: Post ${user.linkKarma}, Comment ${user.commentKarma}\r\n\r\n`;

    if (user.nsfw)
        modmailMessage += "**NSFW Account**: Yes\r\n\r\n";

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
        modmailMessage += "**Recent Comments**:\r\n\r\n";
        for (const item of commentList)
        {
            modmailMessage += `* /r/${item[0]}: ${item[1]}\r\n`;
        }
        modmailMessage += "\r\n";
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
                modmailMessage += "**Recently removed comments**:\r\n\r\n"

                modmailMessage += `[${comment.createdAt.toLocaleDateString(locale)}](${comment.permalink}):\r\n\r\n`
                modmailMessage += `> ${comment.body}\r\n\r\n`;

                foundCommentCount++;
            }
        }

        if (foundCommentCount > 0)
        modmailMessage += "---\r\n\r\n";
    }

    const shouldIncludeUsernotes = await context.settings.get('includeToolboxNotes') as boolean | undefined;
    if (shouldIncludeUsernotes)
    {
        const toolbox = new ToolboxClient(context.reddit);
        var userNotes = await toolbox.getUsernotesOnUser(subredditName, user.username);
        if (userNotes && userNotes.length > 0)
        {
            modmailMessage += "**Toolbox Usernotes**:\r\n\r\n";
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

                modmailMessage += `* ${modnote}\r\n`;
            }
            modmailMessage += "\r\n";
        }
    }
      
    console.log(modmailMessage);

    return modmailMessage;
}