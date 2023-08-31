import { Devvit } from '@devvit/public-api';
import { isMod } from './utility.js';
import { createUserSummaryModmail } from './modmail.js';

Devvit.addSettings([
  {
    type: 'boolean',
    name: 'includeToolboxNotes',
    label: 'Include Toolbox usernotes in Modmail User Summary'
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
    label: 'Create modmail summary for subreddit moderators',
    defaultValue: false
  },
  {
    type: 'select',
    name: 'localeForDateOutput',
    label: 'Locale for date output',
    options: [
      {value: "ar-SA", label: "Arabic (Saudi Arabia)"},
      {value: "bn-BD", label: "Bangla (Bangladesh)"},
      {value: "bn-IN", label: "Bangla (India)"},
      {value: "cs-CZ", label: "Czech (Czech Republic)"},
      {value: "da-DK", label: "Danish (Denmark)"},
      {value: "de-AT", label: "German (Austria)"},
      {value: "de-CH", label: "German (Swiss)"},
      {value: "de-DE", label: "German (standard German)"},
      {value: "el-GR", label: "Modern Greek"},
      {value: "en-AU", label: "English (Australia)"},
      {value: "en-CA", label: "English (Canada)"},
      {value: "en-GB", label: "English (British)"},
      {value: "en-IE", label: "English (Ireland)"},
      {value: "en-IN", label: "English (India)"},
      {value: "en-NZ", label: "English (New Zealand)"},
      {value: "en-US", label: "English (US)"},
      {value: "en-ZA", label: "English (South Africa)"},
      {value: "es-AR", label: "Spanish (Argentina)"},
      {value: "es-CL", label: "Spanish (Chile)"},
      {value: "es-CO", label: "Spanish (Colombia)"},
      {value: "es-ES", label: "Spanish (Castilian)"},
      {value: "es-MX", label: "Spanish (Mexico)"},
      {value: "es-US", label: "Spanish (American)"},
      {value: "fa-IR", label: "Iranian (Iran)"},
      {value: "fi-FI", label: "Finnish (Finland)"},
      {value: "fr-BE", label: "French (Belgium)"},
      {value: "fr-CA", label: "French (Canadian)"},
      {value: "fr-CH", label: "French (Swiss)"},
      {value: "fr-FR", label: "French (standard French)"},
      {value: "he-IL", label: "Hebrew (Israel)"},
      {value: "hi-IN", label: "Hindi (India)"},
      {value: "hu-HU", label: "Hungarian (Hungary)"},
      {value: "id-ID", label: "Indonesian (Indonesia)"},
      {value: "it-CH", label: "Italian (Swiss)"},
      {value: "it-IT", label: "Italian (standard Italian)"},
      {value: "ja-JP", label: "Japanese (Japan)"},
      {value: "ko-KR", label: "Korean (Republic of Korea)"},
      {value: "nl-BE", label: "Belgian Dutch"},
      {value: "nl-NL", label: "Standard Dutch (as spoken in The Netherlands)"},
      {value: "no-NO", label: "Norwegian (Norway)"},
      {value: "pl-PL", label: "Polish (Poland)"},
      {value: "pt-BR", label: "Brazilian Portuguese"},
      {value: "pt-PT", label: "European Portuguese (as written and spoken in Portugal)"},
      {value: "ro-RO", label: "Romanian (Romania)"},
      {value: "ru-RU", label: "Russian (Russian Federation)"},
      {value: "sk-SK", label: "Slovak (Slovakia)"},
      {value: "sv-SE", label: "Swedish (Sweden)"},
      {value: "ta-IN", label: "Indian Tamil"},
      {value: "ta-LK", label: "Sri Lankan Tamil"},
      {value: "th-TH", label: "Thai (Thailand)"},
      {value: "tr-TR", label: "Turkish (Turkey)"},
      {value: "zh-CN", label: "Mainland China, simplified characters"},
      {value: "zh-HK", label: "Hong Kong, traditional characters"},
      {value: "zh-TW", label: "Taiwan, traditional characters"}
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
