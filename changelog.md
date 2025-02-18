# Change Log

### v1.6.6

* Upgrade dependencies and fix an issue preventing the app developer from receiving downtime alerts correctly

### v1.6.5

* Fixed an issue that prevented subreddit comment counts from showing any subreddits other than the one it is installed in

### v1.6.2

* Fix issue which led to undercounting comments in the "Recent comment count" output

### v1.6.1

* Fix misleading text on settings page

### v1.6.0

* Output is now fully configurable. All options can be disabled or enabled individually, allowing you to pick and choose what you find useful and hide what you ignore
* Native Reddit mod notes no longer fail if the user has any mod notes without a post or comment link
* "Recent posts" header no longer shows if there are no posts to include
* Add new option for account age output, to allow for exact account age. Granularity is day (if at least 2 days old), hour (if between 6 hours and 2 days old) and minute (if under 6 hours old). The existing approximate output (e.g. "about 1 year") is still available.
* Add new option to include a line if the user is shadowbanned (no other information can be included if that is the case).
* Lots of internal code improvements

### v1.5.1

* Add option to include user's flair in summary

### v1.5

* Add option to include all recent sub comments in summary, not just removed ones
* Add ignore list for mods for "removed posts" list
* Add option to delay sending summary for all modmails, not just outgoing ones
* Add uptime alerting feature (for use by app developer only)

### v1.4

* Add option to increase number of posts shown in summary
* Fix issue with number of subs shown in participation history being incorrect
* Allow number of subs shown in participation history to be zero

### v1.3

* Add option to create summaries when making outgoing modmails. Previously these were always sent, but now it is configurable.

### v1.2

* Where the "Copy message after summary" is enabled, that output is now blockquoted to avoid inadvertent reports of the wrong modmail message resulting in Admin actions being taken against this app, not the OP
* Summaries are not created when receiving modmail from admins by default
* Escapes markdown properly in usernote output
* Further reliability and stability changes

### v1.1

* Add option to include recent subreddit posts from the user in the summary

### v1.0.4

* No functionality changes compared to previous releases, but improves reliability and stability, as well as reduces API resource usage. If you have had issues with the app not responding to new modmail posts, or posting summaries more than once, this release fixes those issues.
