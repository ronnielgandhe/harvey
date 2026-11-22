"""Harvey — LiveKit voice agent worker.

Run:
    python agent.py dev          # local dev worker (auto-reload)
    python agent.py start        # production worker
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import sys

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
    llm,
    tts,
)
from livekit.plugins import deepgram, elevenlabs, openai, silero

try:
    from livekit.plugins.turn_detector.multilingual import MultilingualModel
except Exception:  # pragma: no cover
    MultilingualModel = None

try:
    from livekit.plugins import anthropic as lk_anthropic
except Exception:  # pragma: no cover
    lk_anthropic = None

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

BRAINS = {
    "opus": "claude-opus-5-5",
    "sonnet": "claude-sonnet-5-5",
    "haiku": "claude-haiku-5-5",
}


DEFAULT_VOICE_ID = "nPczCjzI2devNBz1zQrb"


def eleven_key() -> str:
    return os.getenv("ELEVEN_API_KEY") or os.getenv("ELEVENLABS_API_KEY") or ""


def missing_config() -> tuple[list[str], list[str]]:
    fatal = [k for k in ("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "DEEPGRAM_API_KEY") if not os.getenv(k)]
    if not (os.getenv("ANTHROPIC_API_KEY") or os.getenv("OPENAI_API_KEY")):
        fatal.append("ANTHROPIC_API_KEY or OPENAI_API_KEY (no LLM)")
    if not (eleven_key() or os.getenv("OPENAI_API_KEY")):
        fatal.append("ELEVEN_API_KEY or OPENAI_API_KEY (no TTS)")
    degraded = []
    if not os.getenv("OPENAI_API_KEY"):
        degraded.append("OPENAI_API_KEY (cite_statute embeddings and router are off)")
    if not os.getenv("ANTHROPIC_API_KEY"):
        degraded.append("ANTHROPIC_API_KEY (brain picker ignored, gpt-4o-mini only)")
    if not eleven_key():
        degraded.append("ELEVEN_API_KEY (Harvey voice off, OpenAI TTS only)")
    return fatal, degraded


def build_llm(choice: str):
    brain = choice if choice in BRAINS else os.getenv("HARVEY_BRAIN", "opus")
    chain = []
    if lk_anthropic is not None and os.getenv("ANTHROPIC_API_KEY") and brain in BRAINS:
        chain.append(
            lk_anthropic.LLM(
                model=BRAINS[brain],
                max_tokens=1024,
                parallel_tool_calls=True,
                caching="ephemeral",
            )
        )
    if os.getenv("OPENAI_API_KEY"):
        chain.append(openai.LLM(model="gpt-4o-mini", parallel_tool_calls=True, temperature=0.7))
    log.info("LLM chain: %s", [m.model for m in chain])
    if len(chain) == 1:
        return chain[0]
    return llm.FallbackAdapter(chain, attempt_timeout=20.0)


def build_tts():
    chain = []
    if eleven_key():
        chain.append(
            elevenlabs.TTS(
                api_key=eleven_key(),
                voice_id=os.getenv("ELEVENLABS_VOICE_ID") or DEFAULT_VOICE_ID,
                model=os.getenv("ELEVENLABS_MODEL", "eleven_turbo_v2_5"),
                voice_settings=elevenlabs.VoiceSettings(
                    stability=float(os.getenv("ELEVENLABS_STABILITY", "0.45")),
                    similarity_boost=float(os.getenv("ELEVENLABS_SIMILARITY", "0.80")),
                    style=float(os.getenv("ELEVENLABS_STYLE", "0.20")),
                    use_speaker_boost=True,
                    speed=float(os.getenv("ELEVENLABS_SPEED", "1.12")),
                ),
            )
        )
    if os.getenv("OPENAI_API_KEY"):
        chain.append(
            openai.TTS(
                model="gpt-4o-mini-tts",
                voice="onyx",
                instructions="Deep, dry, fast-talking New York closer. Clipped sentences, total confidence.",
            )
        )
    log.info("TTS chain: %s", [t.provider + ":" + t.model for t in chain])
    if len(chain) == 1:
        return chain[0]
    return tts.FallbackAdapter(chain, max_retry_per_tts=1)


async def publish_status(room: rtc.Room, stage: str, ok: bool, message: str) -> None:
    payload = {"type": "agent_status", "payload": {"stage": stage, "ok": ok, "message": message}}
    try:
        await room.local_participant.publish_data(json.dumps(payload).encode("utf-8"), reliable=True)
    except Exception as exc:
        log.warning("agent_status publish failed: %s", exc)


async def caller_brain(ctx: JobContext) -> str:
    try:
        participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=5)
        return (participant.attributes or {}).get("harvey.brain", "")
    except Exception:
        return ""


async def entrypoint(ctx: JobContext) -> None:
    log.info("Connecting to room %s", ctx.room.name)
    await ctx.connect()
    brain = await caller_brain(ctx)
    fatal, degraded = missing_config()
    for item in degraded:
        log.warning("DEGRADED: missing %s", item)
    if fatal:
        log.error("CANNOT TALK: missing %s", ", ".join(fatal))
        await publish_status(ctx.room, "config", False, "Harvey is offline: the agent is missing keys (" + ", ".join(fatal) + ").")
        return

    # Fire-and-forget RAG warmup. Runs on the worker that's already
    # spawned for THIS room (so no concurrent-boot contention), kicks
    # off while Harvey's greeting plays, and is done well before the
    # user asks the first legal question. Protects us from chromadb's
    # cold-start Rust-pool flake on the first cite_statute call.
    async def _warm_rag() -> None:
        try:
            from rag import get_rag
            # get_rag() is synchronous + takes ~5s cold — run it in a
            # thread so we don't block the event loop that's driving
            # the greeting TTS.
            await asyncio.to_thread(get_rag)
            log.info("RAG pre-warmed for room")
        except Exception as exc:  # pragma: no cover
            log.warning("RAG warmup failed: %s (will retry on first tool call)", exc)
    asyncio.create_task(_warm_rag())

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
        llm=build_llm(brain),
        tts=build_tts(),
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel() if MultilingualModel is not None else None,
        aec_warmup_duration=0,
    )

    # Impatient nudges Harvey drops when the caller goes quiet. The
    # frontend publishes {type:"idle_nudge"} after ~28s of silence; we
    # fire a random line through session.say() so it bypasses the LLM
    # and lands in Harvey's voice immediately. Short, clock-aware,
    # billable vibe.
    HARVEY_NUDGES = [
        "I don't have forever. What else.",
        "I bill in six minute increments. Somewhere in your head is a question. Let it out.",
        "You going to say something or should I bill you for the silence.",
        "My time runs a thousand a minute. I recommend you give me something to work with.",
        "Clock's running. Talk to me.",
        "Still here. Are you.",
        "Hey. You called me. Make it count.",
    ]

    # Off-the-record lore drops. When the user flips the OTR toggle in
    # the UI, the frontend publishes {type:"otr_on"} on the data channel.
    # That's our cue to have Harvey drop a Suits-world lore line
    # (Mike, Jessica, Donna, Hardman, Louis) so OTR is theatre, not just
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

    @session.on("error")
    def _on_error(ev) -> None:  # type: ignore[misc]
        err = getattr(ev, "error", ev)
        inner = getattr(err, "error", err)
        recoverable = bool(getattr(err, "recoverable", False))
        stage = type(err).__name__.replace("Error", "").lower() or "agent"
        log.error("%s failure (recoverable=%s): %r", stage.upper(), recoverable, inner)
        if not recoverable:
            msg = {
                "tts": "Harvey lost his voice: the text to speech provider rejected the request.",
                "llm": "Harvey can't think right now: the language model provider rejected the request.",
                "stt": "Harvey can't hear you: speech to text failed.",
            }.get(stage, "Harvey hit an error.")
            asyncio.ensure_future(publish_status(ctx.room, stage, False, msg))

    def _on_availability(kind: str):
        def handler(ev) -> None:
            name = getattr(getattr(ev, kind, None), "provider", "?")
            available = bool(getattr(ev, "available", False))
            log.warning("%s fallback: %s available=%s", kind.upper(), name, available)
            if not available:
                asyncio.ensure_future(
                    publish_status(ctx.room, kind, True, f"Harvey switched off {name} and is running on a backup {kind.upper()}.")
                )
        return handler

    if isinstance(session.tts, tts.FallbackAdapter):
        session.tts.on("tts_availability_changed", _on_availability("tts"))
    if isinstance(session.llm, llm.FallbackAdapter):
        session.llm.on("llm_availability_changed", _on_availability("llm"))

    @ctx.room.on("data_received")
    def _on_data(packet: rtc.DataPacket):  # type: ignore[misc]
        try:
            msg = json.loads(packet.data.decode("utf-8"))
        except Exception:
            return
        msg_type = msg.get("type")

        if msg_type == "otr_on":
            line = random.choice(HARVEY_LORE)
            log.info("OTR engaged, dropping lore: %r", line[:80])
            # livekit-agents 1.x: session.say() returns a SpeechHandle
            # (not a coroutine). It schedules the speech on the session's
            # loop internally, so just call it and let it fire. Wrapping
            # in asyncio.create_task() raises TypeError because a handle
            # is not awaitable by create_task.
            try:
                session.say(line, allow_interruptions=True)
            except Exception as exc:  # pragma: no cover — never crash the callback
                log.warning("OTR lore say failed: %s", exc)
            return

        if msg_type == "idle_nudge":
            line = random.choice(HARVEY_NUDGES)
            log.info("Idle nudge firing: %r", line[:80])
            try:
                session.say(line, allow_interruptions=True)
            except Exception as exc:  # pragma: no cover
                log.warning("Idle nudge say failed: %s", exc)
            return

    await session.start(
        agent=HarveyAgent(),
        room=ctx.room,
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
    """No-op prewarm.

    Previously this called get_rag() to warm Chroma before jobs arrived.
    That was a false optimization: with 4 LiveKit workers spawning in
    parallel, each worker's retry backoff (5 attempts × ~2s sleeps) plus
    flock serialization exceeded the 60s initialize_process_timeout.
    LiveKit would kill the process and respawn, creating a boot storm.

    Lazy init on the first cite_statute call works fine — the flock in
    rag.get_rag() already serializes concurrent opens. First call takes
    ~5s cold; every subsequent call hits the cached singleton.
    """
    log.info("prewarm: skipping RAG (lazy init on first tool call)")


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] in ("dev", "start", "console", "connect"):
        fatal, degraded = missing_config()
        for item in degraded:
            log.warning("DEGRADED: missing %s", item)
        if fatal:
            log.error("CANNOT START: missing %s", ", ".join(fatal))
            sys.exit(1)
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
            # 120s gives headroom for slow torch + silero loads on cold
            # Fly VMs. Even without RAG prewarm, the base imports
            # (torch, silero VAD model download, livekit plugins) can
            # push past the 60s default on a cold machine.
            initialize_process_timeout=120,
            num_idle_processes=1,
            agent_name=os.getenv("HARVEY_AGENT_NAME", ""),
        )
    )


if __name__ == "__main__":
    main()
