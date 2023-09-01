import { Devvit } from '@devvit/public-api';
import { isMod } from './utility.js';
import { createUserSummaryModmail } from './modmail.js';

Devvit.addSettings([
  {
    type: 'boolean',
    name: 'includeToolboxNotes',
    label: 'Include Toolbox usernotes in Modmail User Summary',
    helpText: 'If you do not use Toolbox usernotes, or have migrated away from them, including them in the modmail summary may be misleading.'
  },
  {
    type: 'number',
    name: 'numberOfCommentsToInclude',
    label: 'Number of recently removed comments to show in summary',
    defaultValue: 3,
    onValidate: async ({ value }) => {
      if (!value || value < 0 || value > 100) {
        return 'Value must be between 0 and 100';
      }
    }
  },
  {
    type: 'boolean',
    name: 'createSummaryForModerators',
    label: 'Create modmail summary when receiving modmail from subreddit moderators',
    defaultValue: false
  },
  {
    type: 'string',
    name: 'usernamesToIgnore',
    label: 'Do not create summaries for these users',
    helpText: 'Comma-separated, not case sensitive',
    defaultValue: 'Automoderator,ModSupportBot'
  },
  {
    type: 'select',
    name: 'localeForDateOutput',
    label: 'Format for date output',
    options: [
      {value: "en-GB", label: "date/month/year"},
      {value: "en-US", label: "month/date/year"},
      {value: "ja-JP", label: "year/month/date"}
    ]    
  }
]);

Devvit.addTrigger({
  event: 'ModMail',
  async onEvent(event, context) {

    console.log(`Received modmail trigger event:\n${JSON.stringify(event)}`);

    var conversationResponse = await context.reddit.modMail.getConversation({
      conversationId: event.conversationId
    });

    if (conversationResponse.conversation == undefined)
      return;
    if (!conversationResponse.conversation.numMessages || conversationResponse.conversation.numMessages > 1)
      return;
    
    if (!event.messageAuthor)
      return;

    const user = await context.reddit.getUserById(event.messageAuthor.id);
    const subReddit = await context.reddit.getSubredditById(context.subredditId);

    const usersToIgnore = await context.settings.get('usernamesToIgnore') as string | undefined;
    if (usersToIgnore)
    {
      const userList = usersToIgnore.split(',');
      if (userList.find(x => x.trim().toLowerCase() == user.username.toLowerCase()))
      {
        console.log(`User /u/${user.username} is on the ignore list, skipping`);
        return;
      }
    }

    const userIsMod = await isMod(subReddit, user.username)
    const createSummaryForModerators = await context.settings.get('createSummaryForModerators') as boolean | undefined;
    if (userIsMod && !createSummaryForModerators)
    {
        console.log(`${user.username} is a moderator of /r/${subReddit.name}, skipping`);
        return;
    }

    var modmailMessage = await createUserSummaryModmail(context, user, subReddit.name);

    await context.reddit.modMail.reply({
      body: modmailMessage,
      conversationId: event.conversationId,
      isInternal: true
    });
  }
});

Devvit.configure({
  redditAPI: true
})

export default Devvit;
