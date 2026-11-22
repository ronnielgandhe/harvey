#!/usr/bin/env bash
# Fly.io deploy for Harvey.
# Usage:
#   cd harvey
#   bash deploy/fly-deploy.sh
#
# Requirements:
#   - flyctl installed + authenticated (fly auth whoami works)
#   - run from repo root so fly.toml + backend/Dockerfile resolve

set -euo pipefail

cd "$(dirname "$0")/.."

# --- App creation. `launch --no-deploy` creates the app w/ our fly.toml
# but skips the initial deploy so we can set secrets first. ---
if ! fly status --app harvey-specter-agent >/dev/null 2>&1; then
  echo "creating app: harvey-specter-agent"
  fly apps create harvey-specter-agent
fi

# --- Secrets ---
# read from your shell or a local .env file, never hardcode them here.
if [ -f .env ]; then set -a; . ./.env; set +a; fi
for v in LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET OPENAI_API_KEY DEEPGRAM_API_KEY ELEVENLABS_API_KEY ELEVENLABS_VOICE_ID; do
  if [ -z "${!v:-}" ]; then echo "missing env var: $v" >&2; exit 1; fi
done

fly secrets set \
  LIVEKIT_URL="$LIVEKIT_URL" \
  LIVEKIT_API_KEY="$LIVEKIT_API_KEY" \
  LIVEKIT_API_SECRET="$LIVEKIT_API_SECRET" \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  DEEPGRAM_API_KEY="$DEEPGRAM_API_KEY" \
  ELEVENLABS_API_KEY="$ELEVENLABS_API_KEY" \
  ELEVEN_API_KEY="$ELEVENLABS_API_KEY" \
  ELEVENLABS_VOICE_ID="$ELEVENLABS_VOICE_ID" \
  --app harvey-specter-agent \
  --stage

echo "secrets staged"

# --- Deploy ---
fly deploy --app harvey-specter-agent --ha=false

echo ""
echo "==========================================================="
echo "Deploy dispatched. Tailing logs, wait for 'registered worker'."
echo "Press Ctrl+C when you see it."
echo "==========================================================="
fly logs --app harvey-specter-agent
