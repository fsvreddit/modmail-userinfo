import { SettingsFormField, SettingsValues, User } from "@devvit/public-api";
import json2md from "json2md";
import { compact, uniq } from "lodash";

enum SocialLinksSetting {
    IncludeSocialLinks = "includeSocialLinks",
}

enum SocialLinksDisplayOption {
    None = "Do not include",
    DomainsOnly = "Include domains only",
    FullDetails = "Include full details",
}

export const settingsForSocialLinks: SettingsFormField = {
    type: "group",
    label: "Social Links",
    fields: [
        {
            type: "select",
            name: SocialLinksSetting.IncludeSocialLinks,
            label: "Include social links in summary",
            options: Object.values(SocialLinksDisplayOption).map(option => ({ label: option, value: option })),
            defaultValue: [SocialLinksDisplayOption.None],
            multiSelect: false,
        },
    ],
};

function domainFromUrl (url: string): string | undefined {
    if (!url || url.startsWith("/")) {
        // Reddit internal link or crosspost
        return;
    }

    const hostname = new URL(url).hostname;
    const trimmedHostname = hostname.startsWith("www.") ? hostname.substring(4) : hostname;

    return trimmedHostname;
}

export async function getUserSocialLinks (user: User, settings: SettingsValues): Promise<json2md.DataObject[] | undefined> {
    const [includeSocialLinks] = settings[SocialLinksSetting.IncludeSocialLinks] as SocialLinksDisplayOption[] | undefined ?? [SocialLinksDisplayOption.None];

    if (includeSocialLinks === SocialLinksDisplayOption.None) {
        return;
    }

    const socialLinks = await user.getSocialLinks();
    if (socialLinks.length === 0) {
        return;
    }

    if (includeSocialLinks === SocialLinksDisplayOption.DomainsOnly) {
        return [{ p: `**Social Links**: ${uniq(compact(socialLinks.map(link => domainFromUrl(link.outboundUrl)))).join(", ")}` }];
    } else {
        // Detailed output
        return [
            { p: `**Social Links**:` },
            { ul: socialLinks.map(link => `${link.title}: ${link.outboundUrl}`) },
        ];
    }
}
