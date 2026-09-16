import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface InFlightItem {
  title: string;
  repo?: string;
  status: string;
  url?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.join(__dirname, "email", "in-flight.json");

// Written each morning by the Claude session that also triggers the send
// (see the "Currently in Flight" step in the precision-dispatch Routine) —
// it reads Claude Code's own session list and picks out whatever's been
// touched recently, so this needs no live API call and no separate
// tracker to keep up to date. Missing/unreadable snapshot just means
// nothing's currently in flight, same as any other quiet section.
export function getInFlightSlice(): InFlightItem[] {
  if (!existsSync(SNAPSHOT_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));
    return Array.isArray(raw.items) ? raw.items : [];
  } catch {
    return [];
  }
}
