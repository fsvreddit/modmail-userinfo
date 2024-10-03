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

export async function getSubredditName (context: TriggerContext): Promise<string> {
    if (context.subredditName) {
        return context.subredditName;
    }

    // This shouldn't happen, but add a fallback just in case.
    return (await context.reddit.getCurrentSubreddit()).name;
}
