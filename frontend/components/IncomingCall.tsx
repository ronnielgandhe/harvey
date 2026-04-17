"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PhoneCall } from "lucide-react";
import { CallCTA } from "./CallCTA";
import { PostCallReceipt } from "./PostCallReceipt";
import type { ReceiptCounts } from "./CaseReceipt";

interface Props {
  onAnswer: () => void;
  loading?: boolean;
  error?: string | null;
  /** Post-call pause state. When present, the phone stays centered
   *  (as "Call again") and an itemized receipt slides in from the right.
   *  Clicking Back on the receipt (onBack) dismisses it and leaves the
   *  phone dead-center again. */
  postCall?: {
    durationSec: number;
    counts: ReceiptCounts;
    onConfirm: () => void;
    onBack: () => void;
  } | null;
}

/**
 * Idle landing screen.
 *
 * One element — the phone — is the entire hero. Dead center, directly
 * under the PSL × Bluejay header. On call-end the phone morphs into a
 * "Call again" pill and an itemized receipt slides in from the right
 * (the phone itself stays centered so the eye doesn't jump). Back on
 * the receipt → phone returns to center alone.
 */
export function IncomingCall({ onAnswer, loading, error, postCall }: Props) {
  const isPostCall = !!postCall;

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center">
      {/* Centered phone / call-again — the one anchor of the hero */}
      <div className="relative flex w-full max-w-[1100px] items-center justify-center px-6 pt-[52vh]">
        <AnimatePresence mode="popLayout">
          {isPostCall ? (
            <motion.div
              key="call-again"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
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
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.9,
                delay: 0.3,
                ease: [0.22, 0.9, 0.25, 1],
              }}
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

        {/* Receipt panel — slides in from the right during post-call.
            Absolutely positioned so its presence / absence never shifts
            the centered phone. On Back click (handled inside the
            receipt) the parent clears `postCall` and this unmounts,
            leaving the phone alone at center. */}
        <AnimatePresence>
          {isPostCall && (
            <motion.div
              key="receipt"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
              className="absolute top-[52vh] right-[4vw] w-full max-w-[460px]"
              style={{ pointerEvents: "auto" }}
            >
              <PostCallReceipt
                durationSec={postCall!.durationSec}
                counts={postCall!.counts}
                onBack={postCall!.onBack}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
