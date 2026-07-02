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
require_env OAUTH_STATE_SECRET
require_env IMAGE_STORAGE_MODE
require_env R2_ENDPOINT
require_env R2_BUCKET_NAME
require_env R2_ACCESS_KEY_ID
require_env R2_SECRET_ACCESS_KEY

echo "Starting Notelab self-host runtime"
node dist/server/scripts/migrate.js

exec "$@"
