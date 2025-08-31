import { SettingsValues } from "@devvit/public-api";
import { GeneralSetting, HeadingFormatting } from "../settings.js";

export function formatHeader (header: string, settings: SettingsValues): string {
    const [format] = settings[GeneralSetting.HeadingFormatting] as HeadingFormatting[] | undefined ?? [HeadingFormatting.Bold];
    switch (format) {
        case HeadingFormatting.Italic:
            return `*${header}*`;
        case HeadingFormatting.NormalText:
            return header;
        case HeadingFormatting.Bold:
        default:
            return `**${header}**`;
    }
}
