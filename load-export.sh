#!/usr/bin/env bash
# Load an RSC Editor export (zip or directory) into this checkout's game:
#
#   ./load-export.sh ~/Downloads/kosmolits-quest-cache.zip
#   ./load-export.sh --restore          # the cache this repo ships
#
# The work is RSC Editor's deploy/game/load-cache.sh, the same script the
# editor's Publish runs on the server. Point RSC_EDITOR at your editor
# checkout if it is not ~/Documents/RSCEditor. Restart ./run.sh afterwards.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EDITOR="${RSC_EDITOR:-$HOME/Documents/RSCEditor}"
GAME_DIR="$ROOT" STOCK_DIR="$ROOT/stock-data" exec bash "$EDITOR/deploy/game/load-cache.sh" "$@"
