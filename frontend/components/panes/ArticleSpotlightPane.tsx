"use client";

import { motion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";

export interface ArticleSpotlightData {
  query: string;
  title: string;
  source: string;
  published: string;
  link: string;
  summary: string;
}

interface Props {
  data: ArticleSpotlightData;
  paneId: string;
  onDismiss?: (id: string) => void;
}

/**
 * Vintage front-page newspaper styling — sepia card with a serif drop
 * cap, dateline, pull quote, byline footer. Triggered when
 * `current_events` fires, shows the top Google News result in an
 * editorial layout rather than a list item.
 */
export function ArticleSpotlightPane({ data, paneId, onDismiss }: Props) {
  const summary = data.summary || data.title;
  const firstChar = summary[0] ?? "T";
  const rest = summary.slice(1);
  const dateline = fmtDateline(data.published);

  return (
    <div
      className="relative overflow-hidden rounded-sm"
      style={{
        /* Sepia newsprint tone */
        background:
          "linear-gradient(180deg, #f7f3ea 0%, #efe9d8 100%)",
        border: "1px solid rgba(80, 60, 20, 0.25)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 16px 40px -24px rgba(60,40,10,0.25)",
      }}
    >
      {/* Top rule: THE DAILY DOSSIER-style masthead */}
      <div className="flex items-center justify-between border-b border-[rgba(60,40,10,0.2)] px-5 py-2">
        <span
          className="font-display text-[11px] uppercase tracking-[0.38em]"
          style={{ color: "#3a2b10" }}
        >
          The Daily Dossier
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.3em]"
          style={{ color: "rgba(60,40,10,0.55)" }}
        >
          Vol. MMXXVI · No. {rng(data.title, 1, 999).toString().padStart(3, "0")}
        </span>
        {onDismiss && (
          <button
            onClick={() => onDismiss(paneId)}
            className="rounded-md p-0.5 text-[rgba(60,40,10,0.55)] hover:bg-black/5"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Headline */}
      <div className="px-5 pb-2 pt-4">
        <motion.h3
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="font-display text-[20px] font-bold leading-[1.1]"
          style={{ color: "#1a1208" }}
        >
          {data.title}
        </motion.h3>
        <div
          className="mt-1 font-display text-[12px] italic"
          style={{ color: "rgba(60,40,10,0.7)" }}
        >
          A report on {data.query}
        </div>
      </div>

      {/* Byline / dateline row */}
      <div
        className="flex items-center gap-2 border-y border-[rgba(60,40,10,0.15)] px-5 py-1.5 font-mono text-[9px] uppercase tracking-[0.3em]"
        style={{ color: "rgba(60,40,10,0.7)" }}
      >
        <span>By {data.source || "Staff Correspondent"}</span>
        <span>·</span>
        <span>{dateline}</span>
      </div>

      {/* Body with drop cap */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="px-5 py-3 font-display text-[13.5px] leading-[1.55]"
        style={{ color: "#231810" }}
      >
        <span
          className="float-left pr-2 font-display font-bold leading-[0.85]"
          style={{
            fontSize: "44px",
            color: "#1a1208",
            marginTop: "4px",
          }}
        >
          {firstChar}
        </span>
        {rest}
      </motion.div>

      {/* Footer: link + end-mark */}
      <div
        className="flex items-center justify-between border-t border-[rgba(60,40,10,0.2)] px-5 py-2"
        style={{ color: "rgba(60,40,10,0.7)" }}
      >
        {data.link ? (
          <a
            href={data.link}
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
  );
}

// Deterministic tiny hash → stable "issue number" per article title.
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
