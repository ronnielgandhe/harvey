import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";

/**
 * GET /api/hill?ticker=NVDA
 *
 * Pulls REAL Congressional STOCK Act filings from QuiverQuant's public
 * beta feed, filters by ticker, and maps into the agent's `hill_intel`
 * schema. Falls back to a curated sample dataset if the upstream is
 * unreachable.
 */

export const dynamic = "force-dynamic";

interface QuiverTrade {
  Representative?: string;
  BioGuideID?: string;
  ReportDate?: string;
  TransactionDate?: string;
  Ticker?: string;
  Transaction?: string; // "Purchase" | "Sale" | "Sale (Partial)" | ...
  Range?: string;
  House?: string; // "Representatives" | "Senator"
  Party?: string;
}

interface HillTrade {
  ticker: string;
  member: string;
  chamber: string;
  party: string;
  state: string;
  side: string;
  size: string;
  filed: string;
  traded: string;
}

function normalizeTransaction(s: string): string {
  const lower = (s || "").toLowerCase();
  if (lower.includes("purchase") || lower.includes("buy")) return "buy";
  if (lower.includes("sale") || lower.includes("sell")) return "sell";
  return lower;
}

function normalizeChamber(s: string): string {
  if (!s) return "";
  if (/^senat/i.test(s)) return "Senate";
  if (/rep/i.test(s)) return "House";
  return s;
}

async function fetchRealQuiverTrades(ticker: string): Promise<HillTrade[]> {
  // QuiverQuant's public beta endpoint — returns the latest congressional
  // trades across all members. No API key required. We filter by ticker
  // client-side.
  const res = await fetch(
    "https://api.quiverquant.com/beta/live/congresstrading",
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (HarveyHill/1.0)",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`quiver ${res.status}`);
  const all = (await res.json()) as QuiverTrade[];
  if (!Array.isArray(all)) throw new Error("quiver bad shape");

  const matches = all.filter(
    (t) => (t.Ticker || "").toUpperCase() === ticker,
  );
  matches.sort((a, b) =>
    (b.ReportDate || "").localeCompare(a.ReportDate || ""),
  );

  // Dedupe by member — the raw feed often has the same representative
  // filing 3-4 trades in the same window, which made the pane feel
  // noisy. We keep the MOST RECENT trade per member, BUT we also
  // remember how many filings they had. A member with 3+ recent trades
  // is a "repeat trader" — those are the interesting ones (Harvey's
  // insiders), so we surface them first in the result order.
  type Enriched = HillTrade & { filings: number };
  const byMember = new Map<string, Enriched>();
  for (const t of matches) {
    const name = (t.Representative || "Unknown").trim();
    const existing = byMember.get(name);
    if (existing) {
      existing.filings += 1;
      continue;
    }
    byMember.set(name, {
      ticker: (t.Ticker || "").toUpperCase(),
      member: name,
      chamber: normalizeChamber(t.House || ""),
      party: (t.Party || "").toUpperCase(),
      state: "",
      side: normalizeTransaction(t.Transaction || ""),
      size: t.Range || "",
      filed: (t.ReportDate || "").slice(0, 10),
      traded: (t.TransactionDate || "").slice(0, 10),
      filings: 1,
    });
  }

  const unique = Array.from(byMember.values());
  // Sort: repeat traders first (more filings = more interesting), then
  // by recency of filing. Then cap to the top 5 — any more and the
  // pane stops fitting next to the live stock card.
  unique.sort((a, b) => {
    if (b.filings !== a.filings) return b.filings - a.filings;
    return (b.filed || "").localeCompare(a.filed || "");
  });

  return unique.slice(0, 5).map(({ filings: _f, ...rest }) => rest);
}

async function fallbackCuratedTrades(ticker: string): Promise<HillTrade[]> {
  try {
    const file = path.join(
      process.cwd(),
      "..",
      "data",
      "congress_trades.json",
    );
    const raw = await fs.readFile(file, "utf-8");
    const data = JSON.parse(raw) as { trades: HillTrade[] };
    return (data.trades || [])
      .filter((t) => (t.ticker || "").toUpperCase() === ticker)
      .sort((a, b) => (b.filed || "").localeCompare(a.filed || ""))
      .slice(0, 5);
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickerRaw = (searchParams.get("ticker") || "NVDA").toUpperCase();
  // Strip exchange suffix (SHOP.TO → SHOP) — US-only dataset.
  const ticker = tickerRaw.split(".")[0];

  let source: "quiver" | "curated" = "curated";
  let trades: HillTrade[] = [];

  // 1. Try the live QuiverQuant feed.
  try {
    trades = await fetchRealQuiverTrades(ticker);
    if (trades.length > 0) {
      source = "quiver";
    }
  } catch {
    // swallow — fall through to curated
  }

  // 2. If empty, fall back to the curated sample.
  if (trades.length === 0) {
    trades = await fallbackCuratedTrades(ticker);
    source = "curated";
  }

  return NextResponse.json({ ticker, trades, source });
}
