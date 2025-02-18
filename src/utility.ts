import { Comment, Post, RedditAPIClient, TriggerContext } from "@devvit/public-api";
import { isCommentId, isLinkId, isSubredditId, T1ID, T3ID, T5ID } from "@devvit/shared-types/tid.js";

export async function getPostOrCommentFromRedditId (reddit: RedditAPIClient, redditId?: T1ID | T3ID | T5ID): Promise <Post | Comment | undefined> {
    if (!redditId || isSubredditId(redditId)) {
        return;
    } else if (isCommentId(redditId)) {
        return reddit.getCommentById(redditId);
    } else if (isLinkId(redditId)) {
        return reddit.getPostById(redditId);
    }
}

export async function userIsMod (username: string, context: TriggerContext): Promise<boolean> {
    const subredditName = await context.reddit.getCurrentSubredditName();
    const modList = await context.reddit.getModerators({ subredditName, username }).all();
    return (modList.length > 0);
}
