#!/bin/sh
set -e

OPENCLI_ROOT=$(npm root -g)/@jackwener/opencli
DAEMON_JS="${OPENCLI_ROOT}/dist/daemon.js"

echo "[opencli] opencli root: ${OPENCLI_ROOT}"

# Start daemon with watchdog loop (runs in background)
(
  while true; do
    if [ -f "$DAEMON_JS" ]; then
      echo "[opencli] Starting daemon from ${DAEMON_JS}..."
      node "$DAEMON_JS"
    else
      echo "[opencli] daemon.js not found, triggering via opencli doctor..."
      opencli doctor || true
      sleep 60
    fi
    echo "[opencli] Daemon exited, restarting in 3s..."
    sleep 3
  done
) &

echo "[opencli] Waiting for daemon on port 19825..."
for i in $(seq 1 30); do
  if nc -z localhost 19825 2>/dev/null; then
    echo "[opencli] Daemon ready."
    break
  fi
  sleep 1
done

echo "[opencli] Starting MCP server on port 3000..."
exec node /app/mcp-server.js
