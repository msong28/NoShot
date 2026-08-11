#!/usr/bin/env bash
set -euo pipefail

# Runs supabase/tests/*.sql against a throwaway local Postgres cluster.
#
# Applies every migration in supabase/migrations/ (in order) to a fresh
# database first, alongside a minimal stand-in for the parts of Supabase's
# schema our migrations depend on (auth.users, auth.sessions, auth.uid(),
# the anon/authenticated roles) -- then runs the test files.
#
# Needs only `postgres`/`initdb`/`psql` on PATH (e.g. `brew install
# postgresql@17`). Does not need Docker or `supabase start`.

cd "$(dirname "$0")/.."

WORKDIR=$(mktemp -d)
PGDATA="$WORKDIR/pgdata"
PGPORT=55432

cleanup() {
  pg_ctl -D "$PGDATA" -o "-p $PGPORT -k $WORKDIR" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$PGDATA" -o "-p $PGPORT -k $WORKDIR" -l "$WORKDIR/pg.log" start >/dev/null

psql_run() {
  psql -h "$WORKDIR" -p "$PGPORT" -U postgres -v ON_ERROR_STOP=1 "$@"
}

psql_run -d postgres -c "create database noshot_test;" >/dev/null

psql_run -d noshot_test >/dev/null <<'SQL'
create role anon;
create role authenticated;
create extension if not exists pgcrypto;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid());
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id));
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create publication supabase_realtime;
create schema storage;
grant usage on schema storage to authenticated, anon;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
grant select, insert on storage.objects to authenticated;
grant select, insert on storage.objects to anon;
-- Real Supabase excludes the filename itself, returning only the folder
-- segments (e.g. 'a/b/c.jpg' -> {a,b}) -- this stub matches that shape.
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (regexp_split_to_array(name, '/'))[1:greatest(array_length(regexp_split_to_array(name, '/'), 1) - 1, 0)]
$$;
SQL

for migration in supabase/migrations/*.sql; do
  echo "Applying $migration..."
  psql_run -d noshot_test -f "$migration" >/dev/null
done

for test_file in supabase/tests/*.sql; do
  echo "Running $test_file..."
  # Each test file runs in its own transaction, rolled back afterward, so
  # fixture data (e.g. a username each file inserts) can't collide between
  # test files sharing the same throwaway database.
  psql_run -d noshot_test <<SQL
begin;
\i $test_file
rollback;
SQL
done

echo "All database tests passed."
