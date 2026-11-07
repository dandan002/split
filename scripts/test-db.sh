#!/usr/bin/env bash
# Applies the Supabase migrations to a throwaway Postgres database and runs
# the SQL tests in supabase/tests. Usage:
#   PGURL=postgres://postgres@localhost:5432/postgres scripts/test-db.sh
set -euo pipefail

: "${PGURL:?Set PGURL to a Postgres connection string with permission to create databases}"
here="$(cd "$(dirname "$0")/.." && pwd)"
db="split_test_$$"

psql "$PGURL" -v ON_ERROR_STOP=1 -q -c "create database $db" >/dev/null
trap 'psql "$PGURL" -q -c "drop database if exists $db" >/dev/null' EXIT

target="$(echo "$PGURL" | sed -E "s#/[^/?]*(\?|$)#/$db\1#")"

run() { psql "$target" -v ON_ERROR_STOP=1 -q -X -f "$1" >/dev/null; }

run "$here/supabase/tests/supabase_stub.sql"
for migration in "$here"/supabase/migrations/*.sql; do
  run "$migration"
done
for test in "$here"/supabase/tests/*.test.sql; do
  run "$test"
  echo "ok - $(basename "$test")"
done
echo "database tests passed"
