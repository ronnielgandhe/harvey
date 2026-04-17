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
        """Return top-k chunks as dicts with text + metadata."""
        try:
            results = self._store.similarity_search(query, k=k)
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Chroma retrieval failed: %s", exc)
            return []

        out: list[dict] = []
        for doc in results:
            md = doc.metadata or {}
            out.append(
                {
                    "text": _clean_chunk(doc.page_content),
                    "source": md.get("source", "unknown"),
                    "page": md.get("page", 0),
                    "jurisdiction": md.get("jurisdiction", "Unknown"),
                    "section": md.get("section", ""),
                    "title": md.get("title", ""),
                }
            )
        return out


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

    last_exc: Optional[Exception] = None
    # 3 attempts instead of 5: with lazy init (RAG out of prewarm) there's
    # no longer 4-worker contention at boot. Most cold starts succeed on
    # attempt 1; attempt 2 handles the occasional Rust-pool hiccup.
    for attempt in range(3):
        try:
            with _init_lock():
                # Re-check inside the lock: another call might have
                # populated _INSTANCE while we waited on the flock.
                if _INSTANCE is not None:
                    return _INSTANCE
                _INSTANCE = LegalRAG()
                return _INSTANCE
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "LegalRAG init failed (attempt %d/3): %s",
                attempt + 1,
                exc,
            )
            # Short backoff — if chromadb is truly broken, faster failure
            # is better than hanging the first tool call for 20+ seconds.
            time.sleep(1.0 + attempt * 1.0)

    assert last_exc is not None
    raise last_exc
