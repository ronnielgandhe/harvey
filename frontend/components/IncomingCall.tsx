"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PhoneCall } from "lucide-react";
import { CallCTA } from "./CallCTA";
import { MeetHarvey } from "./MeetHarvey";
import { PostCallReceipt } from "./PostCallReceipt";
import type { ReceiptCounts } from "./CaseReceipt";

interface Props {
  onAnswer: () => void;
  loading?: boolean;
  error?: string | null;
  /** Post-call pause state — when provided, the signature on the left
   *  is replaced by an itemized receipt of what just happened and the
   *  phone on the right becomes "Call again". */
  postCall?: {
    durationSec: number;
    counts: ReceiptCounts;
    onConfirm: () => void;
  } | null;
}

/**
 * Idle landing screen. Two-column hero:
 *   LEFT  — signed "Meet Harvey Specter"
 *   RIGHT — sonar phone CTA (nudged further right than a mirror)
 *
 * Post-call, the LEFT swaps to an itemized paper receipt and the RIGHT
 * swaps the phone icon for a "Call again" button. Both swaps crossfade
 * via AnimatePresence so the transition from call-ended → idle feels
 * like a single beat, not a white flash.
 */
export function IncomingCall({ onAnswer, loading, error, postCall }: Props) {
  const isPostCall = !!postCall;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center">
      <div className="grid w-full max-w-[1100px] grid-cols-1 items-center gap-16 px-10 pb-20 pt-[54vh] md:grid-cols-[1fr_1fr] md:gap-20 md:pt-[52vh]">
        {/* LEFT — signature OR post-call receipt */}
        <div className="flex md:justify-end">
          <AnimatePresence mode="wait">
            {isPostCall ? (
              <motion.div
                key="receipt"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
                className="w-full max-w-[460px]"
              >
                <PostCallReceipt
                  durationSec={postCall!.durationSec}
                  counts={postCall!.counts}
                />
              </motion.div>
            ) : (
              <motion.div
                key="signature"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <MeetHarvey />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT — phone or "Call again" button. Nudged right with an
            explicit inline style so there's no Tailwind arbitrary-value
            ambiguity in the preview. */}
        <div
          className="flex flex-col items-center gap-3 md:items-start"
          style={{ paddingLeft: "var(--phone-nudge, 120px)" }}
        >
          <AnimatePresence mode="wait">
            {isPostCall ? (
              <motion.div
                key="call-again"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
                className="flex flex-col items-center gap-3"
              >
                <button
                  type="button"
                  onClick={postCall!.onConfirm}
                  className="group relative inline-flex items-center gap-3 rounded-full bg-[var(--foreground)] px-7 py-4 font-mono text-[11px] uppercase tracking-[0.38em] text-white transition-colors hover:bg-[var(--crimson)]"
                >
                  <PhoneCall className="h-4 w-4" strokeWidth={2} />
                  Call again
                </button>
                <span className="font-mono text-[9px] uppercase tracking-[0.38em] text-[var(--foreground-faint)]">
                  Confirm to close the receipt
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="sonar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-3"
              >
                <CallCTA
                  variant="sonar"
                  onAnswer={onAnswer}
                  loading={loading}
                  disabled={loading}
                />
                {error && (
                  <div className="mt-1 max-w-[320px] rounded-md border border-[var(--crimson)]/40 bg-[var(--crimson)]/[0.05] px-4 py-2 text-center font-mono text-[11px] text-[var(--crimson)]">
                    {error}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
