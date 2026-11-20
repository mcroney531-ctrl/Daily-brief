// One-off connection compatibility check for the restricted menu role.
// Proves, from GitHub Actions itself, that daily_brief_menu_reader can reach
// Reading Center through the Supabase pooler over verified TLS with `pg`, and
// that its permission boundary holds. Run via the "Menu DB check" workflow.
//
// Never prints the connection string or password: only host, port, user,
// pass/fail and Postgres error codes.
import pg from "pg";
import { weekStartFor } from "../src/food.js";

const raw = process.env.FOOD_DB_URL;
if (!raw) {
  console.error("FOOD_DB_URL is not set");
  process.exit(1);
}

let parsed: URL;
try {
  parsed = new URL(raw);
} catch {
  console.error("FOOD_DB_URL is not a valid URL (value not shown)");
  process.exit(1);
}
const password = decodeURIComponent(parsed.password);
const redact = (s: string) =>
  [raw, password, parsed.password].filter(Boolean).reduce((acc, secret) => acc.split(secret).join("***"), s);

console.log(`target: ${parsed.hostname}:${parsed.port || "5432"} user=${decodeURIComponent(parsed.username)}`);

type Result = { check: string; ok: boolean; detail: string };
const results: Result[] = [];

async function attempt(label: string, ssl: pg.ClientConfig["ssl"]): Promise<pg.Client | null> {
  const client = new pg.Client({
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username),
    password,
    database: parsed.pathname.replace(/^\//, "") || "postgres",
    ssl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 5_000,
  });
  try {
    await client.connect();
    results.push({ check: `connect (${label})`, ok: true, detail: "connected" });
    return client;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    results.push({ check: `connect (${label})`, ok: false, detail: redact(`${e.code ?? ""} ${e.message ?? "error"}`.trim()) });
    await client.end().catch(() => {});
    return null;
  }
}

// TLS is always on and always verified — there is no unencrypted or
// unverified fallback. Try the runner's system CAs first, then the Supabase
// CA if provided as a secret.
let client = await attempt("verified TLS, system CAs", { rejectUnauthorized: true });
if (!client && process.env.FOOD_DB_CA) {
  client = await attempt("verified TLS, Supabase CA", { rejectUnauthorized: true, ca: process.env.FOOD_DB_CA });
}

async function expect(check: string, sql: string, params: unknown[], want: "ok" | string) {
  if (!client) return;
  try {
    const res = await client.query(sql, params);
    results.push({ check, ok: want === "ok", detail: `ok, ${res.rowCount} row(s)` });
  } catch (err) {
    const code = (err as { code?: string }).code ?? "?";
    results.push({ check, ok: want === code, detail: `error ${code}` });
  }
}

if (client) {
  const week = weekStartFor(new Date());
  // The production query: parameterized, three columns, one row.
  await expect("read menu columns (production query)", "select meals, meals_reset_at from public.food_week_plans where week_start = $1", [week], "ok");
  // Boundary probes — every one of these must be refused.
  await expect("select * refused", "select * from public.food_week_plans limit 1", [], "42501");
  await expect("other column refused", "select proteins from public.food_week_plans limit 1", [], "42501");
  await expect("write refused", "update public.food_week_plans set meals = meals where false", [], "25006");
  await expect("other food table refused", "select 1 from public.food_log_items limit 1", [], "42501");
  await expect("reading data refused", "select 1 from public.summaries limit 1", [], "42501");
  await expect("role switch refused", "set role service_role", [], "42501");
  await client.end();
}

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}: ${r.detail}`);
const connected = results.some((r) => r.check.startsWith("connect") && r.ok);
const failed = results.filter((r) => !r.ok && !r.check.startsWith("connect"));
if (!connected || failed.length) process.exitCode = 1;
