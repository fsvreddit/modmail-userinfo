import { Comment, SettingsFormField, SettingsValues, TriggerContext } from "@devvit/public-api";
import json2md from "json2md";
import { formatHeader } from "./componentHelpers.js";

enum ProportionOfSelfCommentsSetting {
    EnableFeature = "includeProportionOfSelfComments",
}

export const settingsForProportionOfSelfComments: SettingsFormField = {
    type: "group",
    label: "Proportion of self-comments settings",
    fields: [
        {
            type: "boolean",
            name: ProportionOfSelfCommentsSetting.EnableFeature,
            label: "Include proportion of self-comments in summary",
            defaultValue: false,
        },
    ],
};

export async function getProportionOfSelfComments (recentComments: Comment[], settings: SettingsValues, context: TriggerContext): Promise<json2md.DataObject[] | undefined> {
    if (!settings[ProportionOfSelfCommentsSetting.EnableFeature]) {
        return;
    }

    if (recentComments.length === 0) {
        return;
    }

    const userPosts = await context.reddit.getPostsByUser({
        username: recentComments[0].authorName,
        sort: "new",
        limit: 1000,
    }).all();

    const userPostIds = new Set(userPosts.map(post => post.id));

    const selfComments = recentComments.filter(comment => userPostIds.has(comment.postId));

    return [
        { p: `${formatHeader("Proportion of self-comments", settings)}: ${selfComments.length} out of ${recentComments.length} (${((selfComments.length / recentComments.length) * 100).toFixed(2)}%)` },
    ];
}
