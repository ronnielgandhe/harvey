"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { PearsonHeader } from "@/components/PearsonHeader";
import { IncomingCall } from "@/components/IncomingCall";
import { CallInterface } from "@/components/CallInterface";
import { CaseDocs } from "@/components/CaseDocs";
import type { ReceiptCounts } from "@/components/CaseReceipt";

// Heavy Three.js — load client-side only to keep initial bundle small
const SkylineBackdrop = dynamic(
  () => import("@/components/SkylineBackdrop").then((m) => m.SkylineBackdrop),
  { ssr: false },
);

interface ConnectionDetails {
  token: string;
  url: string;
}

interface PostCallState {
  durationSec: number;
  counts: ReceiptCounts;
}

export default function Home() {
  const [conn, setConn] = useState<ConnectionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  // Post-call "pause beat" — populated the moment the user ends a call.
  // The idle page uses this to swap the signature for a paper receipt
  // and the sonar phone for a "Call again" button. Cleared when they
  // confirm by clicking Call again (which initiates a fresh call).
  const [postCall, setPostCall] = useState<PostCallState | null>(null);

  const handleAnswer = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Clear any leftover post-call receipt once a new call is on the way.
    setPostCall(null);
    try {
      const res = await fetch("/api/token", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Token request failed (${res.status})`);
      }
      const data = (await res.json()) as ConnectionDetails;
      if (!data.token || !data.url) throw new Error("Malformed token response");
      setConn(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleEnd = useCallback(
    (summary?: { durationSec: number; counts: ReceiptCounts }) => {
      if (summary) {
        setPostCall({
          durationSec: summary.durationSec,
          counts: summary.counts,
        });
      }
      setConn(null);
    },
    [],
  );

  return (
    <main className="bg-background relative min-h-screen">
      {/* Ambient wireframe NYC skyline flythrough — fills the negative space */}
      <SkylineBackdrop dimmed={!!conn} />

      {/* Foreground content sits above the skyline */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* PSL × Bluejay header. In idle it sits in the hero slot; in
            call it's pinned bottom-left. No scroll fade now that the
            idle page is single-screen. */}
        {conn ? (
          <PearsonHeader variant="corner" live />
        ) : (
          <PearsonHeader
            variant="center"
            live={false}
            onOpenDocs={() => setDocsOpen(true)}
          />
        )}

        {/* LIVE MM:SS pill + OTR toggle + receipt now owned by CallInterface
            so they can share pause state with the call timer. */}

        {/* Swap the main content based on connection state, crossfading so
            the pinwheel appearance feels like part of the same layout. */}
        <AnimatePresence mode="wait">
          {!conn ? (
            <motion.div
              key="incoming"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.2, 0.9, 0.3, 1] }}
            >
              <IncomingCall
                onAnswer={handleAnswer}
                loading={loading}
                error={error}
                postCall={
                  postCall
                    ? {
                        durationSec: postCall.durationSec,
                        counts: postCall.counts,
                        // "Call again" confirms the receipt AND fires
                        // a new call — single action, same button.
                        onConfirm: () => {
                          handleAnswer();
                        },
                        // Back arrow — clears the receipt only, no
                        // new call. Returns to the Meet Harvey hero.
                        onBack: () => setPostCall(null),
                      }
                    : null
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key="call"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.25, ease: [0.2, 0.9, 0.3, 1] }}
            >
              <LiveKitRoom
                token={conn.token}
                serverUrl={conn.url}
                connect
                audio
                video={false}
                onDisconnected={handleEnd}
              >
                <CallInterface onEnd={handleEnd} />
              </LiveKitRoom>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Centered dossier overlay — only available in idle. Renders
          above everything (its own z-layer) and blurs the backdrop
          via its own scrim, so we don't need to filter the content
          layer here (doing so was breaking the sonar pulse). */}
      {!conn && (
        <CaseDocs open={docsOpen} onClose={() => setDocsOpen(false)} />
      )}
    </main>
  );
}
