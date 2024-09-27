# Modmail Quick User Info (modmail-userinfo)

**When a user sends a modmail to a subreddit, this app replies to the modmail (visible to mods only) with a summary about the user including:**

* Account age
* NSFW (Yes/No)
* Recent comment summary (subreddit name and comment count) in other subreddits (if any)
* Recently removed comments in the current subreddit (if any)
* Recent subreddit posts (if any)
* Toolbox or native usernotes (if any)

**Potential use cases:**

* If a user deletes their account, you can still find details about past interactions in modmail
* Quickly get context about a user's recent removed comments and subreddit posts, saving time looking through their history
* Check for possible brigading or other negative interactions via recent interactions in other subreddits

**Note:** If a user is shadowbanned or suspended, no summary is created. It's not possible to retrieve information about these users, so no useful information could be included.

![Example modmail output](https://raw.githubusercontent.com/fsvreddit/modmail-userinfo/main/doc_images/examplesummary.png)

## Configuration Options

**Include native Reddit user notes in Modmail User Summary**  
Toggles whether native Reddit user notes should display in the summary. You may turn this off if you do not use this function. **Warning**: Currently broken if a user has a user note without a link. The summary will still send, just without any native user notes.

**Include Toolbox usernotes in Modmail User Summary**  
Toggles whether Toolbox user notes are displayed in the summary. You may turn this off if you have migrated away from Toolbox or have never used it.

**Number of recently removed comments to show in summary**  
The app will include the details of this many removed comments in the user's summary. If the user has no removed comments, then none will appear.

**Include up to 3 recent posts in summary**  
Gives the option to include up to 3 subreddit posts from the user.

**Create modmail summary for subreddit moderators**  
By default, the app won't create the modmail summary for moderators of the sub, but you can turn this on if you wish (e.g. for testing).

**Do not create summaries for these users**  
A list of users you don't want to create summaries for e.g. helpful bots that aren't moderators of your subreddit.

**Format for date output**  
Controls the date format used to display dates in the summary for toolbox notes and recently removed comments.

**Copy initial message as new message after summary**  
Makes a copy of the original message after the summary. This means that the overview of the inbox makes more sense than just seeing a list of user summaries, but can increase clutter.

**Delay before adding summary after banning a user**  
Waits 10 seconds after banning a user before adding the summary. This can help if you have mod actions that ban at the same time as removing comments, in some cases the removed comment may be missed from the summary if the modmail summary sends too fast.

## About

This app is open source. You can find the code on GitHub [here](https://github.com/fsvreddit/modmail-userinfo).

## Version History

v1.5.3: 

- "Recent posts" header no longer shows if there are no posts to include

v1.5.1:

- Add option to include user's flair in summary

v1.5: 

- Add option to include all recent sub comments in summary, not just removed ones
- Add ignore list for mods for "removed posts" list
- Add option to delay sending summary for all modmails, not just outgoing ones
- Add uptime alerting feature (for use by app developer only)

v1.4:

- Add option to increase number of posts shown in summary
- Fix issue with number of subs shown in participation history being incorrect
- Allow number of subs shown in participation history to be zero

v1.3:

- Add option to create summaries when making outgoing modmails. Previously these were always sent, but now it is configurable.

v1.2:

- Where the "Copy message after summary" is enabled, that output is now blockquoted to avoid inadvertent reports of the wrong modmail message resulting in Admin actions being taken against this app, not the OP
- Summaries are not created when receiving modmail from admins by default
- Escapes markdown properly in usernote output
- Further reliability and stability changes

v1.1:

- Add option to include recent subreddit posts from the user in the summary

v1.0.4:

- No functionality changes compared to previous releases, but improves reliability and stability, as well as reduces API resource usage. If you have had issues with the app not responding to new modmail posts, or posting summaries more than once, this release fixes those issues.

