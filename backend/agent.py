"""Harvey — LiveKit voice agent worker.

Run:
    python agent.py dev          # local dev worker (auto-reload)
    python agent.py start        # production worker
"""

from __future__ import annotations

import json
import logging
import os
import random

from dotenv import load_dotenv
from livekit import rtc
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

    # Off-the-record lore drops. When the user flips the OTR toggle in
    # the UI, the frontend publishes {type:"otr_on"} on the data channel.
    # That's our cue to have Harvey drop a Suits-world lore line —
    # Mike, Jessica, Donna, Hardman, Louis — so OTR is theatre, not just
    # a dim screen. Session plays the line via session.say() so it
    # bypasses the LLM entirely (no chance of off-topic drift).
    HARVEY_LORE = [
        "Off the record? I knew a guy named Mike. Smartest son of a bitch I ever met. Never saw the inside of a law school. Still beat every single lawyer I put him up against.",
        "Off the record? Let me tell you about Daniel Hardman. That man cost me three years of my life and I'd burn another three to put him back in the ground.",
        "Off the record, Jessica used to say making partner is the easy part. Keeping partner? That's where they find out what you're made of. She wasn't wrong.",
        "Off the record — Donna knows everything. Not most things. Everything. If she walks into a room and smiles at you, you're either about to win big or get fired. There is no third option.",
        "Off the record? The day I met Mike, he was running from the cops with a briefcase full of weed. Worst interview of my life. Best hire I ever made.",
        "Off the record, Louis Litt once cried in my office because I wouldn't let him be best man at my hypothetical wedding. I don't even want to get married. He cried anyway.",
        "Off the record — I beat Cameron Dennis. The man who made me. And I'd do it again tomorrow. Twice if I had to.",
        "Off the record? Scottie told me I was married to the job. She wasn't wrong. Still don't know if I should've quit. Probably not.",
        "Off the record — half this firm owes me. The other half owes me more. That's not arrogance. That's math.",
        "Off the record, I once won a case on a bet with Hardman. A bet. That's how sure I was. That's how sure I still am.",
    ]

    @ctx.room.on("data_received")
    def _on_data(packet: rtc.DataPacket):  # type: ignore[misc]
        try:
            msg = json.loads(packet.data.decode("utf-8"))
        except Exception:
            return
        if msg.get("type") != "otr_on":
            return
        line = random.choice(HARVEY_LORE)
        log.info("OTR engaged — dropping lore: %r", line[:80])
        # Schedule on the session's event loop so we don't block the
        # data-received callback.
        import asyncio
        asyncio.create_task(session.say(line, allow_interruptions=True))

    await session.start(
        agent=HarveyAgent(),
        room=ctx.room,
        room_input_options=RoomInputOptions(),
    )

    # Signature greeting — hard-coded, sent straight to TTS so it fires
    # the instant the user connects. No LLM round-trip, no lag.
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


def prewarm(proc) -> None:
    """Warm expensive singletons in each worker BEFORE jobs arrive.

    Chroma's Rust bindings have an internal connection pool. If the pool
    is cold-started inside a live tool call (audio + TTS + LLM all running),
    it times out waiting for a thread and leaves the RustBindingsAPI in a
    broken state — every subsequent cite_statute then 500s with
    'RustBindingsAPI object has no attribute bindings'.
    Forcing init here while the process is idle makes the first real
    cite_statute call land on an already-warm client.
    """
    try:
        from rag import get_rag
        get_rag()
        log.info("prewarm: RAG ready")
    except Exception as e:  # pragma: no cover
        log.warning("prewarm: RAG failed to load: %s", e)


def main() -> None:
    # Default init timeout is 10s which is too tight once torch + chroma
    # + legal prompt import all happen during cold start. Bump to 60s
    # so the worker has headroom on slow first spawns.
    # num_idle_processes=1 so only ONE worker opens Chroma's SQLite at a
    # time — concurrent opens exhaust Chroma's Rust connection pool and
    # leave the bindings in a half-initialized, unrecoverable state.
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            initialize_process_timeout=60,
            num_idle_processes=1,
        )
    )


if __name__ == "__main__":
    main()
