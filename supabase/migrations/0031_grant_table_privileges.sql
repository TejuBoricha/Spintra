-- Migration 0031: Explicit table-level GRANTs for anon/authenticated
--
-- Found via CI: a freshly-reset local/CI Supabase instance (supabase start
-- + supabase db reset, running ONLY the migrations in this repo) rejected
-- every insert with "permission denied for table rooms" (Postgres 42501) —
-- RLS policies were never even reached. The live hosted project has never
-- hit this because Supabase's platform applies its own default grants
-- (GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, ...)
-- automatically when a project is created via the dashboard — that step
-- happens outside of, and was never captured in, this repo's migration
-- history. Every migration file replayed from scratch (disaster recovery,
-- a new environment, or this CI job) was silently missing it.
--
-- RLS remains the real security boundary (every table already has policies
-- restricting which specific rows a role can touch) — granting table-level
-- DML here just lets Postgres evaluate those policies at all, matching
-- Supabase's own standard project template.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- So a future migration's new table/sequence gets the same grants
-- automatically, without needing to remember to repeat this.
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
