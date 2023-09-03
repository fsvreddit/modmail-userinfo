import { Subreddit } from "@devvit/public-api";

export async function isMod(subReddit: Subreddit, userName: string): Promise<boolean>
{
    const modCheck = await subReddit.getModerators({
        username: userName
      }).all();

    return (modCheck && modCheck.length > 0);
}