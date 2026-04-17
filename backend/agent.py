"""Harvey — LiveKit voice agent worker.

Run:
    python agent.py dev          # local dev worker (auto-reload)
    python agent.py start        # production worker
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomInputOptions,
    WorkerOptions,
    cli,
)
from livekit.plugins import deepgram, elevenlabs, openai, silero

from prompts import HARVEY_SYSTEM_PROMPT
from tools import ALL_TOOLS

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("harvey.agent")


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------

class HarveyAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=HARVEY_SYSTEM_PROMPT,
            tools=ALL_TOOLS,
        )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

async def entrypoint(ctx: JobContext) -> None:
    log.info("Connecting to room %s", ctx.room.name)
    await ctx.connect()

    voice_id = os.getenv("ELEVENLABS_VOICE_ID")
    if not voice_id:
        log.warning(
            "ELEVENLABS_VOICE_ID not set — falling back to ElevenLabs default voice."
        )

    tts_kwargs: dict = {
        # Lower-latency model — feels more alive in voice agent context
        "model": "eleven_turbo_v2_5",
        # Voice tuning — kills "AI" artifacts, locks closer to source
        "voice_settings": elevenlabs.VoiceSettings(
            stability=0.50,        # User-tuned
            similarity_boost=0.85, # User-tuned
            style=0.0,
            use_speaker_boost=True,
            speed=0.90,            # User-tuned
        ),
    }
    if voice_id:
        tts_kwargs["voice_id"] = voice_id

    # Optional turn detector; falls back gracefully if plugin missing.
    turn_detection = None
    try:
        from livekit.plugins.turn_detector.multilingual import MultilingualModel
        turn_detection = MultilingualModel()
    except Exception:  # pragma: no cover
        try:
            from livekit.plugins.turn_detector.english import EnglishModel
            turn_detection = EnglishModel()
        except Exception:
            log.info("turn_detector plugin not available; using VAD-only endpointing.")

    # Deepgram: nova-2 w/ explicit interim_results. nova-3 was returning
    # zero transcripts in livekit-agents 1.5.4 even with a healthy WS.
    # Explicit language + smart_format to match LiveKit's known-good config.
    session = AgentSession(
        stt=deepgram.STT(
            model="nova-2",
            language="en-US",
            interim_results=True,
            smart_format=True,
            punctuate=True,
        ),
        llm=openai.LLM(
            model="gpt-4o-mini",
            parallel_tool_calls=True,
            temperature=0.7,
        ),
        tts=elevenlabs.TTS(**tts_kwargs),
        vad=silero.VAD.load(),
        turn_detection=turn_detection,
        aec_warmup_duration=0,
    )

    await session.start(
        agent=HarveyAgent(),
        room=ctx.room,
        room_input_options=RoomInputOptions(),
    )

    # Signature greeting — hard-coded, sent straight to TTS so it fires
    # the instant the user connects. No LLM round-trip, no lag.
    import random
    HARVEY_GREETINGS = [
        "Goddamn it. You're back. Let's get to work.",
        "You're in trouble or you wouldn't be calling. Tell me.",
        "Sit down. What are we dealing with.",
        "Talk fast. I bill in six minute increments.",
        "I'm listening. Make it count.",
        "You called. So it's bad. How bad.",
        "Whatever it is, we close it. Start talking.",
    ]
    await session.say(random.choice(HARVEY_GREETINGS), allow_interruptions=True)


def main() -> None:
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))


if __name__ == "__main__":
    main()
