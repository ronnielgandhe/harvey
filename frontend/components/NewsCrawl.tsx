"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Thin newswire-style crawl pinned to the bottom of the landing page.
 * Pulls 10 current Canadian legal headlines from our /api/newsfeed proxy
 * and scrolls them horizontally in a continuous loop — the "pre-roll" a
 * user sees BEFORE they pick up the call.
 *
 * Style is restrained-editorial: cream bar, hairline top rule, mono
 * uppercase eyebrow with a pulsing red live-indicator dot, serif italic
 * headline body, small filled vertical rules between items.
 */

interface Item {
  title: string;
  source: string;
  link: string;
}

const SCROLL_SPEED_PX_PER_SEC = 55; // readable but not lazy

export function NewsCrawl() {
  const [items, setItems] = useState<Item[]>([]);

  // Crawl is hero theater — ease it out as the user scrolls into the
  // brief so the reading experience is clean.
  const { scrollY } = useScroll();
  const fade = useTransform(scrollY, [120, 360], [1, 0]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/newsfeed?count=10", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Item[] }) => {
        if (cancelled) return;
        const xs = (d.items ?? []).filter((i) => i.title);
        setItems(xs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  // Duplicate the list so the loop point is invisible (half slides off as
  // the second half slides in).
  const loop = [...items, ...items];

  // Rough content width → duration. We don't know the pixel width
  // without measuring, but 10 items at ~300px avg ≈ 3000px; duration
  // = width / speed.
  const approxWidthPx = items.length * 320;
  const durationSec = approxWidthPx / SCROLL_SPEED_PX_PER_SEC;

  return (
    <motion.div
      style={{ opacity: fade }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 border-t border-[var(--rule-strong)] bg-gradient-to-b from-[rgba(247,243,234,0.92)] to-[rgba(239,233,216,0.92)] backdrop-blur-sm"
    >
      <div className="flex items-stretch overflow-hidden">
        {/* Fixed eyebrow on the left */}
        <div className="pointer-events-auto flex items-center gap-2 border-r border-[var(--rule-strong)] px-4 py-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--crimson)]/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--crimson)]" />
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.42em] text-[var(--foreground)]">
            The Wire
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
            · Canadian Law
          </span>
        </div>

        {/* Scrolling marquee */}
        <div className="relative flex-1 overflow-hidden">
          <motion.div
            className="flex items-center gap-6 whitespace-nowrap py-2 pl-6"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              duration: durationSec,
              ease: "linear",
              repeat: Infinity,
            }}
          >
            {loop.map((item, i) => (
              <CrawlItem key={`${i}-${item.title.slice(0, 20)}`} item={item} />
            ))}
          </motion.div>

          {/* Edge fades so items don't pop abruptly */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[rgba(247,243,234,0.95)] to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[rgba(239,233,216,0.95)] to-transparent"
          />
        </div>
      </div>
    </motion.div>
  );
}

function CrawlItem({ item }: { item: Item }) {
  return (
    <span className="pointer-events-auto flex items-center gap-3">
      <span className="font-display text-[13px] italic text-[var(--foreground)]">
        {item.title}
      </span>
      {item.source && (
        <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--foreground-faint)]">
          — {item.source}
        </span>
      )}
      <span
        aria-hidden
        className="h-3 w-px bg-[var(--rule-strong)]"
      />
    </span>
  );
}
