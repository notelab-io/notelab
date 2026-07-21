#!/usr/bin/env sh
set -eu

require_env() {
  key="$1"
  value="$(printenv "$key" || true)"
  if [ -z "$value" ]; then
    echo "Missing required environment variable: $key" >&2
    exit 1
  fi
}

require_env DATABASE_URL
require_env BETTER_AUTH_SECRET
require_env BETTER_AUTH_URL
require_env CLIENT_URL

echo "Starting Zilobase ENTERPRISE runtime (edition=${ZILOBASE_EDITION:-community})"

# Core migrations, then enterprise schema (idempotent).
node --import tsx apps/server/src/scripts/migrate.ts
if [ -f ee-src/migrate-ee.mjs ]; then
  node ee-src/migrate-ee.mjs
fi

exec "$@"
