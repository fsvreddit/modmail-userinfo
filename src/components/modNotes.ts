import { ModNote, RedditAPIClient, SettingsFormField, SettingsValues, TriggerContext, WikiPage } from "@devvit/public-api";
import { RawSubredditConfig, RawUsernoteType } from "toolbox-devvit/dist/types/RawSubredditConfig.js";
import { GeneralSetting } from "../settings.js";
import { ToolboxClient, Usernote } from "toolbox-devvit";
import { getPostOrCommentFromRedditId, getSubredditName } from "../utility.js";
import _ from "lodash";
import markdownEscape from "markdown-escape";

enum ModNotesSetting {
    IncludeNativeNotes = "includeNativeNotes",
    IncludeToolboxNotes = "includeToolboxNotes",
}

export const settingsForModNotes: SettingsFormField = {
    type: "group",
    label: "Mod Notes",
    fields: [
        {
            type: "boolean",
            name: ModNotesSetting.IncludeNativeNotes,
            label: "Include native Reddit mod notes in Modmail User Summary",
            helpText: "If you do not use Reddit's native usernotes, including them may be misleading.",
            defaultValue: false,
        },
        {
            type: "boolean",
            name: ModNotesSetting.IncludeToolboxNotes,
            label: "Include Toolbox usernotes in Modmail User Summary",
            helpText: "If you do not use Toolbox usernotes, or have migrated away from them, including them in the modmail summary may be misleading.",
            defaultValue: false,
        },
    ],
};

interface CombinedUserNote extends Usernote {
    noteSource: "Reddit" | "Toolbox";
}

export async function getModNotes (username: string, settings: SettingsValues, context: TriggerContext): Promise<string | undefined> {
    const combinedNotesRetriever: Promise<CombinedUserNote[]>[] = [];

    const subredditName = await getSubredditName(context);

    const shouldIncludeNativeUsernotes = settings[ModNotesSetting.IncludeNativeNotes] as boolean | undefined ?? false;
    if (shouldIncludeNativeUsernotes) {
        combinedNotesRetriever.push(getRedditModNotesAsUserNotes(context.reddit, subredditName, username));
    }

    const shouldIncludeToolboxUsernotes = settings[ModNotesSetting.IncludeToolboxNotes] as boolean | undefined ?? false;
    if (shouldIncludeToolboxUsernotes) {
        combinedNotesRetriever.push(getToolboxNotesAsUserNotes(context.reddit, subredditName, username));
    }

    const notesResults = await Promise.all(combinedNotesRetriever);
    const allUserNotes = _.flatten(notesResults);

    if (allUserNotes.length === 0) {
        return;
    }

    const [locale] = settings[GeneralSetting.LocaleForDateOutput] as string[] | undefined ?? ["en-US"];

    allUserNotes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    let result = "**User notes**:\n\n";

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

        result += `* ${modnote}\n`;
    }
    result += "\n";

    return result;
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
