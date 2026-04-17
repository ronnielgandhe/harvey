#!/usr/bin/env bash
# Fly.io deploy for Harvey.
# Usage:
#   cd /Users/ronniel/Desktop/harvey
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
fly secrets set \
  LIVEKIT_URL='wss://harvey-ppqpwwmf.livekit.cloud' \
  LIVEKIT_API_KEY='APIJZP2MvQGwRZ3' \
  LIVEKIT_API_SECRET='M6sXw2UvQwDYgwFsIz9OX4lhzUlJSfRSfsOR3UQYis0' \
  OPENAI_API_KEY='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' \
  DEEPGRAM_API_KEY='fb0aab80a6287a99b2feb71ad3142557dabf6b2e' \
  ELEVENLABS_API_KEY='sk_a8a32d106f494f4a09d7fc9a292cb01d09a360528c3b3f21' \
  ELEVEN_API_KEY='sk_a8a32d106f494f4a09d7fc9a292cb01d09a360528c3b3f21' \
  ELEVENLABS_VOICE_ID='zKrDZgdznctDasaOp22c' \
  --app harvey-specter-agent \
  --stage

echo "secrets staged"

# --- Deploy ---
fly deploy --app harvey-specter-agent --ha=false

echo ""
echo "==========================================================="
echo "Deploy dispatched. Tailing logs — wait for 'registered worker'."
echo "Press Ctrl+C when you see it."
echo "==========================================================="
fly logs --app harvey-specter-agent
