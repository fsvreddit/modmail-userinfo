import { SettingsFormFieldValidatorEvent } from "@devvit/public-api";

export enum IncludeRecentContentOption {
    None = "none",
    VisibleAndRemoved = "all",
    Removed = "removed",
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export function selectFieldHasOptionChosen (event: SettingsFormFieldValidatorEvent<string[]>): void | string {
    if (!event.value || event.value.length !== 1) {
        return "You must choose an option";
    }
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export function numericFieldBetween (value: number | undefined, min: number, max: number): void | string {
    if (value && (value < min || value > max)) {
        return `Value must be between ${min} and ${max}`;
    }
}
