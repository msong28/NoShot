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
