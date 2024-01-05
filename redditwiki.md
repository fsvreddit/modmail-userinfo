# Modmail Quick User Info

When a user sends a modmail to a subreddit, this app replies to the modmail (visible to mods only) with a summary about the user including:

* Account age
* NSFW Yes/No
* Recent comment summary (subreddit name and comment count) in other subreddits (if any)
* Recently removed comments in the current subreddit (if any)
* Toolbox usernotes (if any)

Potential use cases:

* If a user deletes their account, you can still find details about past interactions in Modmail
* Quickly get context about a user's recent removed comments, saving time looking through their history
* Check for possible brigading or other negative interactions via recent interactions in other subreddits 

## Configuration options

**Include native Reddit user notes in Modmail User Summary** - toggles whether native Reddit user notes should display in the summary. You may wish to turn this off if you do not use this function. **Warning**: Currently broken if a user has a user note without a link. The summary will still send, just without any native user notes.

**Include Toolbox usernotes in Modmail User Summary** - toggles whether Toolbox user notes should display in the summary. You may wish to turn this off if you have migrated away from Toolbox or have never used it.

**Number of recently removed comments to show in summary** - the app will include the details of this many removed comments in the user's summary. If the user has no removed comments, then none will appear.

**Create modmail summary for subreddit moderators** - by default, the app won't create the modmail summary for moderators of the sub, but you can turn this on if you wish (e.g. for testing).

**Do not create summaries for these users** - a list of users you don't want to create summaries for e.g. helpful bots that aren't moderators of your subreddit.

**Format for date output** - controls the date format used to display dates in the summary for toolbox notes and recently removed comments.

**Copy initial message as new message after summary** - makes a copy of the original message after the summary. This means that the overview of the inbox makes more sense than just seeing a list of user summaries, but can increase clutter.

**Delay before adding summary after banning a user** - Waits 10 seconds after banning a user before adding the summary. This can help if you have mod actions that ban at the same time as removing comments, in some cases the removed comment may be missed from the summary if the modmail summary sends too fast.

## Recent changes

The 1.0.4 release doesn't change functionality compared to previous releases, but improves reliability and stability, as well as reduces API resource usage. If you have had issues with the app not responding to new modmail posts, or posting summaries more than once, this release fixes those issues.
