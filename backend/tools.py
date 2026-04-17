"""Function tools Harvey calls during a session.

Two tools total, each fires a data-channel event the frontend listens for:

  1. cite_statute(query)
     -> runs RAG over the Canadian legal PDF corpus and returns the
        most relevant passage + its source/section. Emits a
        `statute_card` event for the frontend to render.

  2. current_events(query)
     -> queries Google News RSS (no API key needed) and returns the
        top 5 headlines for the user's query. Emits a `news_ticker`
        event so the frontend can animate headlines in.

Data channel contract (UTF-8 JSON, reliable=True):
  {"type": "tool_call",    "payload": {"name": "...", "status": "running"}}
  {"type": "statute_card", "payload": {"jurisdiction","section","title","quote","source"}}
  {"type": "news_ticker",  "payload": {"query","items":[{title,source,published,link,summary}, ...]}}
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import re
import urllib.parse
import urllib.request
from typing import Any

import feedparser  # pulls google news RSS
from livekit.agents import RunContext, function_tool, get_job_context

from rag import get_rag

log = logging.getLogger("harvey.tools")


# ---------------------------------------------------------------------------
# Data-channel helpers
# ---------------------------------------------------------------------------

def _resolve_room(ctx: RunContext):
    """Find the LiveKit Room from the RunContext.

    In LiveKit Agents v1.x the room hangs off AgentSession via RoomIO:
    `ctx.session.room_io.room`. `get_job_context()` is the backup path
    that works anywhere inside the agent process.
    """
    # Preferred: RoomIO on the session
    try:
        room_io = getattr(ctx.session, "room_io", None)
        if room_io is not None and getattr(room_io, "room", None) is not None:
            return room_io.room
    except Exception:
        pass

    # Fallback: JobContext
    try:
        jc = get_job_context(required=False)
        if jc is not None:
            return getattr(jc, "room", None)
    except Exception:
        pass

    # Last resort: legacy attribute lookups
    return getattr(ctx.session, "room", None) or getattr(ctx, "room", None)


async def _publish(ctx: RunContext, payload: dict[str, Any]) -> None:
    """Send a JSON event to all participants over the LiveKit data channel."""
    room = _resolve_room(ctx)
    if room is None:
        log.warning("No room on RunContext — cannot publish %s", payload.get("type"))
        return

    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    try:
        await room.local_participant.publish_data(data, reliable=True)
        log.info("published %s (%d bytes)", payload.get("type"), len(data))
    except TypeError:
        # Older plugin signature expected kwarg
        await room.local_participant.publish_data(payload=data, reliable=True)
        log.info("published %s (%d bytes, kwarg path)", payload.get("type"), len(data))
    except Exception as exc:  # pragma: no cover
        log.exception("publish_data failed: %s", exc)


async def _emit_tool_call(ctx: RunContext, name: str) -> None:
    await _publish(ctx, {"type": "tool_call", "payload": {"name": name, "status": "running"}})


# ---------------------------------------------------------------------------
# Parsing helpers (for pretty statute display)
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
    for line in text.splitlines():
        line = line.strip()
        if 6 < len(line) < 120:
            return line
    return "Relevant Provision"


def _shorten(text: str, limit: int = 360) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut + "…"


# ---------------------------------------------------------------------------
# Tool 1 — cite_statute (RAG over legal corpus)
# ---------------------------------------------------------------------------

@function_tool
async def cite_statute(
    ctx: RunContext,
    query: str,
) -> str:
    """Look up the most relevant Canadian statute / passage for the user's
    situation. Use this ANY time the user's question requires citing a
    specific law, section, rule, or right.

    Args:
        query: A focused search phrase — the legal concept you need to
            find, NOT the user's full quote. E.g. "hit and run duty to
            remain at scene", "landlord refusing to return deposit",
            "overtime pay minimum threshold", "wrongful dismissal notice".
    """
    log.info("cite_statute(query=%r)", query)
    await _emit_tool_call(ctx, "cite_statute")

    rag = get_rag()
    hits = rag.retrieve(query, k=3)
    if not hits:
        await _publish(ctx, {
            "type": "statute_card",
            "payload": {
                "jurisdiction": "—",
                "section": "No match",
                "title": "No relevant passage found",
                "quote": f"Nothing in the corpus matched: {query}",
                "source": "",
            },
        })
        return "No matching statute found."

    top = hits[0]
    text = top["text"]
    section = top.get("section") or _guess_section(text, top.get("source", ""))
    title = top.get("title") or _guess_title(text)
    source = os.path.basename(top.get("source") or "").replace("_", " ").replace(".pdf", "")
    jurisdiction = top.get("jurisdiction") or (
        "Canada" if "canada_" in (top.get("source") or "") else
        "Ontario" if "ontario_" in (top.get("source") or "") else
        "—"
    )

    await _publish(ctx, {
        "type": "statute_card",
        "payload": {
            "jurisdiction": jurisdiction,
            "section": section,
            "title": _shorten(title, 90),
            "quote": _shorten(text, 360),
            "source": source,
        },
    })

    # Short summary fed back to the LLM — so Harvey can verbalize it.
    return f"{jurisdiction} {section}: {_shorten(text, 220)}"


# ---------------------------------------------------------------------------
# Tool 2 — current_events (Google News RSS)
# ---------------------------------------------------------------------------

def _normalize_news_item(entry: Any) -> dict[str, str]:
    # feedparser.FeedParserDict — fields are best-effort
    title = html.unescape(getattr(entry, "title", "") or "").strip()
    link = getattr(entry, "link", "") or ""
    published = getattr(entry, "published", "") or ""
    source = ""
    src_obj = getattr(entry, "source", None)
    if isinstance(src_obj, dict):
        source = src_obj.get("title", "") or ""
    elif src_obj is not None:
        source = getattr(src_obj, "title", "") or ""
    summary = html.unescape(getattr(entry, "summary", "") or "")
    # Google News RSS summaries often contain HTML; strip lazily.
    summary = re.sub(r"<[^>]+>", " ", summary)
    summary = " ".join(summary.split())
    return {
        "title": title,
        "source": source,
        "published": published,
        "link": link,
        "summary": summary[:260],
    }


@function_tool
async def current_events(
    ctx: RunContext,
    query: str,
) -> str:
    """Pull the top 5 recent news headlines for a query. Use this ONLY when
    the user asks about something recent, current, or time-sensitive
    ("what's happening with X", "the recent Y", "today's Z", "that
    merger", etc.). Canadian-biased results. Do not volunteer news
    unprompted.

    Args:
        query: Short search phrase — names, topics, or keywords. E.g.
            "Rogers Shaw merger", "Bank of Canada rate decision",
            "Toronto housing market".
    """
    log.info("current_events(query=%r)", query)
    await _emit_tool_call(ctx, "current_events")

    url = (
        "https://news.google.com/rss/search?q="
        + urllib.parse.quote(query)
        + "&hl=en-CA&gl=CA&ceid=CA:en"
    )
    try:
        feed = feedparser.parse(url)
    except Exception as exc:  # pragma: no cover
        log.exception("feedparser failed: %s", exc)
        return "News lookup failed."

    entries = list(getattr(feed, "entries", []))[:5]
    items = [_normalize_news_item(e) for e in entries]

    await _publish(ctx, {
        "type": "news_ticker",
        "payload": {"query": query, "items": items},
    })

    # Also fire an `article_spotlight` for the TOP headline so the
    # frontend can render a hero summary card that opens alongside the
    # ticker. Gives the UI a multi-layered feel while Harvey talks.
    if items:
        top = items[0]
        await _publish(ctx, {
            "type": "article_spotlight",
            "payload": {
                "query": query,
                "title": top["title"],
                "source": top["source"],
                "published": top["published"],
                "link": top["link"],
                "summary": top["summary"] or top["title"],
            },
        })

    if not items:
        return f"No news found for {query}."

    # Short plain-text summary Harvey can verbalize
    bullets = [f"{i+1}. {it['title']} ({it['source'] or 'unknown'})"
               for i, it in enumerate(items[:3])]
    return f"Top on '{query}':\n" + "\n".join(bullets)


# ---------------------------------------------------------------------------
# Tool 3 — stock_ticker (Yahoo Finance)
# ---------------------------------------------------------------------------

# Minimal company → ticker map; Harvey also sometimes passes the ticker
# directly (e.g. "AAPL") which we just pass through.
_COMPANY_TO_TICKER: dict[str, str] = {
    "apple": "AAPL",
    "amazon": "AMZN",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "microsoft": "MSFT",
    "tesla": "TSLA",
    "meta": "META",
    "facebook": "META",
    "netflix": "NFLX",
    "nvidia": "NVDA",
    "amd": "AMD",
    "intel": "INTC",
    "shopify": "SHOP",
    "rbc": "RY",
    "royal bank": "RY",
    "td bank": "TD",
    "td": "TD",
    "bmo": "BMO",
    "scotiabank": "BNS",
    "bns": "BNS",
    "cibc": "CM",
    "rogers": "RCI-B.TO",
    "telus": "T.TO",
    "bell": "BCE.TO",
    "openai": None,  # private; skip
    "anthropic": None,  # private; skip
}


def _resolve_ticker(raw: str) -> str | None:
    """Best-effort: map a user string to a Yahoo Finance ticker."""
    s = raw.strip().lower()
    if not s:
        return None
    # Direct ticker form — ALL CAPS, optionally with exchange suffix
    m = re.match(r"^[A-Z]{1,6}(\.[A-Z]{1,4})?$", raw.strip())
    if m:
        return raw.strip()
    # Company name lookup
    for name, ticker in _COMPANY_TO_TICKER.items():
        if name in s:
            return ticker
    # Fallback: if short and alphanumeric, assume ticker
    if re.match(r"^[A-Za-z]{1,6}$", raw.strip()):
        return raw.strip().upper()
    return None


def _fetch_yahoo_quote(ticker: str) -> dict[str, Any] | None:
    """Sync HTTP call to Yahoo Finance's public chart endpoint. Returns
    a flat dict of the most useful fields, or None on failure."""
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + urllib.parse.quote(ticker)
        + "?interval=1d&range=5d"
    )
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (harvey-agent)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # pragma: no cover
        log.warning("Yahoo Finance fetch failed for %s: %s", ticker, exc)
        return None

    try:
        result = data["chart"]["result"][0]
        meta = result.get("meta", {})
        price = meta.get("regularMarketPrice")
        prev = meta.get("previousClose") or meta.get("chartPreviousClose")
        if price is None or prev is None:
            return None
        change = price - prev
        change_pct = (change / prev) * 100 if prev else 0
        return {
            "symbol": meta.get("symbol", ticker),
            "shortName": meta.get("shortName") or meta.get("longName") or ticker,
            "currency": meta.get("currency", "USD"),
            "price": round(price, 2),
            "previousClose": round(prev, 2),
            "change": round(change, 2),
            "changePct": round(change_pct, 2),
            "dayHigh": meta.get("regularMarketDayHigh"),
            "dayLow": meta.get("regularMarketDayLow"),
            "fiftyTwoWeekHigh": meta.get("fiftyTwoWeekHigh"),
            "fiftyTwoWeekLow": meta.get("fiftyTwoWeekLow"),
            "exchange": meta.get("exchangeName") or meta.get("fullExchangeName", ""),
        }
    except (KeyError, IndexError, TypeError) as exc:
        log.warning("Parse error for %s: %s", ticker, exc)
        return None


@function_tool
async def stock_ticker(
    ctx: RunContext,
    company_or_symbol: str,
) -> str:
    """Fetch the latest stock quote for a publicly-traded company.
    Call this AGGRESSIVELY any time a public company is mentioned in the
    conversation (e.g. "Apple", "Amazon", "Tesla", "RBC", or a ticker
    like "AAPL"). A live stock card will appear on the LEFT side of the
    user's screen.

    Args:
        company_or_symbol: Either a company name ("Apple", "Rogers"),
            or a ticker symbol ("AAPL", "RY", "SHOP.TO"). Strip
            punctuation. If the user names two companies, call this
            tool separately for each.
    """
    log.info("stock_ticker(company_or_symbol=%r)", company_or_symbol)
    await _emit_tool_call(ctx, "stock_ticker")

    ticker = _resolve_ticker(company_or_symbol)
    if not ticker:
        await _publish(ctx, {
            "type": "stock_card",
            "payload": {
                "query": company_or_symbol,
                "error": "not_public",
                "message": f"{company_or_symbol} isn't on a public exchange.",
            },
        })
        return f"{company_or_symbol} isn't publicly listed."

    # Run the blocking HTTP call off the event loop
    quote = await asyncio.to_thread(_fetch_yahoo_quote, ticker)
    if quote is None:
        await _publish(ctx, {
            "type": "stock_card",
            "payload": {
                "query": company_or_symbol,
                "ticker": ticker,
                "error": "fetch_failed",
                "message": f"No live quote for {ticker}.",
            },
        })
        return f"Couldn't pull a live quote for {ticker}."

    await _publish(ctx, {
        "type": "stock_card",
        "payload": {"query": company_or_symbol, **quote},
    })

    # Short verbalization
    direction = "up" if quote["change"] >= 0 else "down"
    return (
        f"{quote['shortName']} ({quote['symbol']}) at "
        f"{quote['price']} {quote['currency']}, {direction} "
        f"{abs(quote['changePct'])}% on the day."
    )


# ---------------------------------------------------------------------------
# Tool registry — imported by agent.py
# ---------------------------------------------------------------------------

ALL_TOOLS = [cite_statute, current_events, stock_ticker]
