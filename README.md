When a user sends a modmail to a subreddit, this app replies to the modmail (visible to mods only) with a summary about the user including:

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

If a user is shadowbanned, no useful information can be shown about the user. However, the app can tell you that the user is shadowbanned (not obvious on mobile modmail).

## Source Code and Licence

This app is open source. You can find the code on GitHub [here](https://github.com/fsvreddit/modmail-userinfo).

## Version History

For earlier versions, please see the [full changelog](https://github.com/fsvreddit/modmail-userinfo/blob/main/changelog.md).

### v1.6.9

* Allow headers to be formatted as desired - default is bold, but also supports italics and plain text.

### v1.6.8

* Fix formatting of mod notes (removed extra * character)

### v1.6.7

* Add option to include a user's bio text in output
* Add option to include social links in output
