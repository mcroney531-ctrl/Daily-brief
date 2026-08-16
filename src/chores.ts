// Day-of-week -> chore zone, mirrors the weekly rotation in the existing
// Home Maintenance Schedule (chore-schedule.html). Pure lookup, no external call.
const ZONE_BY_DAY: Record<number, string> = {
  0: "Fridge + Reset", // Sunday
  1: "Common Areas", // Monday
  2: "Bathrooms", // Tuesday
  3: "Kitchen", // Wednesday
  4: "Bedrooms", // Thursday
  5: "Floors", // Friday
  6: "Catch-Up", // Saturday
};

export function getTodaysZone(date: Date = new Date()): string {
  return ZONE_BY_DAY[date.getDay()];
}

// Plain-text version (used in the text/plain alt part of the email).
export function getChoreNudgeText(date: Date = new Date()): string {
  const zone = getTodaysZone(date);
  return `Don't forget, today you're cleaning the ${zone}.`;
}
