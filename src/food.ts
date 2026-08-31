import { config } from "./config.js";

// Sunday Setup's weekly menu, read straight from Supabase — no MCP server or
// REST wrapper in between, since food_week_plans has open anon select (RLS)
// and the key is a publishable one.
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

interface FoodWeekPlanRow {
  meals: RawMealCategory[] | null;
  meals_reset_at: string | null;
}

export interface MenuCategory {
  category: string;
  items: string[];
}

export interface MenuSlice {
  categories: MenuCategory[];
  coveredCount: number;
}

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

export async function getMenuSlice(date: Date): Promise<MenuSlice> {
  if (!config.food.supabaseUrl || !config.food.supabaseKey) {
    return { categories: [], coveredCount: 0 };
  }

  const url =
    `${config.food.supabaseUrl.replace(/\/$/, "")}/rest/v1/food_week_plans` +
    `?week_start=eq.${weekStartFor(date)}&select=meals,meals_reset_at`;

  const res = await fetch(url, {
    headers: {
      apikey: config.food.supabaseKey,
      Authorization: `Bearer ${config.food.supabaseKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Food planning API error ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }

  // No row at all is normal: a week only gets a row once something has
  // actually written to it.
  const rows = (await res.json()) as FoodWeekPlanRow[];
  const row = rows[0];
  if (!row || !row.meals?.length || isStale(row.meals_reset_at, date)) {
    return { categories: [], coveredCount: 0 };
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

  return { categories, coveredCount };
}
