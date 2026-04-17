"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  RoomAudioRenderer,
  useDataChannel,
  useLocalParticipant,
  useMultibandTrackVolume,
  useVoiceAssistant,
} from "@livekit/components-react";
import { Ear, Loader2, MessageSquare, PhoneOff } from "lucide-react";
import { LocalAudioTrack, Track } from "livekit-client";
import { BluejayPinwheel } from "./BluejayPinwheel";
import { GlassPaneStack, type Pane, type SeeAlsoItem } from "./GlassPaneStack";
import { OffTheRecord } from "./OffTheRecord";
import { CaseReceipt, type ReceiptCounts } from "./CaseReceipt";
import { LiveIndicator } from "./PearsonHeader";

interface Props {
  /** Called when the user ends the call. Carries the billing context
   *  so the idle page can show a post-call receipt in the signature
   *  slot without having to track call state itself. */
  onEnd: (summary: { durationSec: number; counts: ReceiptCounts }) => void;
}

interface DataPayload {
  type?: string;
  payload?: Record<string, unknown>;
  [k: string]: unknown;
}

function decodePayload(data: Uint8Array): DataPayload | null {
  try {
    const text = new TextDecoder().decode(data);
    return JSON.parse(text) as DataPayload;
  } catch {
    return null;
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Subscribes to the local participant's microphone and returns a 6-band
 * volume array (0..1 each). Feeds the BluejayPinwheel's "wings" so they
 * react to the user's voice.
 */
function useLocalMicBands(): number[] {
  const { localParticipant, microphoneTrack } = useLocalParticipant();
  // `useMultibandTrackVolume` wants a concrete LocalAudioTrack (or a
  // TrackReference). The microphone publication's track is a LocalTrack
  // union, so narrow to LocalAudioTrack when present.
  const rawTrack =
    microphoneTrack?.track ??
    localParticipant?.getTrackPublication(Track.Source.Microphone)?.track;
  const audioTrack =
    rawTrack instanceof LocalAudioTrack ? rawTrack : undefined;

  const bands = useMultibandTrackVolume(audioTrack, {
    bands: 6,
    loPass: 150,
    hiPass: 8000,
    updateInterval: 32,
  });
  return bands ?? [];
}

// Safer transcript hook — LiveKit exposes these on the voice-assistant.
function useTranscriptionsSafe() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const va = useVoiceAssistant() as any;
  const agent =
    (va?.agentTranscriptions as Array<{ text?: string; firstReceivedTime?: number }>) ??
    [];
  const user =
    (va?.userTranscriptions as Array<{ text?: string; firstReceivedTime?: number }>) ??
    (va?.transcriptions as Array<{ text?: string; firstReceivedTime?: number }>) ??
    [];
  return { agent, user };
}

export function CallInterface({ onEnd }: Props) {
  const [panes, setPanes] = useState<Pane[]>([]);
  const [counts, setCounts] = useState<ReceiptCounts>({
    statutes: 0,
    news: 0,
    stocks: 0,
    hill: 0,
  });
  const [otr, setOtr] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const micBands = useLocalMicBands();
  const { state: vaState } = useVoiceAssistant();
  const { agent, user } = useTranscriptionsSafe();

  // ─── Mic diagnostics (DEBUG) ─────────────────────────────────────────
  // Logs mic publication status + live audio level to the browser
  // console every second. If MUTED=true or RMS stays 0 while you
  // speak, the browser isn't capturing / publishing your mic and
  // that's why Harvey can't hear you. Safe to leave on — it's
  // console.log only, no UI surface.
  const { localParticipant, microphoneTrack } = useLocalParticipant();
  useEffect(() => {
    const id = setInterval(() => {
      const pub =
        microphoneTrack ??
        localParticipant?.getTrackPublication(Track.Source.Microphone);
      const track = pub?.track;
      const ms = track?.mediaStream;
      const audioTracks = ms?.getAudioTracks() ?? [];
      const native = audioTracks[0];
      // eslint-disable-next-line no-console
      console.log("[mic-debug]", {
        hasPublication: !!pub,
        isMuted: pub?.isMuted ?? null,
        trackKind: track?.kind,
        trackSid: track?.sid,
        trackName: track?.trackName,
        nativeEnabled: native?.enabled,
        nativeMuted: native?.muted,
        nativeReadyState: native?.readyState,
        nativeLabel: native?.label,
        micBandsSum: micBands.reduce((a, b) => a + b, 0).toFixed(4),
      });
    }, 1500);
    return () => clearInterval(id);
  }, [localParticipant, microphoneTrack, micBands]);

  // ─── Call timer with pause support ────────────────────────────────────
  // `startTime` fixed at mount, `pausedMs` accumulates while OTR active.
  // Ticks once per second to force re-render of the LiveIndicator.
  const [startTime] = useState(() => Date.now());
  const [pausedMs, setPausedMs] = useState(0);
  const [pauseStartedAt, setPauseStartedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleOtr = useCallback(() => {
    setOtr((prev) => {
      if (prev) {
        // Resuming — fold the paused interval into total paused time.
        setPausedMs((pm) =>
          pauseStartedAt !== null ? pm + (Date.now() - pauseStartedAt) : pm,
        );
        setPauseStartedAt(null);
        return false;
      } else {
        setPauseStartedAt(Date.now());
        return true;
      }
    });
  }, [pauseStartedAt]);

  const elapsedSec = useMemo(() => {
    const effective =
      otr && pauseStartedAt !== null ? pauseStartedAt : nowMs;
    return Math.max(0, Math.floor((effective - startTime - pausedMs) / 1000));
  }, [nowMs, otr, pauseStartedAt, pausedMs, startTime]);

  // Single source of truth for the HUD label — one tile that swaps
  // content based on voice-assistant state. No separate activity feed.
  const statusLabel = useMemo(() => {
    switch (vaState) {
      case "connecting":
        return "Connecting";
      case "listening":
        return "Harvey listening";
      case "thinking":
        return "Consulting the bench";
      case "speaking":
        return "Harvey speaking";
      case "disconnected":
        return "Offline";
      default:
        return "Standby";
    }
  }, [vaState]);

  // Latest ticker line (newest of agent/user)
  const ticker = useMemo(() => {
    const lastAgent = agent[agent.length - 1];
    const lastUser = user[user.length - 1];
    const aT = lastAgent?.firstReceivedTime ?? 0;
    const uT = lastUser?.firstReceivedTime ?? 0;
    if (!lastAgent && !lastUser) return null;
    if (aT >= uT)
      return { who: "Harvey" as const, text: lastAgent?.text ?? "" };
    return { who: "You" as const, text: lastUser?.text ?? "" };
  }, [agent, user]);

  // ─── Data channel listener — panes only, no evidence wall / memo ────────
  useDataChannel((msg) => {
    const parsed = decodePayload(msg.payload);
    if (!parsed) {
      console.warn("[Harvey] data channel: failed to decode payload", msg);
      return;
    }

    const type = parsed.type;
    const payload = (parsed.payload ?? parsed) as Record<string, unknown>;

    // ░░ DEBUG: log every incoming event so we can see in the browser
    // console whether tool events are actually arriving.
    console.log("[Harvey] data channel event:", type, payload);

    if (type === "statute_card") {
      const id = (payload.id as string) || uid("statute");
      const seeAlsoRaw = Array.isArray(payload.see_also)
        ? (payload.see_also as unknown[])
        : [];
      const seeAlso: SeeAlsoItem[] = seeAlsoRaw.map((raw) => {
        const o = raw as Record<string, unknown>;
        return {
          section: String(o.section ?? ""),
          title: String(o.title ?? ""),
          source: String(o.source ?? ""),
          jurisdiction: o.jurisdiction ? String(o.jurisdiction) : undefined,
          quote: o.quote ? String(o.quote) : undefined,
          fullText: o.full_text ? String(o.full_text) : undefined,
        };
      });
      setPanes((prev) =>
        prev.find((p) => p.id === id)
          ? prev
          : [
              {
                kind: "statute",
                id,
                jurisdiction: String(payload.jurisdiction ?? ""),
                section: String(payload.section ?? ""),
                title: String(payload.title ?? ""),
                quote: String(payload.quote ?? ""),
                fullText: payload.full_text
                  ? String(payload.full_text)
                  : undefined,
                confidence:
                  typeof payload.confidence === "number"
                    ? payload.confidence
                    : undefined,
                seeAlso,
              },
              ...prev,
            ],
      );
      setCounts((c) => ({ ...c, statutes: c.statutes + 1 }));
    } else if (type === "hill_intel") {
      const tradesRaw = Array.isArray(payload.trades)
        ? (payload.trades as unknown[])
        : [];
      const trades = tradesRaw.map((raw) => {
        const o = raw as Record<string, unknown>;
        return {
          ticker: String(o.ticker ?? ""),
          member: String(o.member ?? ""),
          chamber: String(o.chamber ?? ""),
          party: String(o.party ?? ""),
          state: String(o.state ?? ""),
          side: String(o.side ?? ""),
          size: String(o.size ?? ""),
          filed: String(o.filed ?? ""),
          traded: String(o.traded ?? ""),
        };
      });
      setPanes((prev) => [
        {
          kind: "hill_intel",
          id: uid("hill"),
          data: {
            ticker: String(payload.ticker ?? ""),
            trades,
            source: payload.source ? String(payload.source) : undefined,
          },
        },
        ...prev,
      ]);
      setCounts((c) => ({ ...c, hill: c.hill + 1 }));
    } else if (type === "article_spotlight") {
      setPanes((prev) => [
        {
          kind: "article_spotlight",
          id: uid("spot"),
          data: {
            query: String(payload.query ?? ""),
            title: String(payload.title ?? ""),
            source: String(payload.source ?? ""),
            published: String(payload.published ?? ""),
            link: String(payload.link ?? ""),
            summary: String(payload.summary ?? ""),
          },
        },
        ...prev,
      ]);
    } else if (type === "stock_card") {
      setPanes((prev) => [
        {
          kind: "stock_card",
          id: uid("stock"),
          data: {
            query: payload.query ? String(payload.query) : undefined,
            symbol: payload.symbol ? String(payload.symbol) : undefined,
            shortName: payload.shortName ? String(payload.shortName) : undefined,
            currency: payload.currency ? String(payload.currency) : undefined,
            price: typeof payload.price === "number" ? payload.price : undefined,
            previousClose:
              typeof payload.previousClose === "number"
                ? payload.previousClose
                : undefined,
            change:
              typeof payload.change === "number" ? payload.change : undefined,
            changePct:
              typeof payload.changePct === "number"
                ? payload.changePct
                : undefined,
            dayHigh:
              typeof payload.dayHigh === "number" ? payload.dayHigh : undefined,
            dayLow:
              typeof payload.dayLow === "number" ? payload.dayLow : undefined,
            fiftyTwoWeekHigh:
              typeof payload.fiftyTwoWeekHigh === "number"
                ? payload.fiftyTwoWeekHigh
                : undefined,
            fiftyTwoWeekLow:
              typeof payload.fiftyTwoWeekLow === "number"
                ? payload.fiftyTwoWeekLow
                : undefined,
            exchange: payload.exchange ? String(payload.exchange) : undefined,
            closes: Array.isArray(payload.closes)
              ? (payload.closes as unknown[])
                  .map((n) => (typeof n === "number" ? n : Number(n)))
                  .filter((n) => Number.isFinite(n))
              : undefined,
            error: payload.error ? String(payload.error) : undefined,
            message: payload.message ? String(payload.message) : undefined,
          },
        },
        ...prev,
      ]);
      setCounts((c) => ({ ...c, stocks: c.stocks + 1 }));
    } else if (type === "news_ticker") {
      const rawItems = Array.isArray(payload.items) ? (payload.items as unknown[]) : [];
      const items = rawItems.map((raw) => {
        const o = raw as Record<string, unknown>;
        return {
          title: String(o.title ?? ""),
          source: String(o.source ?? ""),
          published: String(o.published ?? ""),
          link: String(o.link ?? ""),
          summary: o.summary ? String(o.summary) : undefined,
        };
      });
      console.log(
        `[Harvey] news_ticker: query="${payload.query}" items=${items.length}`,
        items,
      );
      setPanes((prev) => [
        {
          kind: "news_ticker",
          id: uid("news"),
          data: {
            query: String(payload.query ?? ""),
            items,
          },
        },
        ...prev,
      ]);
      setCounts((c) => ({ ...c, news: c.news + 1 }));
    } else if (type === "tool_call") {
      const id = uid("tool");
      const status = String(payload.status ?? "running");
      setPanes((prev) => [
        { kind: "tool_call", id, name: String(payload.name ?? "tool"), status },
        ...prev,
      ]);
      const ttl = status === "complete" ? 1600 : 3600;
      setTimeout(() => {
        setPanes((prev) => prev.filter((p) => p.id !== id));
      }, ttl);
    }
    // Legacy event types (draft_response, negotiation_play, case_file_update,
    // open_resource, ask_user, action_checklist) are ignored — those tools
    // no longer exist in the slimmed-down backend.
  });

  const handleDismiss = useCallback((id: string) => {
    setPanes((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ─── Dev helper: window.__harveySendText("...") ────────────────────────
  // Publishes a {type:"debug_inject", text} data packet that the backend
  // agent routes into session.generate_reply() — lets us demo the full
  // tool-call flow without a real microphone. Attached to window so
  // preview tooling / console can drive conversations end-to-end.
  // (Reuses `localParticipant` from the mic-debug block above.)
  useEffect(() => {
    if (typeof window === "undefined" || !localParticipant) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__harveySendText = async (text: string) => {
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: "debug_inject", text }),
      );
      try {
        await localParticipant.publishData(payload, { reliable: true });
        return { ok: true, text };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    };
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__harveySendText;
    };
  }, [localParticipant]);

  // See-also pill click → prepend a new statute pane from the cached
  // excerpt on the pill itself (no extra RAG round-trip). Delivers the
  // instant "follow the citation trail" feel.
  const handleSeeAlsoClick = useCallback((item: SeeAlsoItem) => {
    const id = uid("statute-see");
    setPanes((prev) => [
      {
        kind: "statute",
        id,
        jurisdiction: item.jurisdiction ?? "",
        section: item.section,
        title: item.title,
        quote: item.quote ?? item.title,
        fullText: item.fullText,
        confidence: undefined,
        seeAlso: [],
      },
      ...prev,
    ]);
    setCounts((c) => ({ ...c, statutes: c.statutes + 1 }));
  }, []);

  // End-call: open the confirm receipt modal FIRST so the user can
  // cancel a mis-click or skim the line items on a dimmed screen. On
  // confirm we call onEnd with the summary, which pops the idle page
  // into post-call mode with the compact receipt on the left and the
  // "Call again" button on the right.
  const handleEndClick = useCallback(() => {
    setReceiptOpen(true);
  }, []);
  const handleReceiptConfirm = useCallback(() => {
    setReceiptOpen(false);
    onEnd({ durationSec: elapsedSec, counts });
  }, [onEnd, elapsedSec, counts]);
  const handleReceiptCancel = useCallback(() => setReceiptOpen(false), []);

  // ESC toggles the confirm receipt — first press opens, second closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (receiptOpen) setReceiptOpen(false);
        else setReceiptOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [receiptOpen]);

  return (
    <div className="relative min-h-screen">
      <RoomAudioRenderer />

      {/* Dimming wrapper — OTR active = desaturated. The OTR overlay,
          receipt, and LiveIndicator sit OUTSIDE this so they stay crisp. */}
      <div className={otr ? "otr-dim" : ""}>
        {/* Centered audio-reactive Bluejay pinwheel — this IS the voice. */}
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.25, ease: [0.19, 1, 0.22, 1] }}
          >
            <BluejayPinwheel
              size={320}
              micBands={micBands}
              pulse={vaState === "speaking"}
            />
          </motion.div>
        </div>

        {/* Single status HUD above the pinwheel */}
        <StatusHUD state={vaState} label={statusLabel} />

        {/* Right-side supplementary panes */}
        <GlassPaneStack
          panes={panes}
          onDismiss={handleDismiss}
          onSeeAlsoClick={handleSeeAlsoClick}
        />

        {/* Live transcript ticker */}
        <TickerLine ticker={ticker} />

        {/* End call button — bottom center */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="fixed bottom-7 left-1/2 z-30 -translate-x-1/2"
        >
          <button onClick={handleEndClick} className="btn-end">
            <PhoneOff className="h-3.5 w-3.5" strokeWidth={2} />
            End Call
          </button>
        </motion.div>
      </div>

      {/* LIVE MM:SS pill — pause-aware, driven by CallInterface timer */}
      <LiveIndicator elapsedSec={elapsedSec} paused={otr} />

      {/* Off-the-record toggle + full-screen stamp overlay. Rendered
          OUTSIDE otr-dim so the toggle and stamp stay full-contrast. */}
      <OffTheRecord active={otr} onToggle={toggleOtr} />

      {/* Case receipt overlay — intercepts end-call */}
      <CaseReceipt
        open={receiptOpen}
        onCancel={handleReceiptCancel}
        onConfirm={handleReceiptConfirm}
        durationSec={elapsedSec}
        counts={counts}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Jarvis-style status HUD — single pill above the pinwheel. Icon + state.
// ────────────────────────────────────────────────────────────────────────
function StatusHUD({ state, label }: { state: string; label: string }) {
  const Icon =
    state === "thinking"
      ? Loader2
      : state === "speaking"
        ? MessageSquare
        : Ear;
  const spinning = state === "thinking";
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="pointer-events-none fixed left-1/2 top-[24vh] z-30 -translate-x-1/2"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--rule-strong)] bg-[rgba(255,255,255,0.85)] px-3 py-1.5 backdrop-blur">
        <Icon
          className={`h-3 w-3 text-[var(--accent)] ${spinning ? "animate-spin" : ""}`}
          strokeWidth={2}
        />
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--foreground)]"
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Ticker line — latest transcript entry under the pinwheel. Truncated,
// italic, with a "You"/"Harvey" label prefix.
// ────────────────────────────────────────────────────────────────────────
function TickerLine({
  ticker,
}: {
  ticker: { who: "You" | "Harvey"; text: string } | null;
}) {
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-30 w-full max-w-[720px] -translate-x-1/2 px-6">
      <AnimatePresence mode="wait">
        {ticker ? (
          <motion.div
            key={ticker.text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="flex items-baseline justify-center gap-3 text-center"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--accent)]">
              {ticker.who}
            </span>
            <span className="ticker-line truncate text-[15px] italic text-[var(--foreground-muted)]">
              {ticker.text}
            </span>
          </motion.div>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="block text-center font-mono text-[10px] uppercase tracking-[0.42em] text-[var(--foreground-faint)]"
          >
            Speak when ready
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
