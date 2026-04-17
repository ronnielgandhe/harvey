"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { PearsonHeader } from "@/components/PearsonHeader";
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

  // Scroll-linked fade: the entire hero (PSL header, skyline dim, news
  // crawl) eases out as the user scrolls into the case brief, so the
  // brief "takes over" the page instead of fighting a fixed header.
  const { scrollY } = useScroll();
  // Fully visible until ~60px of scroll, fully gone by 340px.
  const heroFade = useTransform(scrollY, [60, 340], [1, 0]);
  // Canyon mask opacity — 0 at rest, ramps to 1 as the user scrolls.
  // Renders a bg-colored linear gradient over the center of the skyline
  // that effectively "eats away" the buildings in the middle, leaving
  // the outer 450px walls intact for scale framing.
  const canyonOpacity = useTransform(scrollY, [0, 260], [0, 1]);

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

      {/* Scroll-linked canyon overlay — at rest this is invisible, so
          the skyline shows unmasked. As the user scrolls into the brief
          the overlay fades in, erasing the center of the skyline while
          keeping the outer 450px solid. Emphasizes text scale without
          crowding copy. Skipped while in call. */}
      {!conn && (
        <motion.div
          aria-hidden
          style={{
            opacity: canyonOpacity,
            zIndex: 1,
            background:
              "linear-gradient(to right, " +
              "transparent 0, " +
              "transparent 430px, " +
              "var(--background) 40%, " +
              "var(--background) 60%, " +
              "transparent calc(100% - 430px), " +
              "transparent 100%)",
          }}
          className="pointer-events-none fixed inset-0"
        />
      )}

      {/* Foreground content sits above the skyline */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* PSL × Bluejay header. In idle mode it fades out on scroll so
            the brief takes the page; in-call it stays pinned in the
            corner. */}
        {conn ? (
          <PearsonHeader variant="corner" live />
        ) : (
          <motion.div style={{ opacity: heroFade }}>
            <PearsonHeader variant="center" live={false} />
          </motion.div>
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
