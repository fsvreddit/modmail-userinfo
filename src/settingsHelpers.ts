import { SettingsFormFieldValidatorEvent } from "@devvit/public-api";

export enum IncludeRecentContentOption {
    None = "none",
    VisibleAndRemoved = "all",
    Removed = "removed",
}

export function selectFieldHasOptionChosen (event: SettingsFormFieldValidatorEvent<string[]>) {
    if (event.value?.length !== 1) {
        return "You must choose an option";
    }
}

export function numericFieldBetween (value: number | undefined, min: number, max: number) {
    if (value && (value < min || value > max)) {
        return `Value must be between ${min} and ${max}`;
    }
}
