"""RAG pipeline: Chroma-backed retriever over ingested legal corpus."""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Optional

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

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
                    "text": doc.page_content,
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


def get_rag() -> LegalRAG:
    """Return the shared RAG instance, retrying init on failure.

    Chroma's Rust bindings have a connection pool that times out if
    multiple worker processes try to open the same persist dir at once.
    On pool timeout the RustBindingsAPI ends up half-initialized
    ('RustBindingsAPI object has no attribute bindings') and the Python
    constructor raises. DON'T cache that broken state — retry with
    backoff so the next call has a shot at a healthy client.
    """
    global _INSTANCE
    if _INSTANCE is not None:
        return _INSTANCE

    last_exc: Optional[Exception] = None
    for attempt in range(5):
        try:
            _INSTANCE = LegalRAG()
            return _INSTANCE
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "LegalRAG init failed (attempt %d/5): %s",
                attempt + 1,
                exc,
            )
            # Back off so the pool / SQLite file has time to settle.
            time.sleep(1.0 + attempt * 1.5)

    assert last_exc is not None
    raise last_exc
