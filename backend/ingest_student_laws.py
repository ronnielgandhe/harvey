"""Ingest a curated set of student-relevant English-only statutes.

Pulls each statute from the archive.org snapshot of its CanLII page
(same trick that worked for HTA — CanLII serves a client-rendered SPA,
but the Wayback snapshot is a fully-rendered static HTML with the full
statute text in the markup).

Target statutes (7):
  1. Canada Criminal Code
  2. Ontario Residential Tenancies Act, 2006
  3. Ontario Employment Standards Act, 2000
  4. Canada Cannabis Act
  5. Ontario Liquor Licence and Control Act, 2019
  6. Ontario Human Rights Code
  7. Canada Controlled Drugs and Substances Act

Each is appended to the existing harvey_legal collection with full
metadata so downstream retrieval has clean source/citation info. The
existing HTA + consumer-protection chunks are left alone.

Usage:
    HARVEY_CHROMA_DIR=/abs/path/data/chroma_db \
    HARVEY_COLLECTION=harvey_legal \
    OPENAI_API_KEY=... python backend/ingest_student_laws.py
"""
from __future__ import annotations

import logging
import os
import re
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
log = logging.getLogger("ingest_student_laws")

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

BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120 Safari/537.36"
)

ARCHIVE_REQUEST_DELAY_SEC = 5  # between successive archive.org requests


def wayback_snapshots(url: str, limit: int = 8) -> list[str]:
    """Query the Wayback CDX API for snapshots of `url` that returned 200.

    Returns a list of snapshot URLs sorted newest-first. CanLII URLs have
    working snapshots — but only at specific timestamps. Most modern
    timestamps 403/404, while older ones (2009-2020) work. Using the CDX
    API lets us auto-discover which specific timestamps are valid instead
    of guessing.
    """
    # Strip scheme, CDX only needs host+path.
    bare = re.sub(r"^https?://", "", url)
    cdx_url = (
        "https://web.archive.org/cdx/search/cdx"
        f"?url={bare}&output=json&limit={limit}&filter=statuscode:200"
    )
    try:
        r = requests.get(cdx_url, timeout=30, headers={"User-Agent": BROWSER_UA})
        if r.status_code != 200:
            return []
        import json
        rows = json.loads(r.text)
        if not rows or len(rows) < 2:
            return []
        # rows[0] is a header. Each data row: [urlkey, timestamp,
        # original, mimetype, statuscode, digest, length].
        entries = rows[1:]
        # Sort newest-first by timestamp.
        entries.sort(key=lambda e: e[1], reverse=True)
        return [
            f"https://web.archive.org/web/{e[1]}/{e[2]}"
            for e in entries
        ]
    except Exception:
        return []

# Belt-and-suspenders French filter. CanLII's /en/ URLs should serve
# English-only, but archive.org snapshots occasionally include brief
# French-language site chrome, French footnotes, or cross-links to
# the /fr/ version. Any line that looks French gets dropped before
# the text is chunked + embedded, so the collection stays English-
# only no matter what the source HTML contains.
FRENCH_ACCENT_RE = re.compile(r"[àâçéèêëîïôûùüÿœæÀÂÇÉÈÊËÎÏÔÛÙÜŸŒÆ]")
FRENCH_STOP_WORDS = {
    "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou",
    "pour", "par", "sur", "dans", "est", "sont", "être", "qui",
    "que", "ne", "pas", "aux", "avec", "cette", "ces", "son", "sa",
    "ses", "leur", "leurs", "il", "elle", "ils", "elles", "au",
    "plus", "moins", "aussi", "selon", "chaque", "toute", "tous",
    "toutes", "peut", "doit", "loi", "alinéa", "paragraphe",
}


def line_is_french(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if FRENCH_ACCENT_RE.search(s):
        return True
    tokens = re.findall(r"[A-Za-zÀ-ÿ']+", s.lower())
    if len(tokens) < 3:
        return False
    hits = sum(1 for t in tokens if t in FRENCH_STOP_WORDS)
    return hits / len(tokens) >= 0.25


def strip_french(text: str) -> str:
    kept = [ln for ln in text.splitlines() if not line_is_french(ln)]
    cleaned = "\n".join(kept)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned

# Each entry: the CanLII source URL (without archive prefix) plus
# metadata that will be attached to every chunk from that statute.
STATUTES = [
    # Federal — direct from Justice Laws Canada, English only, no archive
    # needed. These return 4MB+ of clean statute HTML.
    {
        "urls": ["https://laws-lois.justice.gc.ca/eng/acts/C-46/FullText.html"],
        "source": "canada_criminal_code.html",
        "title": "Criminal Code",
        "citation": "R.S.C. 1985, c. C-46",
        "jurisdiction": "Canada",
    },
    {
        "urls": ["https://laws-lois.justice.gc.ca/eng/acts/C-24.5/FullText.html"],
        "source": "canada_cannabis_act.html",
        "title": "Cannabis Act",
        "citation": "S.C. 2018, c. 16",
        "jurisdiction": "Canada",
    },
    {
        "urls": ["https://laws-lois.justice.gc.ca/eng/acts/C-38.8/FullText.html"],
        "source": "canada_controlled_drugs_and_substances_act.html",
        "title": "Controlled Drugs and Substances Act",
        "citation": "S.C. 1996, c. 19",
        "jurisdiction": "Canada",
    },
    # Ontario statutes are served only through CanLII (Ontario's own
    # e-Laws is a SPA). CanLII blocks direct scrapes. Valid snapshots
    # exist on archive.org but only at specific older timestamps, so
    # we ask the Wayback CDX API what's actually available (see
    # wayback_snapshots()) instead of guessing.
    {
        "canlii_url": "https://www.canlii.org/en/on/laws/stat/so-2006-c-17/latest/so-2006-c-17.html",
        "source": "ontario_residential_tenancies_act.html",
        "title": "Residential Tenancies Act, 2006",
        "citation": "S.O. 2006, c. 17",
        "jurisdiction": "Ontario",
    },
    {
        "canlii_url": "https://www.canlii.org/en/on/laws/stat/so-2000-c-41/latest/so-2000-c-41.html",
        "source": "ontario_employment_standards_act.html",
        "title": "Employment Standards Act, 2000",
        "citation": "S.O. 2000, c. 41",
        "jurisdiction": "Ontario",
    },
    {
        "canlii_url": "https://www.canlii.org/en/on/laws/stat/rso-1990-c-h-19/latest/rso-1990-c-h-19.html",
        "source": "ontario_human_rights_code.html",
        "title": "Human Rights Code",
        "citation": "R.S.O. 1990, c. H.19",
        "jurisdiction": "Ontario",
    },
    {
        "canlii_url": "https://www.canlii.org/en/on/laws/stat/so-2019-c-15-sch-22/latest/so-2019-c-15-sch-22.html",
        "source": "ontario_liquor_licence_and_control_act.html",
        "title": "Liquor Licence and Control Act, 2019",
        "citation": "S.O. 2019, c. 15, Sched. 22",
        "jurisdiction": "Ontario",
    },
]


def resolve_urls(statute: dict) -> list[str]:
    """Return the list of URLs to try for this statute."""
    if "urls" in statute:
        return list(statute["urls"])
    if "canlii_url" in statute:
        snaps = wayback_snapshots(statute["canlii_url"], limit=8)
        log.info("  CDX returned %d snapshots", len(snaps))
        return snaps
    return []


def fetch_text(statute: dict) -> str:
    """Try each candidate URL in order. First 200 with real content wins.
    Between archive.org requests we wait ARCHIVE_REQUEST_DELAY_SEC to
    avoid 429 rate limits."""
    urls = resolve_urls(statute)
    if not urls:
        raise RuntimeError(f"No candidate URLs for {statute['title']}")
    last_err: Exception | None = None
    for i, url in enumerate(urls):
        is_archive = "web.archive.org" in url
        if is_archive and i > 0:
            time.sleep(ARCHIVE_REQUEST_DELAY_SEC)
        try:
            log.info("  GET %s", url[:90])
            r = requests.get(
                url, timeout=90, headers={"User-Agent": BROWSER_UA}
            )
            if r.status_code != 200:
                log.warning("    %d — trying next candidate", r.status_code)
                last_err = RuntimeError(f"HTTP {r.status_code}")
                continue
            if len(r.content) < 50_000:
                log.warning(
                    "    only %d bytes — likely blocked, trying next",
                    len(r.content),
                )
                last_err = RuntimeError("response too short")
                continue
            log.info("    %d bytes OK", len(r.content))
            soup = BeautifulSoup(r.text, "lxml")
            for tag in soup(
                ["script", "style", "nav", "header", "footer", "aside",
                 "noscript", "form", "iframe"]
            ):
                tag.decompose()
            main = soup.find("main") or soup.find(id="content") or soup.body
            if main is None:
                last_err = RuntimeError("no body element")
                continue
            text = main.get_text(separator="\n", strip=True)
            text = re.sub(r"\n{3,}", "\n\n", text)
            before = len(text)
            text = strip_french(text)
            log.info(
                "    extracted %d -> %d chars after French strip",
                before, len(text),
            )
            return text
        except Exception as exc:
            last_err = exc
            log.warning("    request failed: %s", exc)
    if last_err is None:
        last_err = RuntimeError("no candidate URLs returned content")
    raise last_err


def main() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        log.error("OPENAI_API_KEY missing.")
        sys.exit(1)

    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    store = Chroma(
        collection_name=COLLECTION,
        embedding_function=embeddings,
        persist_directory=str(CHROMA_DIR),
    )
    pre = store._collection.count()  # type: ignore[attr-defined]
    log.info("Collection starts at %d chunks", pre)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    started = time.time()
    total = 0
    for s in STATUTES:
        # Skip statutes we've already ingested (rerun safety).
        existing = store._collection.get(  # type: ignore[attr-defined]
            where={"source": s["source"]},
            include=[],
            limit=1,
        )
        if existing["ids"]:
            log.info("%s already ingested, skipping", s["title"])
            continue

        try:
            text = fetch_text(s)
        except Exception as exc:
            log.error("FAILED %s: %s", s["title"], exc)
            continue

        if len(text) < 8000:
            log.warning(
                "  too short (%d chars), likely blocked, skipping", len(text)
            )
            continue

        doc = Document(
            page_content=text,
            metadata={
                "source": s["source"],
                "jurisdiction": s["jurisdiction"],
                "title": s["title"],
                "citation": s["citation"],
                "page": 0,
            },
        )
        chunks = splitter.split_documents([doc])
        log.info("  split into %d chunks", len(chunks))
        for c in chunks:
            c.metadata = {
                **(c.metadata or {}),
                "source": s["source"],
                "jurisdiction": s["jurisdiction"],
                "title": s["title"],
                "citation": s["citation"],
            }

        BATCH = 200
        for i in range(0, len(chunks), BATCH):
            batch = chunks[i : i + BATCH]
            store.add_documents(batch)
            if i + BATCH < len(chunks):
                time.sleep(0.4)
        total += len(chunks)
        log.info("  ingested %d chunks for %s", len(chunks), s["title"])

    post = store._collection.count()  # type: ignore[attr-defined]
    log.info(
        "Done. %d new chunks in %.1fs. Collection: %d -> %d",
        total,
        time.time() - started,
        pre,
        post,
    )


if __name__ == "__main__":
    main()
