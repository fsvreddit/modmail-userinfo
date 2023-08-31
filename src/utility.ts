import { Subreddit } from "@devvit/public-api";

export async function isMod(subReddit: Subreddit, userName: string): Promise<boolean>
{
    const modCheck = await subReddit.getModerators({
        username: userName
      }).all();

    return (modCheck && modCheck.length > 0);
}

function pluralise(value: number, singular: string, plural: string): string
{
    if (value == 1)
        return singular;
    else
        return plural;
}

export function formatAccountAgeForDisplay(accountAge: number): string
{
    // Sources for average Month/Year: https://www.britannica.com/science/time/Lengths-of-years-and-months
    const averageDaysInMonth = 30.437; 
    const averageDaysInYear = 365.242190;

    var years = Math.floor(accountAge / averageDaysInYear);
    var months = Math.floor((accountAge - (averageDaysInYear * years)) / averageDaysInMonth);
    var days = Math.floor(accountAge - (averageDaysInYear * years) - (averageDaysInMonth * months));

    let age: string = "";

    if (years)
        age += `${years} ${pluralise(years, 'year', 'years')} `;

    if (months)
        age += `${months} ${pluralise(months, 'month', 'months')} `;

    if (!years) // No point doing "Days" if the account is over a year old
        age += `${days} ${pluralise(days, 'day', 'days')}`;

    return age.trim();
}