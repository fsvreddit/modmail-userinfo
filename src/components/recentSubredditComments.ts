import { Comment, SettingsFormField, SettingsValues, TriggerContext } from "@devvit/public-api";
import { getSubredditName } from "../utility.js";
import { differenceInDays, subDays } from "date-fns";
import pluralize from "pluralize";

enum RecentSubredditCommentSetting {
    EnableOption = "enableRecentSubredditComments",
    NumberOfDays = "recentSubredditCommentsDays",
}

export const settingsForRecentSubredditComments: SettingsFormField = {
    type: "group",
    label: "Recent comment count for your subreddit",
    fields: [
        {
            name: RecentSubredditCommentSetting.EnableOption,
            type: "boolean",
            label: "Enable output of recent subreddit comment counts",
            defaultValue: false,
        },
        {
            name: RecentSubredditCommentSetting.NumberOfDays,
            type: "number",
            label: "How many days to include data for",
            helpText: "Note: This app can only look back on the user's most recent 1000 comments.",
            defaultValue: 28,
        },
    ],
};

export async function getRecentSubredditCommentCount (userComments: Comment[], settings: SettingsValues, context: TriggerContext): Promise<string> {
    if (!settings[RecentSubredditCommentSetting.EnableOption]) {
        return "";
    }

    const numberOfDays = settings[RecentSubredditCommentSetting.NumberOfDays] as number | undefined;
    if (!numberOfDays) {
        return "";
    }

    const subredditComments = userComments.filter(comment => comment.subredditId === context.subredditId && comment.createdAt > subDays(new Date(), numberOfDays));

    const oldestComment = userComments[userComments.length - 1];
    const actualNumberOfDays = oldestComment.createdAt < subDays(new Date(), numberOfDays) ? numberOfDays : differenceInDays(new Date(), oldestComment.createdAt);

    const subredditName = await getSubredditName(context);
    let result = `**Recent comments on /r/${subredditName}**: ${subredditComments.length}`;

    if (actualNumberOfDays < numberOfDays) {
        result += ` (recent history only covers ${actualNumberOfDays} ${pluralize("day", actualNumberOfDays)})`;
    } else {
        result += ` in last ${numberOfDays} ${pluralize("day", numberOfDays)}`;
    }

    result += "\n\n";
    return result;
}
