from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag import get_rag, section_of

CASES = json.loads((Path(__file__).parent / "retrieval_cases.json").read_text())


def raw_hits(rag, q: str) -> list[dict]:
    from tools import _guess_section

    out = []
    for doc, _ in rag._store.similarity_search_with_score(q, k=10)[:3]:
        md = doc.metadata or {}
        out.append({"source": md.get("source", ""), "section": _guess_section(doc.page_content, md.get("source", "")).replace("§ ", "")})
    return out


def routed_hits(rag, q: str) -> list[dict]:
    return [{"source": h["source"], "section": h["section"]} for h in rag.retrieve(q, k=3)]


def is_hit(case: dict, hit: dict) -> bool:
    if hit["source"] not in case["source"].split("|"):
        return False
    return not case["sections"] or hit["section"].split("(")[0].strip() in case["sections"]


def run(mode: str) -> dict:
    rag = get_rag()
    fn = raw_hits if mode == "raw" else routed_hits
    top1 = top3 = 0
    rows = []
    for case in CASES:
        hits = fn(rag, case["q"])
        h1 = bool(hits) and is_hit(case, hits[0])
        h3 = any(is_hit(case, h) for h in hits)
        top1 += h1
        top3 += h3
        rows.append({"q": case["q"], "expected": case["sections"] or case["source"], "got": [f'{h["source"].split(".")[0]} s.{h["section"]}' for h in hits], "top1": h1})
    return {"mode": mode, "n": len(CASES), "top1": top1, "top3": top3, "rows": rows}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["raw", "routed"], default="routed")
    ap.add_argument("--out")
    args = ap.parse_args()
    result = run(args.mode)
    for r in result["rows"]:
        print(("HIT " if r["top1"] else "MISS"), r["q"][:70], "| want", r["expected"], "| got", r["got"][:2])
    print(f'{result["mode"]}: top1 {result["top1"]}/{result["n"]}, top3 {result["top3"]}/{result["n"]}')
    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=2))
