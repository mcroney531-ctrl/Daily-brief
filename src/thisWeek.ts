import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface ThisWeekSnapshot {
  active: boolean;
  text: string;
  updatedAt: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.join(__dirname, "email", "this-week.json");

// Written on demand (not by the automated routine) from the "This Week"
// artifact's stored text, whenever that experiment is synced into the repo.
// `active` is the on/off switch: when true, index.ts sends this plain list
// instead of the normal brief; missing/false/unreadable just means the
// experiment is off and the normal brief goes out as usual.
export function getThisWeekSnapshot(): ThisWeekSnapshot | null {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));
    if (typeof raw.text !== "string") return null;
    return { active: Boolean(raw.active), text: raw.text, updatedAt: raw.updatedAt ?? "" };
  } catch {
    return null;
  }
}
