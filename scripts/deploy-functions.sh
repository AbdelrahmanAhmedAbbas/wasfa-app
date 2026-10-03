#!/usr/bin/env bash
# Deploy all Supabase edge functions using --use-api to avoid local bundling hang.
set -e
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-axkojyoiodfhvvtsedug}"
FUNCTIONS=(import-create import-share import-status import-confirm recipe-recalculate recipe-localize)

if ! supabase projects list >/dev/null 2>&1; then
  echo "Supabase CLI is not authenticated."
  echo "Run: supabase login"
  exit 1
fi

for name in "${FUNCTIONS[@]}"; do
  echo "Deploying $name to project $PROJECT_REF..."
  supabase functions deploy "$name" --use-api --no-verify-jwt --project-ref "$PROJECT_REF"
  echo "Done: $name"
done
echo "All functions deployed."
