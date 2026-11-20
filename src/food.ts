import { config } from "./config.js";

// Sunday Setup's weekly menu, read straight from Supabase — no MCP server or
// REST wrapper in between, since food_week_plans has open anon select (RLS)
// and the key is a publishable one. (Moving to a restricted read-only role.)
//
// `meals` is written by the Your Dietitian chat, not the planner UI, so it
// fills in irregularly and being empty is the normal case, not an error.

const STALE_AFTER_DAYS = 5;

interface RawMealItem {
  text: string;
  struck: boolean;
}

interface RawMealCategory {
  category: string;
  items: RawMealItem[];
}

export interface FoodWeekPlanRow {
  meals: RawMealCategory[] | null;
  meals_reset_at: string | null;
}

export interface MenuCategory {
  category: string;
  items: string[];
}

// "empty" and "unavailable" must stay distinct: an empty menu means nothing is
// planned; an unavailable one means we couldn't find out. Rendering the second
// as the first would hide an outage behind a plausible-looking email.
export type MenuStatus = "ok" | "empty" | "unavailable";

export interface MenuSlice {
  status: MenuStatus;
  categories: MenuCategory[];
  coveredCount: number;
}

export const MENU_TIMEOUT_MS = 10_000;

export interface MenuDeps {
  fetch: typeof fetch;
  timeoutMs: number;
}

const defaultDeps: MenuDeps = { fetch: globalThis.fetch, timeoutMs: MENU_TIMEOUT_MS };

export const UNAVAILABLE_MENU: MenuSlice = { status: "unavailable", categories: [], coveredCount: 0 };

// The Sunday that starts the week `date` falls in — the primary key
// food_week_plans is keyed by.
export function weekStartFor(date: Date): string {
  const sunday = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  return sunday.toISOString().slice(0, 10);
}

// The 5-day clear is applied lazily by the app itself, only when it happens to
// be opened — so a list past its expiry can still be sitting in the row.
// Re-check the deadline here rather than trusting the stored value.
function isStale(resetAt: string | null, now: Date): boolean {
  if (!resetAt) return false; // null means the clock isn't running, not expired
  const elapsedDays = (now.getTime() - new Date(resetAt).getTime()) / 86_400_000;
  return elapsedDays >= STALE_AFTER_DAYS;
}

// Reads the row for `date`'s week. Throws on any failure (not configured,
// network error, non-2xx, timeout) — getMenuSliceSafe turns that into an
// "unavailable" slice so the rest of the brief still sends.
export async function getMenuSlice(date: Date, deps: MenuDeps = defaultDeps): Promise<MenuSlice> {
  if (!config.food.supabaseUrl || !config.food.supabaseKey) {
    throw new Error("food menu source not configured (FOOD_SUPABASE_URL / FOOD_SUPABASE_KEY unset)");
  }

  const url =
    `${config.food.supabaseUrl.replace(/\/$/, "")}/rest/v1/food_week_plans` +
    `?week_start=eq.${weekStartFor(date)}&select=meals,meals_reset_at`;

  const rows = await withTimeout(deps.timeoutMs, async (signal) => {
    const res = await deps.fetch(url, {
      signal,
      headers: {
        apikey: config.food.supabaseKey!,
        Authorization: `Bearer ${config.food.supabaseKey}`,
      },
    });
    if (!res.ok) {
      // Status only — the response body isn't needed to diagnose and keeps
      // anything the server echoes back out of the Actions log.
      throw new Error(`Food planning API returned HTTP ${res.status}`);
    }
    return (await res.json()) as FoodWeekPlanRow[];
  });

  return sliceFromRow(rows[0], date);
}

export function sliceFromRow(row: FoodWeekPlanRow | undefined, date: Date): MenuSlice {
  // No row at all is normal: a week only gets a row once something has
  // actually written to it.
  if (!row || !row.meals?.length || isStale(row.meals_reset_at, date)) {
    return { status: "empty", categories: [], coveredCount: 0 };
  }

  let coveredCount = 0;
  const categories: MenuCategory[] = [];

  for (const group of row.meals) {
    const items = group.items ?? [];
    coveredCount += items.filter((item) => item.struck).length;
    // Struck means handled, so it's not worth restating. A category with
    // nothing left to show (empty, or fully covered) is skipped entirely
    // rather than rendering a bare header.
    const open = items.filter((item) => !item.struck).map((item) => item.text);
    if (open.length) categories.push({ category: group.category, items: open });
  }

  return { status: categories.length ? "ok" : "empty", categories, coveredCount };
}

// The menu is one section of a larger email: a failure here must not cancel
// the send. Fail open for delivery, fail visibly for operations — the email
// says "unavailable" and the Actions run gets a warning annotation.
export async function getMenuSliceSafe(date: Date, deps: MenuDeps = defaultDeps): Promise<MenuSlice> {
  try {
    return await getMenuSlice(date, deps);
  } catch (err) {
    reportMenuFailure(err);
    return UNAVAILABLE_MENU;
  }
}

export function reportMenuFailure(err: unknown): void {
  const message = describeError(err);
  // ::warning:: is a GitHub Actions workflow command; locally it's just a line.
  console.warn(`::warning title=Daily Brief menu unavailable::${message}`);
}

// Our own wording plus name/code only — never the raw error object, which for
// some clients can carry request or connection details.
function describeError(err: unknown): string {
  if (err instanceof TimeoutError) return err.message;
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    const base = err.name === "Error" ? err.message : `${err.name}: ${err.message}`;
    return typeof code === "string" ? `${base} (code ${code})` : base;
  }
  return "unknown error";
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`menu fetch timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

// Bounds the whole operation (connect, request, body) and aborts the
// in-flight request when time runs out. The timeout is injectable so tests
// don't wait the real 10 seconds.
async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(ms));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
