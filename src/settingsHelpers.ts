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

export function numericFieldBetween (value: number | undefined, min: number, max = 9999) {
    if (value === undefined) {
        return;
    }

    if (value < min && max === 9999) {
        return `Value must be greater than or equal to ${min}`;
    }

    if (value < min || value > max) {
        return `Value must be between ${min} and ${max}`;
    }
}
