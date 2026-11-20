import { getInFlightSlice } from "./inFlight.js";
import { config } from "./config.js";
import { getRandomQuicksumPicks } from "./mcp/quicksum.js";
import { getPoolSlice } from "./linkhoard.js";
import { getMenuSliceSafe } from "./food.js";
import type { BriefData } from "./email/render.js";

// Section loaders, injectable so tests can exercise buildBrief without the
// network. The menu loader is the safe variant: it never rejects.
export interface BriefSources {
  quicksumPicks: () => ReturnType<typeof getRandomQuicksumPicks>;
  pool: () => ReturnType<typeof getPoolSlice>;
  menu: (date: Date) => ReturnType<typeof getMenuSliceSafe>;
}

export const defaultSources: BriefSources = {
  quicksumPicks: () => getRandomQuicksumPicks(config.content.quicksumPickCount),
  pool: () => getPoolSlice(),
  menu: (date) => getMenuSliceSafe(date),
};

export async function buildBrief(date: Date, sources: BriefSources = defaultSources): Promise<BriefData> {
  const [quicksumPicks, pool, menu] = await Promise.all([
    sources.quicksumPicks(),
    sources.pool(),
    sources.menu(date),
  ]);
  return { date, inFlight: getInFlightSlice(), quicksumPicks, pool, menu };
}
