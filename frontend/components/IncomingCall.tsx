"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { CallCTA } from "./CallCTA";
import { CaseBrief } from "./CaseBrief";
import { NewsCrawl } from "./NewsCrawl";

interface Props {
  onAnswer: () => void;
  loading?: boolean;
  error?: string | null;
}

export function IncomingCall({ onAnswer, loading, error }: Props) {
  // Hero CTA (phone + "LINE OPEN · PICK UP") fades as the user scrolls
  // into the brief, on the same scroll range as the PSL header + skyline
  // mask, so everything clears together.
  const { scrollY } = useScroll();
  const ctaFade = useTransform(scrollY, [60, 260], [1, 0]);

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6">
      {/* Hero section — fills the viewport. Call button sits below the
          centered PSL × Bluejay header (positioned via PearsonHeader). */}
      <div className="relative flex min-h-screen w-full flex-col items-center">
        <motion.div
          style={{ opacity: ctaFade }}
          className="flex flex-col items-center gap-6 pt-[62vh]"
        >
          <CallCTA
            variant="sonar"
            onAnswer={onAnswer}
            loading={loading}
            disabled={loading}
          />

          {error && (
            <div className="mt-2 max-w-md rounded-md border border-[var(--crimson)]/40 bg-[var(--crimson)]/[0.05] px-4 py-2.5 text-center font-mono text-xs text-[var(--crimson)]">
              {error}
            </div>
          )}
        </motion.div>
      </div>

      {/* Case brief — fades up into view as the hero clears. Bottom
          padding leaves room for the NewsCrawl before it fades out. */}
      <div className="pb-16">
        <CaseBrief />
      </div>

      {/* Pre-roll newswire crawl — fades out with the rest of the hero */}
      <NewsCrawl />
    </div>
  );
}
