"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { LiveIndicator, PearsonHeader } from "@/components/PearsonHeader";
import { IncomingCall } from "@/components/IncomingCall";
import { CallInterface } from "@/components/CallInterface";

// Heavy Three.js — load client-side only to keep initial bundle small
const SkylineBackdrop = dynamic(
  () => import("@/components/SkylineBackdrop").then((m) => m.SkylineBackdrop),
  { ssr: false },
);

interface ConnectionDetails {
  token: string;
  url: string;
}

export default function Home() {
  const [conn, setConn] = useState<ConnectionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnswer = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  const handleEnd = useCallback(() => {
    setConn(null);
  }, []);

  return (
    <main className="bg-background relative min-h-screen">
      {/* Ambient wireframe NYC skyline flythrough — fills the negative space */}
      <SkylineBackdrop dimmed={!!conn} />

      {/* Foreground content sits above the skyline */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* PSL × Bluejay header is persistent — animates smoothly from center
            (idle) to bottom-left corner (in-call) when `conn` flips. */}
        <PearsonHeader variant={conn ? "corner" : "center"} live={!!conn} />

        {/* Big "LIVE MM:SS" pill in the bottom-right — only while connected. */}
        {conn && <LiveIndicator />}

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
    </main>
  );
}
