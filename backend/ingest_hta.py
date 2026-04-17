"""One-off ingestion for the Ontario Highway Traffic Act.

Pulls the HTML from ontario.ca e-Laws, strips nav/footer/chrome, chunks
the statute text, embeds it with the same model the rest of the corpus
uses, and APPENDS (does not wipe) to the existing chroma_db collection.

Usage:
    OPENAI_API_KEY=... python backend/ingest_hta.py

After it finishes:
    - data/chroma_db/ will contain the HTA chunks alongside the existing
      31-PDF corpus.
    - Redeploy (bash deploy/fly-deploy.sh) to push the updated DB.
"""
from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("ingest_hta")

# Ontario.ca and CanLII both serve client-rendered SPAs (no statute
# text in the initial HTML). Wayback Machine's snapshot of the CanLII
# page, however, is a fully-rendered static HTML document with the
# entire Act body in the markup — perfect for a one-shot scrape.
HTA_URL = (
    "https://web.archive.org/web/2024/"
    "https://www.canlii.org/en/on/laws/stat/rso-1990-c-h-8/latest/"
    "rso-1990-c-h-8.html"
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


def fetch_hta_text() -> str:
    log.info("GET %s", HTA_URL)
    r = requests.get(HTA_URL, timeout=60, headers={
        # Ontario.ca sometimes serves an error XML page to non-browser
        # User-Agents; a plain Mozilla string gets the real HTML.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/120 Safari/537.36",
    })
    r.raise_for_status()
    log.info("  got %d bytes of HTML", len(r.content))

    soup = BeautifulSoup(r.text, "lxml")

    # Strip site chrome: header, footer, nav, aside, script, style, and
    # the "breadcrumbs" + "share" regions. Keep the main statute content.
    for tag in soup(["script", "style", "nav", "header", "footer",
                     "aside", "noscript", "form", "iframe"]):
        tag.decompose()

    # Ontario.ca statute body sits inside <main> or #content. Fall back
    # to full body text if selector misses.
    main = soup.find("main") or soup.find(id="content") or soup.body
    if main is None:
        raise RuntimeError("Could not locate statute body in HTML")

    # get_text with a newline separator so section boundaries survive
    # for the text splitter to use as recursion points.
    text = main.get_text(separator="\n", strip=True)
    # Collapse 3+ blank lines to keep chunks tight.
    import re
    text = re.sub(r"\n{3,}", "\n\n", text)
    log.info("  extracted %d chars of statute text", len(text))
    return text


def main() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        log.error("OPENAI_API_KEY missing. Populate backend/.env first.")
        sys.exit(1)

    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    text = fetch_hta_text()
    if len(text) < 10_000:
        log.error(
            "HTA text is suspiciously short (%d chars). Aborting before "
            "polluting the collection.",
            len(text),
        )
        sys.exit(1)

    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    store = Chroma(
        collection_name=COLLECTION,
        embedding_function=embeddings,
        persist_directory=str(CHROMA_DIR),
    )

    pre = store._collection.count()  # type: ignore[attr-defined]
    log.info("Collection '%s' currently has %d docs", COLLECTION, pre)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    doc = Document(
        page_content=text,
        metadata={
            "source": "ontario_highway_traffic_act.html",
            "jurisdiction": "Ontario",
            "title": "Highway Traffic Act",
            "citation": "R.S.O. 1990, c. H.8",
            "page": 0,
        },
    )
    chunks = splitter.split_documents([doc])
    log.info("Split HTA into %d chunks", len(chunks))

    # Keep source metadata on every chunk (splitter preserves it, but
    # be explicit since that's what rag.retrieve() reads).
    for c in chunks:
        c.metadata = {
            **(c.metadata or {}),
            "source": "ontario_highway_traffic_act.html",
            "jurisdiction": "Ontario",
            "title": "Highway Traffic Act",
            "citation": "R.S.O. 1990, c. H.8",
        }

    started = time.time()
    BATCH = 200
    for i in range(0, len(chunks), BATCH):
        batch = chunks[i : i + BATCH]
        store.add_documents(batch)
        log.info("  + %d/%d chunks embedded", min(i + BATCH, len(chunks)), len(chunks))
        if i + BATCH < len(chunks):
            time.sleep(0.4)  # gentle on OpenAI

    post = store._collection.count()  # type: ignore[attr-defined]
    log.info(
        "Done. %d new HTA chunks ingested in %.1fs. Collection size: %d -> %d",
        len(chunks),
        time.time() - started,
        pre,
        post,
    )


if __name__ == "__main__":
    main()
