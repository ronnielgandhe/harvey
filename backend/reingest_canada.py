"""Re-ingest the 14 Canadian federal PDFs with French stripped.

Why: the Justice Laws consolidations ship as BILINGUAL PDFs with the
English column on the left and French on the right. PyPDFLoader reads
them top-to-bottom which produces chunks where every English sentence
is immediately followed by its French translation. Those mixed-language
chunks give the embedding model a noisy, half-French representation,
so queries like "assault Criminal Code" sometimes return French-first
passages ("Voies de fait...") instead of the English text the caller
wanted.

Fix: re-ingest just the Canadian federal PDFs. For each page, run
every line through a French-heuristic filter and drop French lines
before chunking. Ontario + US + HTA are unilingual English already,
so they're left alone.

This DOES delete and re-add the Canadian-federal chunks, which means
the total chunk count will shift slightly. HTA + Ontario + US chunks
are untouched.

Usage:
    HARVEY_CHROMA_DIR=/abs/path/data/chroma_db \
    HARVEY_COLLECTION=harvey_legal \
    OPENAI_API_KEY=... python backend/reingest_canada.py
"""
from __future__ import annotations

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
log = logging.getLogger("reingest_canada")

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

# The 14 Canadian federal PDFs — the only bilingual ones.
CANADA_FEDERAL_PDFS = {
    "canada_business_corporations_act.pdf",
    "canada_competition_act.pdf",
    "canada_constitution_acts_1867_1982.pdf",
    "canada_copyright_act.pdf",
    "canada_criminal_code.pdf",
    "canada_divorce_act.pdf",
    "canada_employment_equity_act.pdf",
    "canada_health_act.pdf",
    "canada_human_rights_act.pdf",
    "canada_immigration_refugee_protection_act.pdf",
    "canada_income_tax_act.pdf",
    "canada_labour_code.pdf",
    "canada_pipeda.pdf",
    "canada_privacy_act.pdf",
}

# French-indicator heuristics. A line is "French" if it has:
#   - any accented French character that English doesn't use, OR
#   - more than one short French stop-word per ~8 words
# Stop-word check avoids false positives on English lines that happen
# to contain a French loanword.
FRENCH_STOP_WORDS = {
    "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou",
    "pour", "par", "sur", "dans", "est", "sont", "être", "qui",
    "que", "ne", "pas", "aux", "avec", "cette", "ces", "son", "sa",
    "ses", "leur", "leurs", "il", "elle", "ils", "elles", "au", "ait",
    "avait", "avaient", "plus", "moins", "aussi", "selon", "chaque",
    "toute", "tous", "toutes", "peut", "doit", "présent", "présente",
    "loi", "alinéa", "article", "paragraphe", "règlement",
}
FRENCH_ACCENT_RE = re.compile(r"[àâçéèêëîïôûùüÿœæÀÂÇÉÈÊËÎÏÔÛÙÜŸŒÆ]")


def line_is_french(line: str) -> bool:
    """Heuristic — conservative so we don't drop English with a loan word."""
    s = line.strip()
    if not s:
        return False
    # Strong signal: French-only accent.
    if FRENCH_ACCENT_RE.search(s):
        return True
    tokens = re.findall(r"[A-Za-zÀ-ÿ']+", s.lower())
    if len(tokens) < 3:
        return False
    hits = sum(1 for t in tokens if t in FRENCH_STOP_WORDS)
    # Ratio threshold: 25% of tokens being French stop-words is a
    # reliable French signal without false-positiving legal English
    # that borrows the occasional "de facto".
    return hits / len(tokens) >= 0.25


def strip_french(text: str) -> str:
    """Keep only lines that are not clearly French."""
    kept = [ln for ln in text.splitlines() if not line_is_french(ln)]
    cleaned = "\n".join(kept)
    # Collapse runs of blank lines left behind by stripping.
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned


def main() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        log.error("OPENAI_API_KEY missing.")
        sys.exit(1)

    pdfs = [p for p in sorted(CORPUS_DIR.glob("*.pdf")) if p.name in CANADA_FEDERAL_PDFS]
    missing = CANADA_FEDERAL_PDFS - {p.name for p in pdfs}
    if missing:
        log.warning("Missing Canadian federal PDFs: %s", sorted(missing))
    log.info("Re-ingesting %d Canadian federal PDFs (English-only)", len(pdfs))

    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    store = Chroma(
        collection_name=COLLECTION,
        embedding_function=embeddings,
        persist_directory=str(CHROMA_DIR),
    )
    pre = store._collection.count()  # type: ignore[attr-defined]
    log.info("Collection '%s' starting at %d chunks", COLLECTION, pre)

    # 1) Delete all existing chunks from these sources.
    for name in sorted(CANADA_FEDERAL_PDFS):
        try:
            # Chroma where-clause uses metadata equality.
            store._collection.delete(where={"source": name})  # type: ignore[attr-defined]
            log.info("  deleted chunks for %s", name)
        except Exception as exc:
            log.warning("  delete failed for %s: %s", name, exc)

    mid = store._collection.count()  # type: ignore[attr-defined]
    log.info("After deletes: %d chunks (was %d, removed %d)", mid, pre, pre - mid)

    # 2) Load, filter, re-chunk, re-embed each PDF.
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    started = time.time()
    total_new_chunks = 0
    for pdf_path in pdfs:
        log.info("Loading %s", pdf_path.name)
        loader = PyPDFLoader(str(pdf_path))
        pages = loader.load()

        # Filter French on a per-page basis so page metadata survives.
        cleaned_pages = []
        orig_chars = 0
        kept_chars = 0
        for page in pages:
            orig_chars += len(page.page_content)
            cleaned = strip_french(page.page_content)
            kept_chars += len(cleaned)
            if cleaned.strip():
                page.page_content = cleaned
                cleaned_pages.append(page)

        ratio = (kept_chars / orig_chars) if orig_chars else 0
        log.info(
            "  stripped French: %d -> %d chars (%.0f%% kept)",
            orig_chars,
            kept_chars,
            ratio * 100,
        )

        chunks = splitter.split_documents(cleaned_pages)
        for chunk in chunks:
            chunk.metadata = {
                **(chunk.metadata or {}),
                "source": pdf_path.name,
                "page": int(chunk.metadata.get("page", 0)) if chunk.metadata else 0,
                "jurisdiction": "Canada",
            }

        if chunks:
            BATCH = 200
            for i in range(0, len(chunks), BATCH):
                batch = chunks[i : i + BATCH]
                store.add_documents(batch)
                if i + BATCH < len(chunks):
                    time.sleep(0.4)
        log.info("  -> %d chunks", len(chunks))
        total_new_chunks += len(chunks)

    post = store._collection.count()  # type: ignore[attr-defined]
    log.info(
        "Done. %d Canadian-federal chunks re-ingested in %.1fs. "
        "Collection: %d -> %d -> %d",
        total_new_chunks,
        time.time() - started,
        pre,
        mid,
        post,
    )


if __name__ == "__main__":
    main()
