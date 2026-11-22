#!/usr/bin/env bash
set -euo pipefail

APP="${FLY_APP:-harvey-specter-agent}"
cd "$(dirname "$0")/.."

if [ -z "${ELEVENLABS_API_KEY:-}" ] && [ -n "${ELEVEN_API_KEY:-}" ]; then
  ELEVENLABS_API_KEY="$ELEVEN_API_KEY"
fi

required=(LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET DEEPGRAM_API_KEY ANTHROPIC_API_KEY OPENAI_API_KEY ELEVENLABS_API_KEY)
optional=(ELEVENLABS_VOICE_ID ELEVENLABS_MODEL ELEVENLABS_STABILITY ELEVENLABS_SIMILARITY ELEVENLABS_STYLE ELEVENLABS_SPEED HARVEY_BRAIN)

missing=()
for v in "${required[@]}"; do
  [ -n "${!v:-}" ] || missing+=("$v")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "revive: missing env vars: ${missing[*]}" >&2
  echo "revive: export them in this shell (values are never printed) and run again." >&2
  exit 1
fi

if [ ! -f data/chroma_db/chroma.sqlite3 ]; then
  echo "revive: data/chroma_db is missing, so the image would ship an empty statute index." >&2
  echo "revive: copy a built index into data/chroma_db (2,806 chunks) or run backend/ingest_student_laws.py first." >&2
  exit 1
fi

if [ "${REVIVE_SKIP_CHECKS:-0}" != "1" ]; then
  echo "revive: checking provider keys"
  python3 - <<'PY'
import json, os, sys, urllib.error, urllib.request

def status(url, headers, data=None):
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, ""
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read() or b"{}").get("detail", "")
            detail = detail.get("status", "") if isinstance(detail, dict) else str(detail)[:80]
        except Exception:
            detail = ""
        return e.code, detail
    except Exception as e:
        return 0, type(e).__name__

e = os.environ
voice = e.get("ELEVENLABS_VOICE_ID") or "nPczCjzI2devNBz1zQrb"
checks = {
    "OPENAI_API_KEY": status("https://api.openai.com/v1/models", {"Authorization": "Bearer " + e["OPENAI_API_KEY"]}),
    "ANTHROPIC_API_KEY": status("https://api.anthropic.com/v1/models", {"x-api-key": e["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01"}),
    "DEEPGRAM_API_KEY": status("https://api.deepgram.com/v1/projects", {"Authorization": "Token " + e["DEEPGRAM_API_KEY"]}),
    "ELEVENLABS_API_KEY (tts with voice %s)" % voice: status(
        "https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_22050_32" % voice,
        {"xi-api-key": e["ELEVENLABS_API_KEY"], "Content-Type": "application/json"},
        json.dumps({"text": "Ready.", "model_id": e.get("ELEVENLABS_MODEL", "eleven_turbo_v2_5")}).encode(),
    ),
}
bad = False
for name, (code, detail) in checks.items():
    ok = code == 200
    bad |= not ok
    print("  %-50s %s" % (name, "ok" if ok else "FAILED (%s %s)" % (code, detail)))
if bad:
    print("revive: fix the failed keys, or rerun with REVIVE_SKIP_CHECKS=1", file=sys.stderr)
    sys.exit(1)
PY
  if ! LIVEKIT_URL="$LIVEKIT_URL" LIVEKIT_API_KEY="$LIVEKIT_API_KEY" LIVEKIT_API_SECRET="$LIVEKIT_API_SECRET" \
      python3 -c "import livekit.api" >/dev/null 2>&1; then
    echo "  LIVEKIT_* not verified locally (pip install livekit-api to check); continuing"
  else
    python3 - <<'PY' || { echo "revive: LiveKit credentials rejected" >&2; exit 1; }
import asyncio
from livekit import api
async def main():
    lk = api.LiveKitAPI()
    try:
        await lk.room.list_rooms(api.ListRoomsRequest())
    finally:
        await lk.aclose()
asyncio.run(main())
print("  %-50s ok" % "LIVEKIT_URL / KEY / SECRET")
PY
  fi
fi

if ! fly auth whoami >/dev/null 2>&1; then
  echo "revive: flyctl is not logged in. Run: fly auth login" >&2
  exit 1
fi

if ! fly status --app "$APP" >/dev/null 2>&1; then
  echo "revive: creating app $APP"
  fly apps create "$APP"
fi

{
  for v in "${required[@]}" "${optional[@]}"; do
    [ -n "${!v:-}" ] && printf '%s=%s\n' "$v" "${!v}"
  done
  printf 'ELEVEN_API_KEY=%s\n' "$ELEVENLABS_API_KEY"
} | fly secrets import --app "$APP" --stage >/dev/null

stale=()
for v in "${optional[@]}"; do
  [ -z "${!v:-}" ] && fly secrets list --app "$APP" 2>/dev/null | awk '{print $1}' | grep -qx "$v" && stale+=("$v")
done
if [ ${#stale[@]} -gt 0 ]; then
  fly secrets unset "${stale[@]}" --app "$APP" --stage >/dev/null
  echo "revive: removed stale secrets: ${stale[*]}"
fi
echo "revive: secrets staged (names only): ${required[*]} ELEVEN_API_KEY"

fly deploy --app "$APP" --ha=false

echo ""
echo "revive: deployed. Watch for 'registered worker' with:  fly logs --app $APP"
echo "revive: then place a call at https://harvey-two.vercel.app and listen for the greeting."
