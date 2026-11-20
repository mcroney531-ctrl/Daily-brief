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
  await sweepEffectivePrivileges(client);
  await client.end();
}

// What the role can *actually* do, not just what was granted to it by name:
// this picks up PUBLIC grants, default privileges and role memberships too.
// Anything outside the expected set fails the check.
async function sweepEffectivePrivileges(c: pg.Client) {
  const memberships = await c.query(
    `select rolname from pg_roles where rolname <> current_user and pg_has_role(current_user, oid, 'member')`,
  );
  results.push({
    check: "no role memberships",
    ok: memberships.rowCount === 0,
    detail: memberships.rowCount ? memberships.rows.map((r) => r.rolname).join(", ") : "none",
  });

  const tables = await c.query(`
    select n.nspname || '.' || c.relname as rel,
           array_remove(array[
             case when has_table_privilege(c.oid, 'SELECT') then 'SELECT' end,
             case when not has_table_privilege(c.oid, 'SELECT') and has_any_column_privilege(c.oid, 'SELECT') then 'SELECT(columns)' end,
             case when has_table_privilege(c.oid, 'INSERT') or has_any_column_privilege(c.oid, 'INSERT') then 'INSERT' end,
             case when has_table_privilege(c.oid, 'UPDATE') or has_any_column_privilege(c.oid, 'UPDATE') then 'UPDATE' end,
             case when has_table_privilege(c.oid, 'DELETE') then 'DELETE' end,
             case when has_table_privilege(c.oid, 'TRUNCATE') then 'TRUNCATE' end
           ], null) as privs
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p', 'v', 'm', 'f')
      and n.nspname not in ('pg_catalog', 'information_schema')
      and n.nspname not like 'pg_toast%'
      and has_schema_privilege(n.oid, 'USAGE')
    order by 1`);
  const expected: Record<string, string> = {
    "public.food_week_plans": "SELECT(columns)",
  };
  // Known PUBLIC grant on this project, tracked in the Reading Center
  // security work rather than here. Reported, not failed.
  const known = new Set(["extensions.pg_stat_statements", "extensions.pg_stat_statements_info"]);
  for (const row of tables.rows as { rel: string; privs: string[] }[]) {
    if (!row.privs.length) continue;
    const got = row.privs.join(",");
    if (expected[row.rel] === got) {
      results.push({ check: `effective: ${row.rel}`, ok: true, detail: got });
    } else if (known.has(row.rel) && got === "SELECT") {
      results.push({ check: `effective: ${row.rel}`, ok: true, detail: `${got} (known PUBLIC grant, tracked separately)` });
    } else {
      results.push({ check: `effective: ${row.rel}`, ok: false, detail: `unexpected ${got}` });
    }
  }
  const missing = Object.keys(expected).filter((rel) => !tables.rows.some((r: { rel: string; privs: string[] }) => r.rel === rel && r.privs.length));
  for (const rel of missing) results.push({ check: `effective: ${rel}`, ok: false, detail: "expected access missing" });

  const cols = await c.query(`
    select string_agg(attname, ',' order by attname) as cols from pg_attribute
    where attrelid = 'public.food_week_plans'::regclass and attnum > 0 and not attisdropped
      and has_column_privilege(attrelid, attnum, 'SELECT')`);
  results.push({
    check: "readable columns are exactly week_start, meals, meals_reset_at",
    ok: cols.rows[0].cols === "meals,meals_reset_at,week_start",
    detail: cols.rows[0].cols ?? "none",
  });

  const schemas = await c.query(
    `select string_agg(nspname, ',') as s from pg_namespace where has_schema_privilege(oid, 'CREATE')`,
  );
  results.push({ check: "cannot create objects in any schema", ok: !schemas.rows[0].s, detail: schemas.rows[0].s ?? "none" });

  // SECURITY DEFINER functions run with their owner's rights, so any the
  // role can execute (outside the system catalog) widen its reach.
  const definers = await c.query(`
    select n.nspname || '.' || p.proname as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef and n.nspname not in ('pg_catalog', 'information_schema')
      and has_schema_privilege(n.oid, 'USAGE') and has_function_privilege(p.oid, 'EXECUTE')
    order by 1`);
  results.push({
    check: "no executable SECURITY DEFINER functions",
    ok: definers.rowCount === 0,
    detail: definers.rowCount ? definers.rows.map((r) => r.fn).join(", ") : "none",
  });
}

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}: ${r.detail}`);
const connected = results.some((r) => r.check.startsWith("connect") && r.ok);
const failed = results.filter((r) => !r.ok && !r.check.startsWith("connect"));
if (!connected || failed.length) process.exitCode = 1;
