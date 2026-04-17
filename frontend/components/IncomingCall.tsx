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
  /** Post-call state: receipt on the LEFT, "Call again" on the RIGHT.
   *  Back click clears it and the phone returns to dead-center. */
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
 * Two states:
 *   IDLE      — phone dead-center, directly under PSL × Bluejay header.
 *   POST-CALL — receipt on the left, "Call again" button on the right.
 *               Back on the receipt = instant snap back to centered phone.
 */
export function IncomingCall({ onAnswer, loading, error, postCall }: Props) {
  const isPostCall = !!postCall;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center">
      <AnimatePresence mode="wait">
        {isPostCall ? (
          // POST-CALL: two-column layout. Receipt LEFT, Call Again RIGHT.
          //
          // Cinematic cascade when the receipt lands:
          //   t=0.00s — outer container fades up (while the call UI is
          //              still fading out over in page.tsx)
          //   t=0.25s — receipt begins its slide-from-left
          //   t=0.55s — "Call again" button fades in from the right
          //   t=0.85s — subtext settles last
          //
          // The old timings (180ms outer, 350ms + 400ms children) were
          // too fast: felt snapped rather than staged. These longer,
          // staggered entries read as a single continuous gesture.
          <motion.div
            key="post-call"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
            className="grid w-full max-w-[1200px] grid-cols-1 items-center gap-14 px-8 pt-[52vh] md:grid-cols-[1fr_1fr] md:gap-20"
          >
            {/* LEFT — receipt */}
            <motion.div
              initial={{ opacity: 0, x: -48, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.85,
                delay: 0.25,
                ease: [0.19, 1, 0.22, 1],
              }}
              className="flex md:justify-end"
            >
              <div className="w-full max-w-[460px]">
                <PostCallReceipt
                  durationSec={postCall!.durationSec}
                  counts={postCall!.counts}
                  onBack={postCall!.onBack}
                />
              </div>
            </motion.div>

            {/* RIGHT — Call Again */}
            <motion.div
              initial={{ opacity: 0, x: 32, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.75,
                delay: 0.55,
                ease: [0.19, 1, 0.22, 1],
              }}
              className="flex flex-col items-center gap-3 md:items-start"
            >
              <button
                type="button"
                onClick={postCall!.onConfirm}
                className="group relative inline-flex items-center gap-3 rounded-full bg-[var(--foreground)] px-7 py-4 font-mono text-[11px] uppercase tracking-[0.38em] text-white transition-colors hover:bg-[var(--crimson)]"
              >
                <PhoneCall className="h-4 w-4" strokeWidth={2} />
                Call again
              </button>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.5,
                  delay: 0.95,
                  ease: [0.19, 1, 0.22, 1],
                }}
                className="font-mono text-[9px] uppercase tracking-[0.38em] text-[var(--foreground-faint)]"
              >
                Confirm to close the receipt
              </motion.span>
            </motion.div>
          </motion.div>
        ) : (
          // IDLE: phone dead-center.
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.15,
              ease: [0.22, 0.9, 0.25, 1],
            }}
            className="flex flex-col items-center gap-3 pt-[52vh]"
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
  );
}
