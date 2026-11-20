import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

process.env.FOOD_SUPABASE_URL = "https://example.supabase.co";
process.env.FOOD_SUPABASE_KEY = "test-publishable-key";

const { config } = await import("../src/config.js");
const food = await import("../src/food.js");
const { buildBrief } = await import("../src/brief.js");
const render = await import("../src/email/render.js");

const DATE = new Date("2026-11-18T12:00:00Z"); // a Wednesday; week starts 2026-11-15
const FRESH = new Date("2026-11-16T00:00:00Z").toISOString();
const STALE = new Date("2026-11-01T00:00:00Z").toISOString();

type FetchImpl = typeof fetch;
const json = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as FetchImpl;
const deps = (f: FetchImpl, timeoutMs = 1_000) => ({ fetch: f, timeoutMs });

let warnings: string[] = [];
beforeEach(() => {
  warnings = [];
  mock.restoreAll();
  mock.method(console, "warn", (msg: string) => warnings.push(String(msg)));
  config.food.supabaseUrl = process.env.FOOD_SUPABASE_URL;
  config.food.supabaseKey = process.env.FOOD_SUPABASE_KEY;
});

const sources = (menu: (d: Date) => Promise<import("../src/food.js").MenuSlice>) => ({
  quicksumPicks: async () => [{ id: "q1", title: "A Book", author: "An Author", hook: "" }],
  pool: async () => ({ active: [{ id: "p1", url: "https://example.com", title: "Pool link" }], pick: null }),
  menu,
});

// 1. Network error
test("network error → unavailable, other sections still built, warning logged", async () => {
  const failing = (async () => { throw new TypeError("fetch failed"); }) as unknown as FetchImpl;
  const brief = await buildBrief(DATE, sources((d) => food.getMenuSliceSafe(d, deps(failing))) as never);
  assert.equal(brief.menu.status, "unavailable");
  assert.equal(brief.quicksumPicks.length, 1);
  assert.equal(brief.pool.active.length, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^::warning title=Daily Brief menu unavailable::TypeError: fetch failed/);
});

// 2. Non-2xx statuses
for (const status of [401, 403, 500]) {
  test(`HTTP ${status} → unavailable with status in the log`, async () => {
    const slice = await food.getMenuSliceSafe(DATE, deps(json({ message: "nope" }, status)));
    assert.equal(slice.status, "unavailable");
    assert.match(warnings[0], new RegExp(`HTTP ${status}`));
    assert.doesNotMatch(warnings[0], /nope/, "response body must not be logged");
  });
}

// 3. Timeout — injectable, so this takes ~20ms, not 10s
test("hung request → unavailable via injected timeout, request aborted", async () => {
  let aborted = false;
  const hanging = ((_: unknown, init?: RequestInit) =>
    new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); });
    })) as unknown as FetchImpl;
  const started = Date.now();
  const slice = await food.getMenuSliceSafe(DATE, deps(hanging, 20));
  assert.equal(slice.status, "unavailable");
  assert.ok(Date.now() - started < 1_000);
  assert.ok(aborted, "in-flight request should be aborted");
  assert.match(warnings[0], /timed out after 20ms/);
});

// 4. Not configured
test("not configured → unavailable and logged (no longer silently empty)", async () => {
  config.food.supabaseKey = undefined;
  const slice = await food.getMenuSliceSafe(DATE, deps(json([])));
  assert.equal(slice.status, "unavailable");
  assert.match(warnings[0], /not configured/);
});

// 5. No row
test("200 with no row → empty, nothing logged", async () => {
  const slice = await food.getMenuSliceSafe(DATE, deps(json([])));
  assert.equal(slice.status, "empty");
  assert.equal(warnings.length, 0);
});

// 6. Stale row
test("200 with a stale row → empty", async () => {
  const slice = await food.getMenuSliceSafe(
    DATE,
    deps(json([{ meals: [{ category: "Meals", items: [{ text: "Old", struck: false }] }], meals_reset_at: STALE }])),
  );
  assert.equal(slice.status, "empty");
});

// 7. Real menu — same shape as before
test("200 with meals → ok; struck items counted, empty categories skipped", async () => {
  let requested = "";
  const capture = (async (url: string) => {
    requested = url;
    return new Response(JSON.stringify([{
      meals: [
        { category: "Meals", items: [{ text: "Cajun shrimp pasta", struck: false }, { text: "Tacos", struck: true }] },
        { category: "Snacks", items: [{ text: "Apples", struck: true }] },
      ],
      meals_reset_at: FRESH,
    }]));
  }) as unknown as FetchImpl;
  const slice = await food.getMenuSliceSafe(DATE, deps(capture));
  assert.deepEqual(slice, {
    status: "ok",
    categories: [{ category: "Meals", items: ["Cajun shrimp pasta"] }],
    coveredCount: 2,
  });
  assert.match(requested, /week_start=eq\.2026-11-15&select=meals,meals_reset_at$/);
});

// 8. Rendering keeps empty and unavailable distinct
test("rendered email: unavailable wording differs from empty; other sections render", async () => {
  const base = await buildBrief(DATE, sources(async () => food.UNAVAILABLE_MENU) as never);
  const empty = { ...base, menu: { status: "empty" as const, categories: [], coveredCount: 0 } };

  const html = render.renderBriefHtml(base);
  const text = render.renderBriefText(base);
  assert.ok(text.includes(render.MENU_UNAVAILABLE_TEXT));
  assert.ok(!text.includes(render.MENU_EMPTY_TEXT));
  assert.ok(html.includes("Menu unavailable today"));
  assert.ok(text.includes("A Book") && text.includes("Pool link"), "other sections still present");

  const emptyText = render.renderBriefText(empty);
  assert.ok(emptyText.includes(render.MENU_EMPTY_TEXT));
  assert.ok(!emptyText.includes(render.MENU_UNAVAILABLE_TEXT));
});
