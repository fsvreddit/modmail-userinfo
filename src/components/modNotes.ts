import { ModNote, RedditAPIClient, SettingsFormField, SettingsValues, TriggerContext, UserNoteLabel } from "@devvit/public-api";
import { GeneralSetting } from "../settings.js";
import { ToolboxClient, Usernote } from "toolbox-devvit";
import { getPostOrCommentFromRedditId } from "../utility.js";
import _ from "lodash";
import markdownEscape from "markdown-escape";
import json2md from "json2md";

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

function formatNote (note: CombinedUserNote, locale: string, includeSource: boolean): string {
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

    if (includeSource) {
        // Include whether these are Toolbox or Native notes, if both are configured.
        modnote += ` (${note.noteSource})`;
    }

    return `* ${modnote}`;
}

export async function getModNotes (username: string, settings: SettingsValues, context: TriggerContext): Promise<json2md.DataObject[] | undefined> {
    const combinedNotesRetriever: Promise<CombinedUserNote[]>[] = [];

    const subredditName = await context.reddit.getCurrentSubredditName();

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

    const includeSource = shouldIncludeNativeUsernotes && shouldIncludeToolboxUsernotes;
    const result: json2md.DataObject[] = [
        { p: shouldIncludeNativeUsernotes ? "**Mod notes**:" : "**User notes**:" },
        { ul: allUserNotes.map(note => formatNote(note, locale, includeSource)) },
    ];

    return result;
}

function getRedditNoteTypeFromEnum (noteType: UserNoteLabel | undefined): string | undefined {
    const noteTypes: Record<UserNoteLabel, string> = {
        BOT_BAN: "Bot Ban",
        PERMA_BAN: "Permaban",
        BAN: "Ban",
        ABUSE_WARNING: "Abuse Warning",
        SPAM_WARNING: "Spam Warning",
        SPAM_WATCH: "Spam Watch",
        SOLID_CONTRIBUTOR: "Solid Contributor",
        HELPFUL_USER: "Helpful",
    };

    if (noteType) {
        return noteTypes[noteType];
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
        let modNotes = await reddit.getModNotes({
            subreddit: subredditName,
            user: userName,
            filter: "NOTE",
        }).all();

        // Filter out automatic "Unbanned" notes
        const regex = /^Unbanned on \d{4}(?:-\d{2}){2}$/;
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        modNotes = modNotes.filter(note => note.userNote?.redditId || !regex.test(note.userNote?.note ?? ""));

        const results = await Promise.all(modNotes.map(modNote => getUserNoteFromRedditModNote(reddit, modNote)));
        return _.compact(results);
    } catch (error) {
        console.log(error); // This shouldn't happen any more.
        return [];
    }
}

async function getToolboxNotesAsUserNotes (reddit: RedditAPIClient, subredditName: string, userName: string): Promise<CombinedUserNote[]> {
    const toolbox = new ToolboxClient(reddit);
    try {
        const userNotes = await toolbox.getUsernotesOnUser(subredditName, userName);

        if (userNotes.length === 0) {
            return [];
        }

        const config = await toolbox.getConfig(subredditName);
        const noteTypes = _.fromPairs(config.getAllNoteTypes().map(item => [item.key, item.text]));

        const results = userNotes.map(userNote => ({
            noteSource: "Toolbox",
            moderatorUsername: userNote.moderatorUsername,
            text: userNote.text,
            timestamp: userNote.timestamp,
            username: userNote.username,
            contextPermalink: userNote.contextPermalink,
            noteType: userNote.noteType ? noteTypes[userNote.noteType] : undefined,
        }) as CombinedUserNote);

        return results;
    } catch {
        console.log("Failed to retrieve Toolbox usernotes. The Toolbox wiki page may not exist on this subreddit.");
        return [];
    }
}
