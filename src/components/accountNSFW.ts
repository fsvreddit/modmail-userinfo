import { User } from "@devvit/public-api";

export function getAccountNSFW (user: User): string {
    if (user.nsfw) {
        return "**NSFW account**: Yes\n\n";
    } else {
        return "";
    }
}
