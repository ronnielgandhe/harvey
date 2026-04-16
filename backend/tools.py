"""Function tools Harvey calls during a session.

Each tool:
  - emits a JSON message to the LiveKit data channel (frontend listens)
  - returns a short string the LLM can verbalize

Data channel contract (UTF-8 JSON bytes, reliable=True):
  {"type": "tool_call",        "payload": {"name": "...", "status": "running"}}
  {"type": "statute_card",     "payload": {"jurisdiction","section","title","quote"}}
  {"type": "case_file_update", "payload": {"field","value"}}
  {"type": "draft_response",   "payload": {"recipient","tone","body"}}
  {"type": "negotiation_play", "payload": {"steps":[{"label","text"}, ...]}}
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from livekit.agents import RunContext, function_tool
from openai import AsyncOpenAI

from rag import get_rag

log = logging.getLogger("harvey.tools")

_openai: AsyncOpenAI | None = None
DRAFT_MODEL = "gpt-4o"


def _get_openai() -> AsyncOpenAI:
    global _openai
    if _openai is None:
        _openai = AsyncOpenAI()
    return _openai


# ---------------------------------------------------------------------------
# Data channel helper
# ---------------------------------------------------------------------------

async def _publish(ctx: RunContext, payload: dict[str, Any]) -> None:
    """Send a JSON event to all participants over the data channel."""
    try:
        room = ctx.session.room  # AgentSession exposes the connected Room
    except AttributeError:
        room = None

    if room is None:
        # Fallback for older API surfaces
        room = getattr(ctx, "room", None)

    if room is None:
        log.warning("No room on RunContext — cannot publish %s", payload.get("type"))
        return

    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    try:
        await room.local_participant.publish_data(data, reliable=True)
    except TypeError:
        # Some versions take keyword `payload=` instead of positional bytes
        await room.local_participant.publish_data(payload=data, reliable=True)
    except Exception as exc:  # pragma: no cover
        log.exception("publish_data failed: %s", exc)


async def _emit_tool_call(ctx: RunContext, name: str) -> None:
    await _publish(ctx, {"type": "tool_call", "payload": {"name": name, "status": "running"}})


# ---------------------------------------------------------------------------
# Helpers for statute extraction
# ---------------------------------------------------------------------------

_SECTION_RE = re.compile(
    r"(?:§|section|sec\.?|s\.)\s*([0-9]+(?:\.[0-9]+)?(?:\([a-z0-9]+\))?)",
    re.IGNORECASE,
)


def _guess_section(text: str, fallback_source: str) -> str:
    m = _SECTION_RE.search(text)
    if m:
        return f"§ {m.group(1)}"
    return os.path.splitext(os.path.basename(fallback_source))[0].replace("_", " ").title()


def _guess_title(text: str) -> str:
    # First non-empty line, trimmed
    for line in text.splitlines():
        line = line.strip()
        if 6 < len(line) < 120:
            return line
    return "Relevant Provision"


def _shorten(text: str, limit: int = 320) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + "…"


# ---------------------------------------------------------------------------
# Tool 1: pull_statute
# ---------------------------------------------------------------------------

@function_tool
async def pull_statute(
    ctx: RunContext,
    jurisdiction: str,
    query: str,
) -> str:
    """Look up a statute, regulation, or legal duty in the firm's research corpus.

    ALWAYS call this before discussing any specific law. Do not invent section
    numbers or quotes. Pass the jurisdiction (e.g. "Ontario", "New York",
    "Federal") and a focused natural-language query describing what you need.

    Returns a short summary the assistant can read aloud; the full statute card
    is rendered on the user's screen.
    """
    await _emit_tool_call(ctx, "pull_statute")
    log.info("pull_statute(jurisdiction=%r, query=%r)", jurisdiction, query)

    rag = get_rag()
    # Bias retrieval toward the requested jurisdiction
    results = rag.retrieve(f"[{jurisdiction}] {query}", k=4)

    if not results:
        await _publish(ctx, {
            "type": "statute_card",
            "payload": {
                "jurisdiction": jurisdiction,
                "section": "—",
                "title": "No match in corpus",
                "quote": f"Nothing on '{query}' in the {jurisdiction} materials.",
            },
        })
        return f"No hit in the {jurisdiction} corpus for {query!r}. Tell the user you're working from principle, not citation."

    # Prefer a result whose metadata jurisdiction matches; else top result
    top = next(
        (r for r in results if jurisdiction.lower() in r.get("jurisdiction", "").lower()),
        results[0],
    )

    quote = _shorten(top["text"])
    section = top.get("section") or _guess_section(top["text"], top["source"])
    title = top.get("title") or _guess_title(top["text"])

    await _publish(ctx, {
        "type": "statute_card",
        "payload": {
            "jurisdiction": top.get("jurisdiction") or jurisdiction,
            "section": section,
            "title": title,
            "quote": quote,
            "source": top.get("source"),
            "page": top.get("page"),
        },
    })

    return (
        f"Pulled {section} — {title} ({top.get('jurisdiction') or jurisdiction}). "
        f"Key text: {quote[:180]}"
    )


# ---------------------------------------------------------------------------
# Tool 2: update_case_file
# ---------------------------------------------------------------------------

@function_tool
async def update_case_file(
    ctx: RunContext,
    field: str,
    value: str,
) -> str:
    """Log a fact about the situation to the case file shown on screen.

    ALWAYS call this the moment the user gives you a new fact. One field per
    call. Common fields: parties, date, location, jurisdiction, incident_type,
    evidence, damages, opposing_party, action_items.
    """
    await _emit_tool_call(ctx, "update_case_file")
    log.info("update_case_file(%s=%r)", field, value)

    await _publish(ctx, {
        "type": "case_file_update",
        "payload": {"field": field, "value": value},
    })
    return "Logged."


# ---------------------------------------------------------------------------
# Tool 3: draft_response
# ---------------------------------------------------------------------------

_DRAFT_SYSTEM = (
    "You are Harvey Specter's drafting clerk. Produce one piece of "
    "correspondence — 100 to 200 words. No greetings beyond a single line. "
    "No legal disclaimers. Direct, declarative, and tactically sharp. "
    "Match the requested tone. Output the body only — no subject line, "
    "no signature block beyond 'Harvey Specter, Pearson Specter Litt'."
)


@function_tool
async def draft_response(
    ctx: RunContext,
    situation: str,
    recipient: str,
    tone: str = "firm",
) -> str:
    """Draft a 100-200 word email or letter the user can send.

    Call this whenever the user needs to send something — to insurance,
    opposing counsel, an employer, a landlord, etc.

    Args:
        situation: One or two sentences describing what the letter must accomplish.
        recipient: Who it's addressed to (e.g. "Insurance adjuster at Allstate").
        tone: "firm" (default), "diplomatic", "aggressive", or "conciliatory".
    """
    await _emit_tool_call(ctx, "draft_response")
    log.info("draft_response(recipient=%r, tone=%r)", recipient, tone)

    user_prompt = (
        f"Recipient: {recipient}\n"
        f"Tone: {tone}\n"
        f"Situation: {situation}\n\n"
        "Write the letter body now."
    )

    try:
        resp = await _get_openai().chat.completions.create(
            model=DRAFT_MODEL,
            messages=[
                {"role": "system", "content": _DRAFT_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=400,
        )
        body = (resp.choices[0].message.content or "").strip()
    except Exception as exc:
        log.exception("draft_response LLM call failed: %s", exc)
        body = (
            f"[Draft generation failed: {exc}. Retry in a moment.]"
        )

    await _publish(ctx, {
        "type": "draft_response",
        "payload": {"recipient": recipient, "tone": tone, "body": body},
    })
    return "Draft is on your screen."


# ---------------------------------------------------------------------------
# Tool 4: negotiation_play
# ---------------------------------------------------------------------------

_PLAY_SYSTEM = (
    "You are Harvey Specter's negotiation strategist. Output strict JSON only "
    "with this schema: {\"steps\": [{\"label\":\"Anchor\",\"text\":\"...\"},"
    "{\"label\":\"Counter\",\"text\":\"...\"},{\"label\":\"Walkaway\",\"text\":\"...\"}]}. "
    "Each text field is 1-2 sharp sentences, plain English, tactically usable today."
)


@function_tool
async def negotiation_play(
    ctx: RunContext,
    scenario: str,
    your_position: str,
) -> str:
    """Generate a 3-step negotiation framework: anchor, counter, walkaway.

    Call this the moment a negotiation is on the table — settlement talks,
    counter-offers, demand letters, salary, contract terms.

    Args:
        scenario: What's being negotiated and against whom.
        your_position: What outcome the user actually wants.
    """
    await _emit_tool_call(ctx, "negotiation_play")
    log.info("negotiation_play(scenario=%r)", scenario)

    user_prompt = (
        f"Scenario: {scenario}\n"
        f"Your desired outcome: {your_position}\n\n"
        "Return the JSON now."
    )

    steps: list[dict[str, str]]
    try:
        resp = await _get_openai().chat.completions.create(
            model=DRAFT_MODEL,
            messages=[
                {"role": "system", "content": _PLAY_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=400,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        parsed = json.loads(raw)
        steps = parsed.get("steps") or []
        # Normalize
        steps = [
            {"label": str(s.get("label", "")), "text": str(s.get("text", ""))}
            for s in steps
            if isinstance(s, dict)
        ][:3]
    except Exception as exc:
        log.exception("negotiation_play LLM call failed: %s", exc)
        steps = [
            {"label": "Anchor", "text": f"[Generation failed: {exc}]"},
            {"label": "Counter", "text": ""},
            {"label": "Walkaway", "text": ""},
        ]

    await _publish(ctx, {
        "type": "negotiation_play",
        "payload": {"steps": steps},
    })
    return "Here's how we play it."


# ---------------------------------------------------------------------------
# Convenience: list of all tools to register on the agent
# ---------------------------------------------------------------------------

ALL_TOOLS = [pull_statute, update_case_file, draft_response, negotiation_play]
