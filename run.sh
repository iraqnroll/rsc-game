#!/usr/bin/env bash
# Start the local game: data server, game server, web client. Ctrl+C stops all three.
#   http://localhost:1337/index.html   (free world)
#   http://localhost:1337/index.html#members
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$ROOT/logs"
trap 'kill 0' EXIT

# A socket left by a killed run would satisfy the wait below before the data server is up.
rm -f /tmp/rsc-data-server.sock
(cd "$ROOT/rsc-data-server" && node src/bin.js -v info >"$ROOT/logs/data-server.log" 2>&1) &
# The game server connects to the data server's socket on startup.
for _ in $(seq 50); do [[ -S /tmp/rsc-data-server.sock ]] && break; sleep 0.1; done
(cd "$ROOT/rsc-server" && node src/bin.js -v info >"$ROOT/logs/game-server.log" 2>&1) &
(cd "$ROOT/rsc-client" && npx st -p 1337 -nc -d dist >"$ROOT/logs/client.log" 2>&1) &

echo "logs in $ROOT/logs -- open http://localhost:1337/index.html"
wait
