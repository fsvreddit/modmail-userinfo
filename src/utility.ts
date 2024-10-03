import { Comment, Post, RedditAPIClient } from "@devvit/public-api";
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
