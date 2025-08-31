import { SettingsFormField, SettingsValues, TriggerContext, User } from "@devvit/public-api";
import json2md from "json2md";
import { getUserExtended } from "../extendedDevvit.js";
import { formatHeader } from "./componentHelpers.js";

enum BioTextSetting {
    IncludeBioText = "includeBioText",
}

export const settingsForBioText: SettingsFormField = {
    type: "boolean",
    name: BioTextSetting.IncludeBioText,
    label: "Include user's bio text in summary",
    defaultValue: false,
};

export async function getUserBioText (user: User, settings: SettingsValues, context: TriggerContext): Promise<json2md.DataObject[] | undefined> {
    if (!settings[BioTextSetting.IncludeBioText]) {
        return;
    }

    const userExtended = await getUserExtended(user.username, context);
    const bioText = userExtended?.userDescription;
    if (!bioText) {
        return;
    }

    if (bioText.includes("\n\n")) {
        return [
            { p: `${formatHeader("Bio Text", settings)}:` },
            { blockquote: bioText },
        ];
    } else {
        return [{ p: `${formatHeader("Bio Text", settings)}: ${bioText}` }];
    }
}
