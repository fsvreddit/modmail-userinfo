import { User } from "@devvit/public-api";

export function getAccountKarma (user: User): string {
    return `**Sitewide karma**: Post ${user.linkKarma}, Comment ${user.commentKarma}\n\n`;
}
