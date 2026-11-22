-- Restricted read path for Daily Brief's "This Week's Menu".
-- Project: Reading Center (fdbkdsracxomwyytfgob). Idempotent; safe to re-run.
--
-- Replaces Daily Brief's anonymous read of food_week_plans so Food planning's
-- anon access can eventually be removed. Boundary:
--   * a dedicated login role — no superuser/createdb/createrole/replication,
--     no BYPASSRLS, NOINHERIT, member of no other role
--   * column-level SELECT on exactly week_start, meals, meals_reset_at
--     (so `select *` and every other column fail with 42501)
--   * one RLS policy scoped to this role only, independent of the
--     anon/authenticated policies the Food planning lockdown will remove
--   * read-only sessions, short statement timeout, 2 connections max
--
-- The role is created WITHOUT a password, so it can't log in until the owner
-- sets one in the SQL editor:
--   alter role daily_brief_menu_reader with password '<generated>';
-- The password never goes in this file, the repo, or any log.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'daily_brief_menu_reader') then
    create role daily_brief_menu_reader
      login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
      connection limit 2;
  end if;
end $$;

-- Supabase's postgres role isn't a superuser, so ALTER ROLE may only touch
-- attributes it is allowed to change; the rest are asserted below instead.
alter role daily_brief_menu_reader login noinherit connection limit 2;
do $$
declare r pg_roles%rowtype;
begin
  select * into r from pg_roles where rolname = 'daily_brief_menu_reader';
  if r.rolsuper or r.rolreplication or r.rolbypassrls or r.rolcreatedb or r.rolcreaterole or r.rolinherit then
    raise exception 'daily_brief_menu_reader has unexpected attributes; refusing to continue';
  end if;
  if exists (select 1 from pg_auth_members where member = r.oid) then
    raise exception 'daily_brief_menu_reader is a member of another role; refusing to continue';
  end if;
end $$;
alter role daily_brief_menu_reader set default_transaction_read_only = on;
alter role daily_brief_menu_reader set statement_timeout = '5s';
alter role daily_brief_menu_reader set idle_in_transaction_session_timeout = '10s';

grant usage on schema public to daily_brief_menu_reader;
grant select (week_start, meals, meals_reset_at) on public.food_week_plans to daily_brief_menu_reader;

drop policy if exists food_week_plans_daily_brief_menu_select on public.food_week_plans;
create policy food_week_plans_daily_brief_menu_select on public.food_week_plans
  for select to daily_brief_menu_reader using (true);

-- ROLLBACK:
-- drop policy if exists food_week_plans_daily_brief_menu_select on public.food_week_plans;
-- revoke select (week_start, meals, meals_reset_at) on public.food_week_plans from daily_brief_menu_reader;
-- revoke usage on schema public from daily_brief_menu_reader;
-- drop role if exists daily_brief_menu_reader;
