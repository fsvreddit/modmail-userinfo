import { ModNote, SettingsFormField, SettingsValues, TriggerContext, User } from "@devvit/public-api";
import { format } from "date-fns";
import json2md from "json2md";
import { formatHeader } from "./componentHelpers.js";
import { isT3ID, isT5ID, T1ID, T3ID, T5ID } from "@devvit/public-api/types/tid.js";

enum ModLogSetting {
    EnableOption = "enableModLog",
    ModLogEntries = "modLogEntries",
}

export const settingsForModLog: SettingsFormField = {
    type: "group",
    label: "Mod Log settings",
    fields: [
        {
            name: ModLogSetting.EnableOption,
            type: "boolean",
            label: "Enable mod log entries in the summary",
            defaultValue: false,
        },
        {
            name: ModLogSetting.ModLogEntries,
            type: "number",
            label: "Number of mod log entries to include",
            defaultValue: 5,
        },
    ],
};

async function formatModLogEntry (entry: ModNote, context: TriggerContext): Promise<string | undefined> {
    let action: string;
    let target: T1ID | T3ID | T5ID | undefined;
    switch (entry.type) {
        case "APPROVAL":
            action = "approved";
            target = entry.userNote?.redditId;
            break;
        case "REMOVAL":
            action = "removed";
            target = entry.userNote?.redditId;
            break;
        case "BAN":
            action = "banned user";
            break;
        case "INVITE":
            action = "invited as a moderator";
            break;
        case "MUTE":
            action = "muted user";
            break;
        case "SPAM":
            action = "marked as spam";
            break;
        default:
            return;
    }

    if (isT5ID(target)) {
        return;
    }

    if (entry.operator.name) {
        action = `u/${entry.operator.name} ${action}`;
    }

    if (target) {
        if (isT3ID(target)) {
            action += ` a [post](https://reddit.com/comments/${target.substring(3)})`;
        } else {
            const comment = await context.reddit.getCommentById(target);
            action += ` a [comment](${comment.permalink})`;
        }
    }

    return `${format(entry.createdAt, "yyyy-MM-dd HH:mm")} UTC - ${action}`;
}

export async function getModLogEntries (user: User, settings: SettingsValues, context: TriggerContext): Promise<json2md.DataObject | undefined> {
    if (!settings[ModLogSetting.EnableOption]) {
        return;
    }

    const numberOfEntries = settings[ModLogSetting.ModLogEntries] as number | undefined ?? 5;

    const modNotes = await context.reddit.getModNotes({
        subreddit: context.subredditName ?? await context.reddit.getCurrentSubredditName(),
        user: user.username,
        limit: 1000,
    }).all();

    const filteredEntries = modNotes.filter(entry => entry.type !== "NOTE").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filteredEntries.length === 0) {
        return;
    }

    const entries: string[] = [];
    for (const entry of filteredEntries) {
        if (entries.length >= numberOfEntries) {
            break;
        }

        const formattedEntry = await formatModLogEntry(entry, context);
        if (formattedEntry) {
            entries.push(formattedEntry);
        }
    }

    if (entries.length === 0) {
        return;
    }

    const header = formatHeader("Recent mod log entries", settings);
    return [
        { p: header },
        { ul: entries },
    ];
}
