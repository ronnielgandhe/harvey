"""RAG pipeline: Chroma-backed retriever over ingested legal corpus."""

from __future__ import annotations

import logging
import os
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
        logger.info(
            "LegalRAG initialized (collection=%s, persist_dir=%s)",
            collection_name,
            persist_dir,
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
    global _INSTANCE
    if _INSTANCE is None:
        _INSTANCE = LegalRAG()
    return _INSTANCE
