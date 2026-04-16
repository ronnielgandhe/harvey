"""One-shot ingestion script: PDFs in data/corpus/ -> ChromaDB.

Usage:
    python ingest.py            # ingest, prompt before re-ingesting
    python ingest.py --force    # wipe collection and re-ingest

Each chunk is stored with metadata:
    {source: filename, page: int, jurisdiction: <inferred from filename>}
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("ingest")

CORPUS_DIR = Path(
    os.getenv(
        "HARVEY_CORPUS_DIR",
        str((Path(__file__).resolve().parent.parent / "data" / "corpus")),
    )
)
CHROMA_DIR = Path(
    os.getenv(
        "HARVEY_CHROMA_DIR",
        str((Path(__file__).resolve().parent.parent / "data" / "chroma_db")),
    )
)
COLLECTION = os.getenv("HARVEY_COLLECTION", "harvey_legal")
EMBEDDING_MODEL = "text-embedding-3-small"

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


JURISDICTION_HINTS = {
    "ontario": "Ontario",
    "ont": "Ontario",
    "ny": "New York",
    "nyc": "New York",
    "newyork": "New York",
    "california": "California",
    "ca": "California",
    "federal": "Federal",
    "us": "Federal",
    "uk": "United Kingdom",
    "canada": "Canada",
}


def infer_jurisdiction(filename: str) -> str:
    name = filename.lower().replace("_", "-").replace(" ", "-")
    for key, value in JURISDICTION_HINTS.items():
        if re.search(rf"(^|[-.]){re.escape(key)}([-.]|$)", name):
            return value
    return "Unknown"


def ensure_corpus() -> list[Path]:
    if not CORPUS_DIR.exists():
        log.error("Corpus dir does not exist: %s", CORPUS_DIR)
        sys.exit(1)
    pdfs = sorted(CORPUS_DIR.glob("*.pdf"))
    if not pdfs:
        log.warning("No PDFs found in %s — drop some in and rerun.", CORPUS_DIR)
        sys.exit(0)
    return pdfs


def collection_exists(store: Chroma) -> bool:
    try:
        return store._collection.count() > 0  # type: ignore[attr-defined]
    except Exception:
        return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="Drop existing collection without prompting.",
    )
    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY"):
        log.error("OPENAI_API_KEY missing. Populate .env first.")
        sys.exit(1)

    CHROMA_DIR.mkdir(parents=True, exist_ok=True)

    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    store = Chroma(
        collection_name=COLLECTION,
        embedding_function=embeddings,
        persist_directory=str(CHROMA_DIR),
    )

    if collection_exists(store):
        if args.force:
            log.info("--force given, wiping existing collection.")
            store.delete_collection()
            store = Chroma(
                collection_name=COLLECTION,
                embedding_function=embeddings,
                persist_directory=str(CHROMA_DIR),
            )
        else:
            answer = input(
                f"Collection '{COLLECTION}' already has data. Re-ingest? [y/N]: "
            ).strip().lower()
            if answer != "y":
                log.info("Aborting. Existing collection left intact.")
                return
            store.delete_collection()
            store = Chroma(
                collection_name=COLLECTION,
                embedding_function=embeddings,
                persist_directory=str(CHROMA_DIR),
            )

    pdfs = ensure_corpus()
    log.info("Found %d PDF(s) in %s", len(pdfs), CORPUS_DIR)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )

    started = time.time()
    total_chunks = 0

    for pdf_path in pdfs:
        jurisdiction = infer_jurisdiction(pdf_path.name)
        log.info("Loading %s (jurisdiction=%s)", pdf_path.name, jurisdiction)
        loader = PyPDFLoader(str(pdf_path))
        pages = loader.load()
        chunks = splitter.split_documents(pages)
        for chunk in chunks:
            chunk.metadata = {
                **(chunk.metadata or {}),
                "source": pdf_path.name,
                "page": int(chunk.metadata.get("page", 0)) if chunk.metadata else 0,
                "jurisdiction": jurisdiction,
            }
        if chunks:
            # Chroma cap is 5461 per upsert; OpenAI rate-limits if too many embeddings/sec
            BATCH = 200
            for i in range(0, len(chunks), BATCH):
                batch = chunks[i : i + BATCH]
                store.add_documents(batch)
                if i + BATCH < len(chunks):
                    time.sleep(0.4)  # gentle pacing for OpenAI
        log.info("  -> %d chunks", len(chunks))
        total_chunks += len(chunks)

    elapsed = time.time() - started
    log.info(
        "Done. %d files, %d chunks, %.1fs. Persisted to %s (collection=%s)",
        len(pdfs),
        total_chunks,
        elapsed,
        CHROMA_DIR,
        COLLECTION,
    )


if __name__ == "__main__":
    main()
