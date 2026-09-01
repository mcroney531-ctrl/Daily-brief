// Day-of-week -> chore zone + tasks, transcribed from the Weekly Reset grid
// in the Home Maintenance Schedule graphic. Pure lookup, no external call —
// "One zone per day, same tasks, same day, every week."
export interface ChoreDay {
  zone: string;
  tasks: string[];
}

const SCHEDULE_BY_DAY: Record<number, ChoreDay> = {
  0: {
    // Sunday
    zone: "Fridge + Reset",
    tasks: ["Empty fridge", "General reset lap"],
  },
  1: {
    // Monday
    zone: "Common Areas",
    tasks: ["Vacuum living room", "Vacuum couch", "Wipe windowsill", "Wipe coffee table", "Wipe ledge under TV"],
  },
  2: {
    // Tuesday
    zone: "Bathrooms",
    tasks: ["Sink full scrub", "Wipe mirrors", "Final fridge check", "Wipe stainless — trash night", "Mop bathroom floors"],
  },
  3: {
    // Wednesday
    zone: "Kitchen",
    tasks: ["Kitchen sink full scrub", "Clean microwave", "Wipe stainless fridge"],
  },
  4: {
    // Thursday
    zone: "Bedrooms",
    tasks: ["Vacuum all bedrooms", "Wash & swap bed sheets"],
  },
  5: {
    // Friday
    zone: "Floors",
    tasks: ["Vacuum steps", "Mop kitchen floor", "Mop foyer"],
  },
  6: {
    // Saturday
    zone: "Catch-Up",
    tasks: ["Any missed tasks", "Toilets full scrub", "Clean shower", "Deep wipe work desk"],
  },
};

// Runs every day regardless of zone — the same list year-round, not part of
// the weekly rotation. "The system only works when it stops being a
// decision" (the schedule graphic's own ground rule).
export const DAILY_MAINTENANCE: string[] = [
  "Wipe down counter & stove",
  "Sweep kitchen floor",
  "Sweep foyer",
  "Bathroom sink quick wipe",
  "Kitchen sink quick wipe",
  "Clear ledge on kitchen",
  "Wash dog food & water bowl",
  "Wipe down work desk",
  "Sweep bathroom floors",
];

export function getTodaysChores(date: Date = new Date()): ChoreDay {
  return SCHEDULE_BY_DAY[date.getDay()];
}

export function getTodaysZone(date: Date = new Date()): string {
  return getTodaysChores(date).zone;
}

// Plain-text version (used in the text/plain alt part of the email).
export function getChoreNudgeText(date: Date = new Date()): string {
  const { zone, tasks } = getTodaysChores(date);
  return [
    `Don't forget, today you're cleaning the ${zone}:`,
    ...tasks.map((task) => `  - ${task}`),
    "",
    "Daily maintenance:",
    ...DAILY_MAINTENANCE.map((task) => `  - ${task}`),
  ].join("\n");
}
