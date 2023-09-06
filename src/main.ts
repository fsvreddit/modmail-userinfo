import { Devvit, ModMailConversationState, User } from '@devvit/public-api';
import { createUserSummaryModmail } from './modmail.js';

Devvit.addSettings([
  {
    type: 'boolean',
    name: 'includeToolboxNotes',
    label: 'Include Toolbox usernotes in Modmail User Summary',
    helpText: 'If you do not use Toolbox usernotes, or have migrated away from them, including them in the modmail summary may be misleading.',
    defaultValue: false
  },
  {
    type: 'number',
    name: 'numberOfSubsToIncludeInSummary',
    label: 'Number of subreddits to include in comment summary',
    helpText: 'Limit the number of subreddits listed to this number. If a user participates in lots of subreddits, a large number might be distracting',
    defaultValue: 10,
    onValidate: async ({ value }) => {
      if (!value || value < 0 || value > 100) {
        return 'Value must be between 0 and 100';
      }
    }
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
    ],
    onValidate: async ({ value }) => {
      if (!value)
        "You must select a date format"
    }
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

    if (!conversationResponse.conversation.participant || !conversationResponse.conversation.participant.name)
      return;
    
    // Check to see if conversation is already archived e.g. from a ban message
    var conversationIsArchived = (conversationResponse.conversation.state == ModMailConversationState.Archived);

    // Get the details of the user who is the "participant" (i.e. the subject of the modmail, even if they aren't the OP)
    const user = await context.reddit.getUserByUsername(conversationResponse.conversation.participant.name);
    const subReddit = await context.reddit.getSubredditById(context.subredditId);

    // Check if user is on the ignore list.
    const usersToIgnore = await context.settings.get<string>('usernamesToIgnore');
    if (usersToIgnore)
    {
      const userList = usersToIgnore.split(',');
      if (userList.some(x => x.trim().toLowerCase() == user.username.toLowerCase()))
      {
        console.log(`User /u/${user.username} is on the ignore list, skipping`);
        return;
      }
    }

    // Check if user is a mod, and if app is configured to send summaries for mods
    const createSummaryForModerators = await context.settings.get<boolean>('createSummaryForModerators');
    if (conversationResponse.conversation.participant.isMod && !createSummaryForModerators)
    {
        console.log(`${user.username} is a moderator of /r/${subReddit.name}, skipping`);
        return;
    }

    // All checks passed. Retrieve text for modmail summary.
    const modmailMessage = await createUserSummaryModmail(context, user, subReddit.name);

    await context.reddit.modMail.reply({
      body: modmailMessage,
      conversationId: event.conversationId,
      isInternal: true
    });

    // If conversation was previously archived (e.g. a ban) archive it again.
    if (conversationIsArchived)
    {
      await context.reddit.modMail.archiveConversation(event.conversationId);
    }
  }
});

Devvit.configure({
  redditAPI: true
});

export default Devvit;
