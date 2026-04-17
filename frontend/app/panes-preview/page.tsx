"use client";

/**
 * /panes-preview
 *
 * Design review page — renders every pane type with LIVE data:
 *   • Stock card → real Yahoo Finance NVDA quote (via /api/stock)
 *   • Hill intel → real STOCK Act filings for NVDA (via /api/hill)
 *   • News ticker + article → real Google News RSS (via /api/newsfeed)
 *   • Statute    → real excerpt from Ontario Highway Traffic Act § 200
 *                  (the full RAG corpus isn't queryable from the Next
 *                  app; the content shown here is directly from the
 *                  statute text)
 *
 * Not linked from the app. Use to point at specific pane designs.
 */

import { useEffect, useState } from "react";
import { ToolPill, StatutePaneCard } from "@/components/GlassPaneStack";
import {
  NewsTickerPane,
  type NewsTickerData,
} from "@/components/panes/NewsTickerPane";
import {
  ArticleSpotlightPane,
  type ArticleSpotlightData,
} from "@/components/panes/ArticleSpotlightPane";
import {
  StockCardPane,
  type StockCardData,
} from "@/components/panes/StockCardPane";
import {
  HillIntelPane,
  type HillIntelData,
} from "@/components/panes/HillIntelPane";

// ─── Statute: real Ontario HTA § 200 excerpt (the corpus source) ────────────

const STATUTE_PANE = {
  kind: "statute" as const,
  id: "preview-statute",
  jurisdiction: "Ontario",
  section: "§ 200",
  title: "Duty of person in charge of vehicle in case of accident",
  quote:
    "Where an accident occurs on a highway, every person in charge of a vehicle or street car that is directly or indirectly involved in the accident shall remain at or immediately return to the scene of the accident, render all possible assistance and, upon request, give in writing to anyone sustaining loss or injury...",
  fullText:
    "Where an accident occurs on a highway, every person in charge of a vehicle or street car that is directly or indirectly involved in the accident shall, (a) remain at or immediately return to the scene of the accident; (b) render all possible assistance; and (c) upon request, give in writing to anyone sustaining loss or injury or to any police officer or to any witness his or her name, address, driver's licence number and jurisdiction of issuance, motor vehicle liability insurance policy insurer and policy number, name and address of the registered owner of the vehicle and the vehicle permit number. R.S.O. 1990, c. H.8, s. 200 (1); 1997, c. 12, s. 15.",
  confidence: 0.87,
  seeAlso: [
    {
      section: "§ 199",
      title: "Duty to report accident",
      source: "Highway Traffic Act",
      jurisdiction: "Ontario",
      quote:
        "Every person in charge of a motor vehicle or street car who is directly or indirectly involved in an accident shall, if the accident results in personal injuries or in damage to property apparently exceeding an amount prescribed by regulation, report the accident forthwith to the nearest police officer...",
      fullText: "",
    },
    {
      section: "§ 201",
      title: "Duty of driver unable to identify vehicle owner",
      source: "Highway Traffic Act",
      jurisdiction: "Ontario",
      quote:
        "Every person in charge of a vehicle who, on a highway, collides with an unattended vehicle and cannot readily locate the person in charge of it...",
      fullText: "",
    },
  ],
};

const TOOL_PILLS: Array<{ name: string; status: string }> = [
  { name: "cite_statute", status: "running" },
  { name: "cite_statute", status: "complete" },
  { name: "stock_ticker", status: "running" },
  { name: "check_the_hill", status: "complete" },
  { name: "current_events", status: "complete" },
  { name: "current_events", status: "error" },
];

// ─── Layout helper ──────────────────────────────────────────────────────────

function Section({
  label,
  sub,
  w,
  children,
}: {
  label: string;
  sub?: string;
  w?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.42em] text-[var(--foreground-faint)]">
          {label}
        </span>
        {sub && (
          <span className="font-display text-[13px] italic text-[var(--foreground-muted)]">
            {sub}
          </span>
        )}
      </div>
      <div style={{ width: w ?? 360 }}>{children}</div>
    </div>
  );
}

function Skeleton({ h = 160 }: { h?: number }) {
  return (
    <div
      className="glass-pane rounded-xl"
      style={{ height: h }}
      aria-label="loading"
    >
      <div className="h-full w-full animate-pulse rounded-xl bg-black/[0.03]" />
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PanesPreview() {
  const [stock, setStock] = useState<StockCardData | null>(null);
  const [hill, setHill] = useState<HillIntelData | null>(null);
  const [news, setNews] = useState<NewsTickerData | null>(null);
  const [article, setArticle] = useState<ArticleSpotlightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [stockRes, hillRes, newsRes] = await Promise.all([
        fetch("/api/stock?ticker=NVDA", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch("/api/hill?ticker=NVDA", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch("/api/newsfeed?count=5", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null,
        ),
      ]);
      if (cancelled) return;

      if (stockRes && !stockRes.error) {
        setStock({ query: "Nvidia", ...stockRes });
      }
      if (hillRes && Array.isArray(hillRes.trades)) {
        setHill({
          ticker: String(hillRes.ticker ?? "NVDA"),
          trades: hillRes.trades,
          source: hillRes.source ? String(hillRes.source) : undefined,
        });
      }
      if (newsRes && Array.isArray(newsRes.items) && newsRes.items.length) {
        const items = newsRes.items.map((it: Record<string, unknown>) => ({
          title: String(it.title ?? ""),
          source: String(it.source ?? ""),
          published: String(it.pubDate ?? ""),
          link: String(it.link ?? ""),
        }));
        setNews({ query: "Canadian law · live", items });
        const top = items[0];
        setArticle({
          query: "Canadian law · live",
          title: top.title,
          source: top.source,
          published: top.published,
          link: top.link,
          summary: top.title,
        });
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="relative min-h-screen bg-[var(--background)] px-10 py-14">
      {/* Header */}
      <div className="mb-12 max-w-[880px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.42em] text-[var(--foreground-faint)]">
          Design review · live data · not linked from the app
        </div>
        <h1 className="mt-2 font-display text-[36px] leading-[1.05] tracking-[-0.01em] text-[var(--foreground)]">
          Pane designs, isolated
        </h1>
        <p className="mt-2 max-w-[640px] text-[14px] leading-relaxed text-[var(--foreground-muted)]">
          Every type of pane Harvey can surface, shown with the same live
          endpoints the call view uses — Yahoo Finance, Google News RSS,
          the Congress trades dataset. Tell me which ones to redesign and
          what you want different — I&rsquo;ll edit the real components.
        </p>
      </div>

      {/* Two-column flow: LEFT stack | RIGHT stack */}
      <div className="grid grid-cols-1 gap-x-14 gap-y-6 lg:grid-cols-2">
        {/* LEFT — market / insider lane */}
        <div>
          <div className="mb-6 border-b border-[var(--rule-strong)] pb-1 font-mono text-[9.5px] uppercase tracking-[0.42em] text-[var(--foreground-muted)]">
            Left stack · market &amp; insider lane
          </div>

          <Section
            label="01 · Stock card"
            sub="Live Yahoo Finance quote for NVDA. Sparkline is the last 30 days of daily closes."
            w={320}
          >
            {stock ? (
              <StockCardPane data={stock} paneId="preview-stock" />
            ) : (
              <Skeleton h={320} />
            )}
          </Section>

          <Section
            label="02 · Hill intel"
            sub="Live QuiverQuant STOCK Act feed, filtered to NVDA. Falls back to curated if upstream fails."
            w={320}
          >
            {hill ? (
              <HillIntelPane data={hill} paneId="preview-hill" />
            ) : (
              <Skeleton h={320} />
            )}
          </Section>
        </div>

        {/* RIGHT — legal / editorial lane */}
        <div>
          <div className="mb-6 border-b border-[var(--rule-strong)] pb-1 font-mono text-[9.5px] uppercase tracking-[0.42em] text-[var(--foreground-muted)]">
            Right stack · legal &amp; editorial lane
          </div>

          <Section
            label="03 · Statute card"
            sub="Real Ontario HTA § 200 excerpt. Match % + expand toggle + clickable see-also."
            w={360}
          >
            <StatutePaneCard pane={STATUTE_PANE} />
          </Section>

          <Section
            label="04 · Article spotlight"
            sub="Top live Canadian legal headline, rewritten in newspaper style."
            w={360}
          >
            {article ? (
              <ArticleSpotlightPane
                data={article}
                paneId="preview-article"
              />
            ) : (
              <Skeleton h={280} />
            )}
          </Section>

          <Section
            label="05 · News ticker"
            sub="Top 5 live headlines from /api/newsfeed."
            w={360}
          >
            {news ? (
              <NewsTickerPane data={news} paneId="preview-news" />
            ) : (
              <Skeleton h={240} />
            )}
          </Section>

          <Section
            label="06 · Tool pills"
            sub="Status pills — running / complete / error."
            w={360}
          >
            <div className="flex flex-col gap-1.5">
              {TOOL_PILLS.map((t, i) => (
                <ToolPill
                  key={i}
                  pane={{
                    kind: "tool_call",
                    id: `preview-tool-${i}`,
                    name: t.name,
                    status: t.status,
                  }}
                />
              ))}
            </div>
          </Section>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4 rounded-full border border-[var(--rule-strong)] bg-white/80 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-muted)] backdrop-blur">
          Fetching live data…
        </div>
      )}
    </main>
  );
}
