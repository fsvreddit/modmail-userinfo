# Modmail Quick User Info (modmail-userinfo)

**When a user sends a modmail to a subreddit, this app replies to the modmail (visible to mods only) with a summary about the user including:**

* Account age
* Account sitewide karma
* User flair
* If the user is flagged as NSFW
* Recent comment summary (subreddit name and comment count) in other subreddits
* The number of posts and/or comments made in your subreddit in a configurable timeframe
* Recently removed comments in the current subreddit
* Recent subreddit posts
* Toolbox usernotes or Reddit native mod notes

Any combination of the above options can be configured. If any of them return data, then a summary will be generated.

**Potential use cases:**

* If a user deletes their account, you can still find details about past interactions in modmail
* Quickly get context about a user's recent removed comments and subreddit posts, saving time looking through their history
* Check for possible brigading or other negative interactions via recent interactions in other subreddits

![Example modmail output](https://raw.githubusercontent.com/fsvreddit/modmail-userinfo/main/doc_images/examplesummary.png)

## Limitations

On Desktop, Reddit always defaults to the last reply type used. This means that if a summary is generated, this will default to "Private moderator note". Unfortunately this is out of my control.

The Developer Platform does not provide access to subreddit karma. If this ever changes, I will include it.

If a user is shadowbanned, no useful information can be shown about the user. However the app can tell you that the user is shadowbanned (not obvious on mobile modmail).

## About

This app is open source. You can find the code on GitHub [here](https://github.com/fsvreddit/modmail-userinfo).

## Version History

For earlier versions, please see the [full changelog](https://github.com/fsvreddit/modmail-userinfo/blob/main/changelog.md).

### v1.6.2

* Fixed an issue which led to undercounting comments in the "Recent comment count" output

### v1.6.1

* Fixed misleading text on settings page

### v1.6.0

* Output is now fully configurable. All options can be disabled or enabled individually, allowing you to pick and choose what you find useful and hide what you ignore
* Native Reddit mod notes no longer fail if the user has any mod notes without a post or comment link
* "Recent posts" header no longer shows if there are no posts to include
* Added new option for account age output, to allow for exact account age. Granularity is day (if at least 2 days old), hour (if between 6 hours and 2 days old) and minute (if under 6 hours old). The existing approximate output (e.g. "about 1 year") is still available
* Added new option to show the number of recent posts or comments in your subreddit within a configurable timeframe
* Added new option to include a line if the user is shadowbanned (no other information can be included if that is the case)
* Lots of internal code improvements

### v1.5.1

* Add option to include user's flair in summary
