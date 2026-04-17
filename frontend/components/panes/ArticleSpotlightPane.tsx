"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { useState } from "react";

export interface ArticleSpotlightItem {
  title: string;
  source: string;
  published: string;
  link: string;
  summary: string;
}

export interface ArticleSpotlightData {
  query: string;
  /** Preferred: array of items. A single-card deck when length==1,
   *  flip-through when multiple. */
  items?: ArticleSpotlightItem[];
  /** Legacy (pre-deck) fields — if items[] isn't present, we synthesize
   *  a single-item deck from these. */
  title?: string;
  source?: string;
  published?: string;
  link?: string;
  summary?: string;
}

interface Props {
  data: ArticleSpotlightData;
  paneId: string;
  onDismiss?: (id: string) => void;
}

// Four sepia tints so each card in the deck feels like it's pulled
// from a different edition of the same paper. Cycled via index.
const VARIANTS = [
  {
    // classic cream
    bg: "linear-gradient(180deg, #f7f3ea 0%, #efe9d8 100%)",
    border: "rgba(80, 60, 20, 0.25)",
    ink: "#1a1208",
    subtle: "rgba(60,40,10,0.7)",
    rule: "rgba(60,40,10,0.2)",
    ruleSoft: "rgba(60,40,10,0.15)",
    mastheadHue: "#3a2b10",
  },
  {
    // warm redrover — red newspaper tint
    bg: "linear-gradient(180deg, #f6ece6 0%, #ecd9cf 100%)",
    border: "rgba(120, 40, 30, 0.28)",
    ink: "#2b0e08",
    subtle: "rgba(100,30,20,0.7)",
    rule: "rgba(120,40,30,0.22)",
    ruleSoft: "rgba(120,40,30,0.16)",
    mastheadHue: "#7a1f10",
  },
  {
    // oxford — cool blue-tinted broadsheet
    bg: "linear-gradient(180deg, #eaeff5 0%, #d8e1ec 100%)",
    border: "rgba(20, 40, 90, 0.28)",
    ink: "#0b1430",
    subtle: "rgba(20,40,90,0.7)",
    rule: "rgba(20,40,90,0.22)",
    ruleSoft: "rgba(20,40,90,0.16)",
    mastheadHue: "#14336a",
  },
  {
    // ledger — muted green manila
    bg: "linear-gradient(180deg, #eef2e7 0%, #dce5cf 100%)",
    border: "rgba(40, 80, 30, 0.28)",
    ink: "#0d1a06",
    subtle: "rgba(40,80,30,0.7)",
    rule: "rgba(40,80,30,0.22)",
    ruleSoft: "rgba(40,80,30,0.16)",
    mastheadHue: "#2a5620",
  },
];

export function ArticleSpotlightPane({ data, paneId, onDismiss }: Props) {
  // Normalize to items[] — fall back to legacy single-item shape if needed.
  const items: ArticleSpotlightItem[] =
    data.items && data.items.length > 0
      ? data.items
      : data.title
        ? [
            {
              title: data.title,
              source: data.source ?? "",
              published: data.published ?? "",
              link: data.link ?? "",
              summary: data.summary ?? data.title,
            },
          ]
        : [];

  const [i, setI] = useState(0);
  if (items.length === 0) return null;

  const item = items[Math.min(i, items.length - 1)];
  const variant = VARIANTS[i % VARIANTS.length];
  const hasDeck = items.length > 1;

  const prev = () => setI((x) => (x - 1 + items.length) % items.length);
  const next = () => setI((x) => (x + 1) % items.length);

  const summary = item.summary || item.title;
  const firstChar = summary[0] ?? "T";
  const rest = summary.slice(1);
  const dateline = fmtDateline(item.published);
  const issueNo = rng(item.title, 1, 999).toString().padStart(3, "0");

  return (
    <div
      className="relative overflow-hidden rounded-sm"
      style={{
        background: variant.bg,
        border: `1px solid ${variant.border}`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.6) inset, 0 16px 40px -24px rgba(20,12,8,0.28)`,
      }}
    >
      {/* Masthead */}
      <div
        className="flex items-center justify-between border-b px-5 py-2"
        style={{ borderColor: variant.rule }}
      >
        <span
          className="font-display text-[11px] uppercase tracking-[0.38em]"
          style={{ color: variant.mastheadHue }}
        >
          The Daily Dossier
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.3em]"
          style={{ color: variant.subtle }}
        >
          Vol. MMXXVI · No. {issueNo}
        </span>
        {onDismiss && (
          <button
            onClick={() => onDismiss(paneId)}
            className="rounded-md p-0.5 hover:bg-black/5"
            aria-label="Dismiss"
            style={{ color: variant.subtle }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Article content — crossfades on prev/next */}
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
        >
          {/* Headline */}
          <div className="px-5 pb-2 pt-4">
            <h3
              className="font-display text-[20px] font-bold leading-[1.1]"
              style={{ color: variant.ink }}
            >
              {item.title}
            </h3>
            <div
              className="mt-1 font-display text-[12px] italic"
              style={{ color: variant.subtle }}
            >
              A report on {data.query}
            </div>
          </div>

          {/* Byline / dateline row */}
          <div
            className="flex items-center gap-2 border-y px-5 py-1.5 font-mono text-[9px] uppercase tracking-[0.3em]"
            style={{ borderColor: variant.ruleSoft, color: variant.subtle }}
          >
            <span>By {item.source || "Staff Correspondent"}</span>
            <span>·</span>
            <span>{dateline}</span>
          </div>

          {/* Body with drop cap — min-height so short summaries don't
              collapse the card height and break the deck rhythm. */}
          <div
            className="px-5 py-3 font-display text-[13.5px] leading-[1.55]"
            style={{ color: variant.ink, minHeight: "6.5rem" }}
          >
            <span
              className="float-left pr-2 font-display font-bold leading-[0.85]"
              style={{
                fontSize: "44px",
                color: variant.ink,
                marginTop: "4px",
              }}
            >
              {firstChar}
            </span>
            {rest}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Footer — prev / pager / link / next */}
      <div
        className="flex items-center justify-between gap-2 border-t px-5 py-2"
        style={{ borderColor: variant.rule, color: variant.subtle }}
      >
        <div className="flex items-center gap-2">
          {hasDeck && (
            <>
              <button
                type="button"
                onClick={prev}
                className="rounded-md p-1 hover:bg-black/5"
                aria-label="Previous article"
                style={{ color: variant.ink }}
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.32em] tabular-nums">
                {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={next}
                className="rounded-md p-1 hover:bg-black/5"
                aria-label="Next article"
                style={{ color: variant.ink }}
              >
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {item.link ? (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.28em] hover:underline"
            >
              Read full dispatch
              <ExternalLink className="h-3 w-3" strokeWidth={2} />
            </a>
          ) : (
            <span className="font-mono text-[9px] uppercase tracking-[0.28em]">
              Wire dispatch
            </span>
          )}
          <span className="font-mono text-[10px] tracking-[0.3em]">— 30 —</span>
        </div>
      </div>
    </div>
  );
}

function rng(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return min + (Math.abs(h) % (max - min + 1));
}

function fmtDateline(published: string): string {
  const d = new Date(published);
  if (Number.isNaN(d.getTime())) {
    return "Dispatch · date withheld";
  }
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  return `TORONTO, ${month} ${d.getDate()} —`;
}
