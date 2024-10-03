import { User } from "@devvit/public-api";
import { formatDistanceToNow } from "date-fns";

export function getAccountAge (user: User): string {
    return `**Age**: ${formatDistanceToNow(user.createdAt)}\n\n`;
}
