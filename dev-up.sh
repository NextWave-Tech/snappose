#!/usr/bin/env bash
# Bật backend + 2 cloudflared quick tunnel (API :8000, Metro :8081) + Metro dev client.
# Chạy từ Git Bash: ./dev-up.sh   — Ctrl+C để tắt tất cả.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
CF="/c/Program Files (x86)/cloudflared/cloudflared"
LOGS="$ROOT/.devlogs"; mkdir -p "$LOGS"

trap 'kill $(jobs -p) 2>/dev/null' EXIT

wait_url() { # $1 = log file
  local u=""
  for _ in $(seq 1 60); do
    u=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$1" | head -1)
    [ -n "$u" ] && { echo "$u"; return; }
    sleep 1
  done
  echo "Không lấy được URL tunnel, xem $1" >&2; exit 1
}

docker ps --format '{{.Names}}' | grep -q snappose-api-postgres || (cd "$ROOT/snappose-api" && docker compose up -d)

(cd "$ROOT/snappose-api" && ./.pyembed/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$LOGS/api.log" 2>&1) &
"$CF" tunnel --url http://localhost:8000 > "$LOGS/cf-api.log" 2>&1 &
"$CF" tunnel --url http://localhost:8081 > "$LOGS/cf-metro.log" 2>&1 &

API_URL=$(wait_url "$LOGS/cf-api.log")
METRO_URL=$(wait_url "$LOGS/cf-metro.log")
sed -i "s#^EXPO_PUBLIC_API_URL=.*#EXPO_PUBLIC_API_URL=$API_URL#" "$ROOT/snappose-mobile/.env"

echo
echo "API   : $API_URL"
echo "METRO : $METRO_URL   <- nhập URL này trong app SnapPose (Enter URL manually)"
echo

cd "$ROOT/snappose-mobile"
EXPO_PACKAGER_PROXY_URL="$METRO_URL" npx expo start --dev-client --clear
