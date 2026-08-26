import { config } from "./config.js";

// Mirrors linkhoard-pwa's reserved-tag convention for the active pool —
// see linkhoard-pwa's app.js (ACTIVE_TAG). Not a status value: active-ness
// is orthogonal to reading progress (unread/skimmed/archived).
const ACTIVE_TAG = "pool-active";

export interface LinkhoardLink {
  id: string;
  url: string;
  title?: string | null;
  description?: string | null;
  status?: string;
  tags?: string[];
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${config.linkhoard.apiUrl!.replace(/\/$/, "")}${path}`, {
    headers: config.linkhoard.apiToken ? { Authorization: `Bearer ${config.linkhoard.apiToken}` } : {},
  });
  if (!res.ok) {
    throw new Error(`LinkHoard API error ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  return res.json() as Promise<T>;
}

export interface PoolSlice {
  active: LinkhoardLink[];
  pick: LinkhoardLink | null;
}

// Active items: "don't forget to ___" — shown every time, no cap or
// rotation. The random pick is the passive "you might be interested in"
// nudge — drawn from everything else, excluding archived links (already
// dealt with, shouldn't resurface as a discovery prompt).
export async function getPoolSlice(): Promise<PoolSlice> {
  if (!config.linkhoard.apiUrl) {
    return { active: [], pick: null };
  }

  const [active, all] = await Promise.all([
    apiGet<LinkhoardLink[]>(`/api/links?tag=${ACTIVE_TAG}&limit=100`),
    apiGet<LinkhoardLink[]>(`/api/links?limit=200`),
  ]);

  const candidates = all.filter(
    (link) => link.status !== "archived" && !(link.tags ?? []).includes(ACTIVE_TAG)
  );
  const pick = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;

  return { active, pick };
}
