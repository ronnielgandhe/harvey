"""RAG pipeline: Chroma-backed retriever over ingested legal corpus."""

from __future__ import annotations

import fcntl
import logging
import os
import re
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings


# PDFs ingested from multi-column layouts carry physical line-break
# hyphens in the middle of words ("commis-\nsion", "occupa- tion").
# The RAG chunks preserve those breaks verbatim, which renders as
# broken words in the frontend statute card. Join them back before
# returning to the caller.
#   - "foo-\nbar"  → "foobar"  (hard hyphen + newline)
#   - "foo- bar"   → "foobar"  (hyphen + stray space, common when PDF
#                               extraction replaces newlines with spaces)
# We only collapse lowercase+hyphen+(whitespace)+lowercase; real
# compound words like "cross-border" or "self-employment" keep their
# hyphen because they don't sit across a line break.
_DEHYPHEN_RE = re.compile(r"([a-z])-\s+([a-z])")


def _clean_chunk(text: str) -> str:
    text = _DEHYPHEN_RE.sub(r"\1\2", text)
    # Collapse 3+ consecutive newlines to a single blank line so page
    # breaks don't create huge vertical gaps in the rendered quote.
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

logger = logging.getLogger("harvey.rag")

DEFAULT_PERSIST_DIR = os.getenv(
    "HARVEY_CHROMA_DIR",
    str((Path(__file__).resolve().parent.parent / "data" / "chroma_db")),
)
DEFAULT_COLLECTION = os.getenv("HARVEY_COLLECTION", "harvey_legal")
EMBEDDING_MODEL = "text-embedding-3-small"


class LegalRAG:
    """Thin wrapper around a persisted Chroma collection."""

    def __init__(
        self,
        persist_dir: str = DEFAULT_PERSIST_DIR,
        collection_name: str = DEFAULT_COLLECTION,
    ) -> None:
        self.persist_dir = persist_dir
        self.collection_name = collection_name
        self._embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
        Path(persist_dir).mkdir(parents=True, exist_ok=True)
        self._store = Chroma(
            collection_name=collection_name,
            embedding_function=self._embeddings,
            persist_directory=persist_dir,
        )
        # Log the actual document count — if this is 0, the Chroma DB
        # files didn't ship in the Docker image (or chromadb version
        # mismatch broke schema read).
        try:
            doc_count = self._store._collection.count()
        except Exception as exc:
            doc_count = -1
            logger.warning("could not read collection count: %s", exc)
        logger.info(
            "LegalRAG initialized (collection=%s, persist_dir=%s, docs=%d)",
            collection_name,
            persist_dir,
            doc_count,
        )

    def retrieve(self, query: str, k: int = 4) -> list[dict]:
        """Return top-k chunks using a two-stage LLM-routed pipeline.

        Stage 1 — classify.  A fast LLM call (gpt-4o-mini) reads the
        user's raw query, sees the list of available statutes, and
        returns which one the question is most likely asking about
        plus a tightened query string optimized for semantic search.
        This catches the cases that pure vector similarity flubs:
        acronyms ("N12"), common words that appear in many statutes
        ("assault" exists as a term in HTA too), and questions
        phrased in plain English that don't share vocabulary with
        the statute text.

        Stage 2 — retrieve.  We run a Chroma similarity search FILTERED
        to the classifier's predicted source (if confident). If the
        classifier is unsure we fall back to keyword-route boosting.
        Noise filtering is applied last and is light-touch — we only
        drop truly empty chunks, not everything with "Marginal note:"
        which is part of every real Criminal Code section.
        """
        routing = classify_query(query)
        logger.info(
            "retrieve: classified %r -> source=%s confidence=%.2f refined=%r",
            query[:60],
            routing["source"],
            routing["confidence"],
            routing["refined_query"][:80] if routing.get("refined_query") else "",
        )

        search_query = routing.get("refined_query") or query

        # If classifier is confident, constrain Chroma to that source.
        # Otherwise retrieve broadly and let the keyword boost + vector
        # distance choose.
        where: Optional[dict] = None
        if routing["confidence"] >= 0.6 and routing["source"]:
            where = {"source": routing["source"]}

        try:
            raw = self._store.similarity_search_with_score(
                search_query,
                k=max(k * 4, 16),
                filter=where,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Chroma retrieval failed: %s", exc)
            return []

        # Fallback: if filtered search returns nothing (e.g. classifier
        # picked a source with no matching chunks), retry unfiltered.
        if not raw and where is not None:
            logger.info("retrieve: filtered search empty, retrying unfiltered")
            try:
                raw = self._store.similarity_search_with_score(
                    search_query, k=max(k * 4, 16)
                )
            except Exception:
                return []

        keyword_sources = _route_query_to_sources(query)

        scored: list[tuple[float, dict]] = []
        for doc, distance in raw:
            md = doc.metadata or {}
            source = md.get("source", "unknown")
            text = _clean_chunk(doc.page_content)
            if _is_empty_chunk(text):
                continue
            rank_score = distance
            if keyword_sources and source in keyword_sources:
                rank_score -= 0.15
            alpha_ratio = sum(c.isalpha() for c in text) / max(len(text), 1)
            rank_score -= alpha_ratio * 0.05
            scored.append((rank_score, {
                "text": text,
                "source": source,
                "page": md.get("page", 0),
                "jurisdiction": md.get("jurisdiction", "Unknown"),
                "section": md.get("section", ""),
                "title": md.get("title", ""),
                "_score": rank_score,
                "_raw_distance": distance,
            }))

        scored.sort(key=lambda x: x[0])
        results = [item for _, item in scored[:k]]

        if results:
            logger.info(
                "retrieve: -> top=%s (score=%.3f)",
                results[0]["source"],
                results[0]["_score"],
            )
        return results


# ---------------------------------------------------------------------------
# Query routing + chunk quality helpers
# ---------------------------------------------------------------------------

# Map: keyword (case-insensitive, word-boundary) -> set of source filenames
# that chunks from. If ANY keyword hits in the query, the matched sources
# are "preferred" and get a score boost during reranking. Order doesn't
# matter — we union the hits. The whole point is to rescue acronyms,
# named forms, and jargon that don't embed meaningfully.
_ROUTE_RULES: tuple[tuple[re.Pattern, str], ...] = (
    # ─── Ontario Residential Tenancies Act ─────────────────────────
    (re.compile(r"\b(n4|n5|n6|n7|n8|n9|n10|n11|n12|n13|n14)\b", re.I),
     "ontario_residential_tenancies_act.html"),
    (re.compile(
        r"\b(landlord|tenant|tenancy|eviction|evict|lease|rent|rental|"
        r"rooming|roommate|sublet|sublease|ltb|landlord and tenant board|"
        r"residential tenanc)\b",
        re.I,
    ), "ontario_residential_tenancies_act.html"),

    # ─── Criminal Code of Canada ───────────────────────────────────
    (re.compile(
        r"\b(assault|battery|theft|steal|stole|robbery|robbed|fraud|"
        r"mischief|break and enter|b&e|burglary|sexual assault|consent|"
        r"murder|manslaughter|homicide|weapon|firearm|arson|stalking|"
        r"criminal harassment|uttering threats|impersonation|extortion|"
        r"conspiracy|aiding|abetting|accessory|indictable|summary conviction|"
        r"criminal code|criminal record|bail|probation|peace bond|"
        r"recognizance|obstruction|perjury)\b",
        re.I,
    ), "canada_criminal_code.html"),
    # Section number references common to Criminal Code discussion.
    (re.compile(r"\b(section|s\.)\s*(26[0-9]|27[0-9]|3[0-9]{2}|4[0-9]{2})\b", re.I),
     "canada_criminal_code.html"),

    # ─── Ontario Highway Traffic Act ───────────────────────────────
    (re.compile(
        r"\b(speeding|speed limit|stunt driving|racing|careless driving|"
        r"dangerous driving|licence suspension|suspended licence|"
        r"demerit points|traffic ticket|highway traffic|moving violation|"
        r"street racing|hit and run|leaving the scene|g1|g2|class g|"
        r"impaired driving|drunk driving|novice driver|graduated licence)\b",
        re.I,
    ), "ontario_highway_traffic_act.html"),

    # ─── Ontario Employment Standards Act ──────────────────────────
    (re.compile(
        r"\b(minimum wage|overtime|paid break|vacation pay|termination pay|"
        r"severance|employment standards|public holiday|stat holiday|"
        r"maternity leave|parental leave|pregnancy leave|sick leave|"
        r"esa|pay stub|wage|tip|gratuity|pay in lieu|notice of termination|"
        r"constructive dismissal|reprisal|unpaid internship)\b",
        re.I,
    ), "ontario_employment_standards_act.html"),

    # ─── Canada Cannabis Act ───────────────────────────────────────
    (re.compile(
        r"\b(cannabis|marijuana|marihuana|weed|pot|joint|edible|thc|"
        r"cbd|possession limit|public consumption)\b",
        re.I,
    ), "canada_cannabis_act.html"),

    # ─── Canada Controlled Drugs and Substances Act ────────────────
    (re.compile(
        r"\b(cocaine|coke|methamphetamine|meth|heroin|fentanyl|opioid|"
        r"mdma|ecstasy|molly|psilocybin|shroom|ketamine|lsd|acid|"
        r"schedule [iv]+|controlled substance|trafficking|production|"
        r"drug possession|drug trafficking)\b",
        re.I,
    ), "canada_controlled_drugs_and_substances_act.html"),

    # ─── Ontario Consumer Protection ───────────────────────────────
    (re.compile(
        r"\b(consumer|refund|return|cooling off|warranty|deceptive|"
        r"door-to-door|contract|online purchase)\b",
        re.I,
    ), "ontario_consumer_protection_business_guide.pdf"),
    (re.compile(
        r"\b(consumer|refund|return|cooling off|warranty|deceptive|"
        r"door-to-door|contract|online purchase)\b",
        re.I,
    ), "ontario_consumer_protection_act_guide.pdf"),
)


def _route_query_to_sources(query: str) -> set[str]:
    """Return the set of source filenames the query should be biased toward."""
    hits: set[str] = set()
    for pattern, source in _ROUTE_RULES:
        if pattern.search(query):
            hits.add(source)
    return hits


# Patterns that indicate a chunk is boilerplate / nav / marginal notes
# instead of actual statute text. Retrieval results matching these get
# dropped before reranking so they can't outscore real content.
_NOISE_RE = re.compile(
    r"^(?:\s*(?:\([a-z0-9.]+\)|\d+(?:\.\d+)*)\s*){5,}$",  # long run of just section markers
    re.M,
)


def _is_empty_chunk(text: str) -> bool:
    """Drop only truly empty chunks. Previous noise filter was rejecting
    every Criminal Code chunk because they all contain 'Marginal note:'
    as part of the real statute structure — that was over-aggressive."""
    if len(text) < 60:
        return True
    words = re.findall(r"[A-Za-z]{3,}", text)
    return len(words) < 8


# ---------------------------------------------------------------------------
# LLM query classifier
# ---------------------------------------------------------------------------

# Sources the classifier can pick from, with a short description of
# what each contains so the model can match a plain-English query to
# the right statute without needing keyword matches.
_CORPUS_SOURCES = [
    (
        "canada_criminal_code.html",
        "Canada Criminal Code. Assault, battery, theft, robbery, fraud, "
        "mischief, break-and-enter, sexual offences, murder, weapons, "
        "arson, stalking, uttering threats, extortion, conspiracy, "
        "bail, probation, peace bonds. Section references like 265, "
        "322, 380.",
    ),
    (
        "ontario_highway_traffic_act.html",
        "Ontario Highway Traffic Act. Speeding, stunt driving, racing, "
        "careless driving, licence suspensions, demerit points, traffic "
        "tickets, graduated licensing (G1/G2), novice drivers, "
        "hit-and-run, leaving the scene of an accident.",
    ),
    (
        "ontario_residential_tenancies_act.html",
        "Ontario Residential Tenancies Act. Leases, evictions, rent "
        "increases, roommates, subletting, landlord entry, landlord and "
        "tenant board (LTB), N-series eviction notices (N4, N5, N8, "
        "N11, N12, N13), security deposits, last month's rent.",
    ),
    (
        "ontario_employment_standards_act.html",
        "Ontario Employment Standards Act. Minimum wage, overtime, "
        "vacation pay, public holidays, tips, termination pay, "
        "severance, pregnancy leave, parental leave, sick leave, "
        "constructive dismissal, unpaid internships.",
    ),
    (
        "canada_cannabis_act.html",
        "Canada Cannabis Act. Legal cannabis possession limits, public "
        "consumption, age minimums, edibles, distribution.",
    ),
    (
        "canada_controlled_drugs_and_substances_act.html",
        "Canada Controlled Drugs and Substances Act. Illegal drugs "
        "OTHER than cannabis — cocaine, meth, heroin, fentanyl, MDMA, "
        "psilocybin, LSD, ketamine. Possession, trafficking, schedules.",
    ),
    (
        "ontario_consumer_protection_business_guide.pdf",
        "Ontario Consumer Protection. Refunds, returns, warranties, "
        "cooling-off periods, door-to-door sales, deceptive contracts.",
    ),
]

_CLASSIFIER_SYSTEM = (
    "You are a routing classifier for a legal RAG system. Given a "
    "user's legal question, pick the ONE statute from the list that "
    "most likely contains the answer. Also return a tightened search "
    "query optimized for semantic similarity against the statute's "
    "actual wording.\n\n"
    "Available sources:\n"
    + "\n".join(f"- {src}: {desc}" for src, desc in _CORPUS_SOURCES)
    + "\n\nReturn JSON with keys: source (one of the exact filenames "
    "above or empty string if none fit), confidence (0..1), "
    "refined_query (a short query optimized for vector search). "
    "Pick the most specific source. If the question spans multiple "
    "areas, pick the primary one. Return only JSON."
)

_classifier_client = None


def _get_classifier_client():
    global _classifier_client
    if _classifier_client is None:
        from openai import OpenAI
        _classifier_client = OpenAI()
    return _classifier_client


def classify_query(query: str) -> dict:
    """Use gpt-4o-mini to decide which source this query targets and
    return a search-optimized rewrite of the question.

    Returns:
        {"source": str, "confidence": float, "refined_query": str}
    On any failure falls back to {"source": "", "confidence": 0.0,
    "refined_query": query} so retrieval still works.
    """
    if not os.getenv("OPENAI_API_KEY"):
        return {"source": "", "confidence": 0.0, "refined_query": query}
    try:
        client = _get_classifier_client()
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _CLASSIFIER_SYSTEM},
                {"role": "user", "content": query},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=160,
        )
        import json as _json
        data = _json.loads(resp.choices[0].message.content or "{}")
        source = str(data.get("source", "")).strip()
        confidence = float(data.get("confidence", 0.0) or 0.0)
        refined = str(data.get("refined_query", "")).strip() or query
        # Sanity check: source must be a known one.
        known = {s for s, _ in _CORPUS_SOURCES}
        if source and source not in known:
            source = ""
            confidence = 0.0
        return {
            "source": source,
            "confidence": max(0.0, min(1.0, confidence)),
            "refined_query": refined,
        }
    except Exception as exc:  # pragma: no cover
        logger.warning("classify_query failed: %s", exc)
        return {"source": "", "confidence": 0.0, "refined_query": query}


# ---------------------------------------------------------------------------
# Lazy singleton
# ---------------------------------------------------------------------------

_INSTANCE: Optional[LegalRAG] = None

# Cross-process lock file. LiveKit spawns N worker processes (one per CPU)
# and prewarm fires in all of them concurrently. Chroma's Rust connection
# pool can't handle 4 simultaneous opens against the same persist dir —
# 3 time out, the RustBindingsAPI ends up half-initialized, and even
# subsequent healthy calls hit 'RustBindingsAPI has no attribute bindings'.
# Serializing init through an OS-level exclusive flock guarantees only one
# process opens Chroma at a time; retries become a safety net, not the
# primary correctness mechanism.
_LOCK_PATH = "/tmp/harvey_rag_init.lock"


@contextmanager
def _init_lock():
    """Hold an exclusive OS-level flock for the duration of Chroma init."""
    fd = os.open(_LOCK_PATH, os.O_CREAT | os.O_RDWR, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            os.close(fd)


def _reset_chromadb_caches() -> None:
    """Nuke chromadb's module-level client caches.

    When Chroma's Rust bindings time out during init, chromadb leaves a
    half-initialized SharedSystemClient entry keyed by settings-hash in
    a dict on the class. Every retry in the same Python process then
    re-uses that broken entry and fails with
    'RustBindingsAPI object has no attribute bindings'.
    Clearing the dict forces the next attempt to construct a fresh
    client. gc.collect() ensures any dangling Rust bindings finalize
    (releasing FDs and the pool slot) before we retry.
    """
    try:
        from chromadb.api.shared_system_client import SharedSystemClient
        # chromadb has shipped this attribute under both spellings; try
        # each one defensively so a future chromadb release that fixes
        # the typo doesn't break us.
        for attr in ("_identifer_to_system", "_identifier_to_system"):
            cache = getattr(SharedSystemClient, attr, None)
            if isinstance(cache, dict):
                cache.clear()
    except Exception as exc:  # pragma: no cover — best-effort cleanup
        logger.debug("reset_chromadb_caches: skipped (%s)", exc)
    import gc
    gc.collect()


def get_rag() -> LegalRAG:
    """Return the shared RAG instance, retrying init on failure.

    Two layers of defense against Chroma's Rust connection-pool fragility:
    1. fcntl exclusive file lock — only one process instantiates Chroma
       at a time across the whole VM.
    2. Retry loop with backoff — if something else still fails (disk
       hiccup, race against ingest, etc.), don't cache the broken state.
    """
    global _INSTANCE
    if _INSTANCE is not None:
        return _INSTANCE

    # ONE attempt with a real timeout. chromadb's Rust pool has its
    # own ~30s timeout on cold-start; retrying just burns more time.
    # If it genuinely can't open in 90s something is fundamentally
    # wrong — better to fail fast and let the LLM try again on the
    # next user turn than to eat 4 × 30s = 2 minutes of dead air.
    try:
        with _init_lock():
            if _INSTANCE is not None:
                return _INSTANCE
            _INSTANCE = LegalRAG()
            return _INSTANCE
    except Exception as exc:
        logger.error("LegalRAG init failed: %s", exc)
        _reset_chromadb_caches()
        raise
