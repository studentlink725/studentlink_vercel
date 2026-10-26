#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-8084}"

if [[ ! -x node_modules/.bin/expo ]]; then
  echo "Installing project dependencies from package-lock.json..."
  npm ci
fi

# Stop only this user's previous Expo server on the demo port.
pkill -u "$(id -u)" -f "[e]xpo start.*--port ${PORT}" 2>/dev/null || true
sleep 1

BROWSER=none npm run web -- --tunnel --clear --port "$PORT" 2>&1 | tee -a studentlink.log
