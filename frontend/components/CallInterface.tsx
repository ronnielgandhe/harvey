"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  RoomAudioRenderer,
  useDataChannel,
  useLocalParticipant,
  useMultibandTrackVolume,
  useVoiceAssistant,
} from "@livekit/components-react";
import {
  BookOpen,
  Ear,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
} from "lucide-react";
import { BluejayPinwheel } from "./BluejayPinwheel";
import { CaseDocs } from "./CaseDocs";
import { GlassPaneStack, type Pane, type SeeAlsoItem } from "./GlassPaneStack";
import { OffTheRecord } from "./OffTheRecord";
import { CaseReceipt, type ReceiptCounts } from "./CaseReceipt";
import { LiveIndicator } from "./PearsonHeader";
import { StenoBox } from "./StenoBox";

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
  // Read-Docs overlay accessible during the call so the caller can
  // pull up the quick "how to use Harvey" cheat sheet mid-conversation
  // without hanging up. Owned by CallInterface so it layers cleanly
  // above every in-call pane.
  const [docsOpen, setDocsOpen] = useState(false);
  // Mic mute toggle. Lets the caller silence themselves while Harvey
  // is monologuing (useful during a live demo). Drives
  // localParticipant.setMicrophoneEnabled so the backend stops
  // receiving audio.
  const [muted, setMuted] = useState(false);
  // Pane Harvey has voice-expanded — rendered as a centered overlay
  // above the lane stacks. Clearing it (ESC, click-out, "dismiss")
  // returns the pane to its normal lane slot.
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  // Staged end-call fade. When the user confirms the receipt we flip
  // this true, which fades the pinwheel + HUD + panes first (0.5s),
  // THEN fires onEnd 520ms later so the outer AnimatePresence can do
  // its crossfade with empty space instead of a cluttered call UI.
  // Result: spinner fades → container fades → receipt slides in.
  const [ending, setEnding] = useState(false);
  const { state: vaState } = useVoiceAssistant();
  const { agent, user } = useTranscriptionsSafe();
  const { localParticipant, microphoneTrack } = useLocalParticipant();

  // When the user goes quiet too long, we signal the backend to have
  // Harvey drop an impatient line. Nudge cooldown is tracked locally
  // so we don't spam the worker if the user stays silent for minutes.
  const lastNudgeAtRef = useRef<number>(0);

  // The USER'S mic drives the pinwheel wings. Each of the 6 wings
  // reacts to its own FFT band so the caller sees their own voice
  // throbbing the logo as they speak. Was hooked to the agent's
  // track earlier, which made the pinwheel move on Harvey's voice
  // instead of the caller's. 32ms updates = lively response without
  // render-loop thrash.
  const userMicTrack =
    microphoneTrack?.track && microphoneTrack.track.kind === "audio"
      ? (microphoneTrack.track as Parameters<typeof useMultibandTrackVolume>[0])
      : undefined;
  const userBands = useMultibandTrackVolume(userMicTrack, {
    bands: 6,
    updateInterval: 32,
  });

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
        // Off-the-record activated — kick a "drop lore" signal to the
        // agent. Backend picks a Suits-flavored Mike/Jessica/Donna line
        // and Harvey speaks it so OTR is actually theatre, not just dim.
        if (localParticipant) {
          const payload = new TextEncoder().encode(
            JSON.stringify({ type: "otr_on" }),
          );
          localParticipant.publishData(payload, { reliable: true }).catch(
            (err) => console.warn("[Harvey] otr publish failed", err),
          );
        }
        return true;
      }
    });
  }, [pauseStartedAt, localParticipant]);

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
      // Dedupe: ignore if we already have this exact id.
      if (!panes.find((p) => p.id === id)) {
        addContentPane({
          kind: "statute",
          id,
          jurisdiction: String(payload.jurisdiction ?? ""),
          section: String(payload.section ?? ""),
          title: String(payload.title ?? ""),
          quote: String(payload.quote ?? ""),
          fullText: payload.full_text
            ? String(payload.full_text)
            : undefined,
          frenchQuote: payload.french_quote
            ? String(payload.french_quote)
            : undefined,
          frenchFullText: payload.french_full_text
            ? String(payload.french_full_text)
            : undefined,
          confidence:
            typeof payload.confidence === "number"
              ? payload.confidence
              : undefined,
          seeAlso,
        });
        setCounts((c) => ({ ...c, statutes: c.statutes + 1 }));
      }
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
      addContentPane({
        kind: "hill_intel",
        id: uid("hill"),
        data: {
          ticker: String(payload.ticker ?? ""),
          trades,
          source: payload.source ? String(payload.source) : undefined,
        },
      });
      setCounts((c) => ({ ...c, hill: c.hill + 1 }));
    } else if (type === "article_spotlight") {
      const spotlightItemsRaw = Array.isArray(payload.items)
        ? (payload.items as unknown[])
        : [];
      const spotlightItems = spotlightItemsRaw.map((raw) => {
        const o = raw as Record<string, unknown>;
        return {
          title: String(o.title ?? ""),
          source: String(o.source ?? ""),
          published: String(o.published ?? ""),
          link: String(o.link ?? ""),
          summary: String(o.summary ?? ""),
        };
      });
      addContentPane({
        kind: "article_spotlight",
        id: uid("spot"),
        data: {
          query: String(payload.query ?? ""),
          items: spotlightItems,
          // Legacy single-item fallback so old payload shape still renders.
          title: payload.title ? String(payload.title) : undefined,
          source: payload.source ? String(payload.source) : undefined,
          published: payload.published ? String(payload.published) : undefined,
          link: payload.link ? String(payload.link) : undefined,
          summary: payload.summary ? String(payload.summary) : undefined,
        },
      });
    } else if (type === "stock_card") {
      addContentPane({
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
      });
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
      addContentPane({
        kind: "news_ticker",
        id: uid("news"),
        data: {
          query: String(payload.query ?? ""),
          items,
        },
      });
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
    } else if (type === "pane_action") {
      // Voice-driven screen control. Harvey calls `manage_screen(action,
      // target)` on the backend; that publishes this event. We filter
      // the pane list by target and apply the action.
      const action = String(payload.action ?? "").toLowerCase();
      const target = String(payload.target ?? "").toLowerCase();
      const kindForTarget: Record<string, Pane["kind"][]> = {
        stock: ["stock_card"],
        stocks: ["stock_card"],
        hill: ["hill_intel"],
        statute: ["statute"],
        statutes: ["statute"],
        news: ["news_ticker", "article_spotlight"],
        articles: ["news_ticker", "article_spotlight"],
      };

      const match = (p: Pane): boolean => {
        if (p.kind === "tool_call") return false;
        if (target === "all" || target === "everything") return true;
        if (target === "last") return false; // handled below
        const kinds = kindForTarget[target];
        if (kinds && kinds.includes(p.kind)) return true;
        // Ticker-symbol match against stock + hill
        const upper = target.toUpperCase();
        if (p.kind === "stock_card" && p.data.symbol?.toUpperCase() === upper)
          return true;
        if (p.kind === "hill_intel" && p.data.ticker?.toUpperCase() === upper)
          return true;
        return false;
      };

      if (action === "dismiss" || action === "clear" || action === "remove") {
        // Clear focused pane too if it's the one being dismissed.
        setFocusedPaneId(null);
        setPanes((prev) => {
          if (target === "last") return prev.slice(1);
          if (action === "clear" || target === "all" || target === "everything") {
            return prev.filter((p) => p.kind === "tool_call");
          }
          return prev.filter((p) => !match(p));
        });
      } else if (
        action === "expand" ||
        action === "highlight" ||
        action === "focus" ||
        action === "open"
      ) {
        // Find the newest pane that matches and promote it to focus.
        setPanes((prev) => {
          const found = prev.find((p) => match(p));
          if (found) setFocusedPaneId(found.id);
          return prev;
        });
      } else if (action === "collapse" || action === "close") {
        setFocusedPaneId(null);
      }
    } else if (type === "end_call") {
      // Voice-driven hang-up. Harvey just said a goodbye line; we flash
      // the invoice for a beat so the user can skim the bill, then
      // auto-confirm. 1.8s gives enough time to read the numbers
      // without making it feel hung. The confirm handler pops us back
      // to the idle page with the compact post-call receipt on the
      // left and the "Call again" button on the right.
      setReceiptOpen(true);
      setTimeout(() => {
        onEnd({ durationSec: elapsedSec, counts });
      }, 1800);
    }
    // Legacy event types (draft_response, negotiation_play, case_file_update,
    // open_resource, ask_user, action_checklist) are ignored — those tools
    // no longer exist in the slimmed-down backend.
  });

  const handleDismiss = useCallback((id: string) => {
    setPanes((prev) => prev.filter((p) => p.id !== id));
  }, []);

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
    // Stage the fade: pinwheel + HUD + panes die over 500ms while
    // the receipt modal is already gone. THEN fire onEnd so the
    // outer AnimatePresence starts its crossfade against (almost)
    // empty space. No more clanky simultaneous disappearance.
    setEnding(true);
    window.setTimeout(() => {
      onEnd({ durationSec: elapsedSec, counts });
    }, 520);
  }, [onEnd, elapsedSec, counts]);
  const handleReceiptCancel = useCallback(() => setReceiptOpen(false), []);

  // Flip the local mic on/off. LiveKit returns a promise; log but
  // don't block on failure so the UI toggle always lands.
  const handleMuteToggle = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (localParticipant) {
        localParticipant.setMicrophoneEnabled(!next).catch((err) =>
          console.warn("[Harvey] setMicrophoneEnabled failed", err),
        );
      }
      return next;
    });
  }, [localParticipant]);

  // ESC closes focused pane first, then toggles confirm receipt.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (focusedPaneId) {
        setFocusedPaneId(null);
        return;
      }
      if (receiptOpen) setReceiptOpen(false);
      else setReceiptOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [receiptOpen, focusedPaneId]);

  // ─── Idle nudge ──────────────────────────────────────────────────────
  // If the user goes silent for a while, have Harvey drop an impatient
  // line. "I don't have forever" vibes. Gated on:
  //   - last user/agent activity older than NUDGE_SILENCE_MS
  //   - last nudge older than NUDGE_COOLDOWN_MS (no spam)
  //   - Harvey not currently speaking or thinking
  //   - not in OTR mode (off the record stays quiet)
  //   - not in the ending fade
  // We publish {type:"idle_nudge"} on the data channel; the backend
  // picks a random line and speaks it via session.say().
  const NUDGE_SILENCE_MS = 28_000;
  const NUDGE_COOLDOWN_MS = 45_000;
  // Ref-sync the transcription arrays so the interval below doesn't
  // tear down and rebuild every time a new transcript chunk arrives.
  const userRef = useRef(user);
  const agentRef = useRef(agent);
  useEffect(() => {
    userRef.current = user;
    agentRef.current = agent;
  }, [user, agent]);
  useEffect(() => {
    if (!localParticipant) return;
    const id = window.setInterval(() => {
      if (ending || otr) return;
      if (vaState === "speaking" || vaState === "thinking") return;
      const now = Date.now();
      const latest = (
        arr: Array<{ firstReceivedTime?: number }>,
        fallback: number,
      ) =>
        arr.reduce(
          (max, u) => Math.max(max, u.firstReceivedTime ?? 0),
          fallback,
        );
      const lastUser = latest(userRef.current, startTime);
      const lastAgent = latest(agentRef.current, startTime);
      const sinceActivity = now - Math.max(lastUser, lastAgent);
      const sinceNudge = now - lastNudgeAtRef.current;
      if (sinceActivity < NUDGE_SILENCE_MS) return;
      if (sinceNudge < NUDGE_COOLDOWN_MS) return;
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({ type: "idle_nudge" }),
        );
        localParticipant
          .publishData(payload, { reliable: true })
          .catch((err) => console.warn("[Harvey] idle_nudge publish failed", err));
        lastNudgeAtRef.current = now;
      } catch (err) {
        console.warn("[Harvey] idle_nudge error", err);
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [ending, otr, vaState, localParticipant, startTime]);

  const focusedPane = useMemo(
    () => panes.find((p) => p.id === focusedPaneId) ?? null,
    [panes, focusedPaneId],
  );

  // ─── One-topic-at-a-time pane exclusivity ─────────────────────────────
  // When Harvey answers a new question, the previous visual answer
  // should clear so the screen reflects the current conversation —
  // not a pile of stale cards. But if the LLM fires MULTIPLE tool
  // calls for the SAME user turn ("check Tesla AND the law on
  // insider trading"), those all land within ~1-2 seconds and should
  // coexist.
  //
  // The implementation: whenever a content pane arrives, keep any
  // OTHER content panes that landed within BATCH_WINDOW_MS of now —
  // those are siblings from the same turn. Content panes older than
  // the window get evicted. Tool-call pills are ephemeral and have
  // their own TTL, so they're passed through unchanged.
  const BATCH_WINDOW_MS = 2500;
  const paneArrivedAtRef = useRef<Map<string, number>>(new Map());
  const addContentPane = useCallback((newPane: Pane) => {
    const now = Date.now();
    paneArrivedAtRef.current.set(newPane.id, now);
    setPanes((prev) => {
      const kept = prev.filter((p) => {
        if (p.kind === "tool_call") return true;
        const t = paneArrivedAtRef.current.get(p.id) ?? 0;
        return now - t < BATCH_WINDOW_MS;
      });
      for (const id of Array.from(paneArrivedAtRef.current.keys())) {
        if (id !== newPane.id && !kept.some((p) => p.id === id)) {
          paneArrivedAtRef.current.delete(id);
        }
      }
      return [newPane, ...kept];
    });
    // Every new piece of evidence takes center stage. Previous pane
    // disappears; latest wins. Works exactly like a "cycling evidence
    // board" — whatever Harvey just talked about is what's in front
    // of the caller. No scrim, no dim — the center IS the focus.
    setFocusedPaneId(newPane.id);
  }, []);

  return (
    <div className="relative min-h-screen">
      <RoomAudioRenderer />

      {/* Dimming wrapper — OTR active = desaturated. The OTR overlay,
          receipt, and LiveIndicator sit OUTSIDE this so they stay crisp. */}
      <div className={otr ? "otr-dim" : ""}>
        {/* Centered audio-reactive Bluejay pinwheel — this IS the voice.
            When Harvey expands a pane, the pinwheel shrinks + drops
            below the focused card so you can see it still spinning. */}
        {/* Ambient bottom pinwheel — ALWAYS small, ALWAYS pinned to
            the bottom of the screen. Used to live big in the center
            and shrink on focus. New model: the center stage is the
            "evidence" area for whatever Harvey just surfaced, and
            the pinwheel is the always-on voice-presence indicator
            below it. Pulses on speaking, stays present otherwise. */}
        <div className="pointer-events-none fixed inset-x-0 bottom-[96px] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: ending ? 0 : 1,
              scale: ending ? 0.4 : 0.32,
            }}
            transition={{
              opacity: ending
                ? { duration: 0.45, ease: [0.55, 0, 1, 0.45] }
                : { duration: 0.6, delay: 0.25 },
              scale: { duration: 0.55, ease: [0.19, 1, 0.22, 1] },
            }}
            style={{ zIndex: 1 }}
          >
            <BluejayPinwheel
              size={320}
              pulse={vaState === "speaking"}
              micBands={userBands}
            />
          </motion.div>
        </div>

        {/* Status HUD, panes, transcript, end-call button — all fade
            together with the pinwheel when ending=true so the scene
            empties cleanly before the crossfade to incoming. */}
        <motion.div
          animate={{ opacity: ending ? 0 : 1 }}
          transition={{ duration: 0.35, ease: [0.55, 0, 1, 0.45] }}
        >
        <StatusHUD state={vaState} label={statusLabel} />

        {/* Read docs mid-call — small, muted link in the top-right so
            a caller who's never used Harvey before can pull up the
            quick reference without hanging up. Click opens the same
            CaseDocs overlay that lives on the idle page, now with an
            added "How to talk to Harvey" cheat sheet section. */}
        <motion.button
          type="button"
          onClick={() => setDocsOpen(true)}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.75, ease: [0.19, 1, 0.22, 1] }}
          className="group fixed right-6 top-6 z-30 inline-flex items-center gap-1.5 rounded-full border border-[var(--rule-strong)] bg-[rgba(255,255,255,0.82)] px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.32em] text-[var(--foreground-muted)] backdrop-blur transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          aria-label="Open Harvey how-to docs"
        >
          <BookOpen className="h-3 w-3" strokeWidth={2} />
          Read docs
        </motion.button>

        {/* Right-side supplementary panes */}
        <GlassPaneStack
          panes={panes}
          onDismiss={handleDismiss}
          onSeeAlsoClick={handleSeeAlsoClick}
          focusedId={focusedPaneId}
          hideFocused
        />

        {/* Live court-reporter transcript box — bottom-right, above LIVE pill */}
        <StenoBox agent={agent} user={user} startMs={startTime} />

        {/* Mute toggle + End call, grouped bottom center. Mute sits
            to the left of End so the kill switch stays the rightmost
            (and most prominent) action. */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="fixed bottom-7 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3"
        >
          <button
            type="button"
            onClick={handleMuteToggle}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            aria-pressed={muted}
            className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 font-mono text-[10px] uppercase tracking-[0.32em] backdrop-blur transition-colors ${
              muted
                ? "border-[var(--crimson)] bg-[var(--crimson)] text-white hover:bg-[var(--foreground)] hover:border-[var(--foreground)]"
                : "border-[var(--rule-strong)] bg-[rgba(255,255,255,0.82)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {muted ? (
              <MicOff className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <Mic className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {muted ? "Muted" : "Mute"}
          </button>
          <button onClick={handleEndClick} className="btn-end">
            <PhoneOff className="h-3.5 w-3.5" strokeWidth={2} />
            End Call
          </button>
        </motion.div>
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

      {/* Focused-pane overlay — when Harvey "expands" a pane it flies
          to the center and scales up for reading. Click-out or ESC
          returns it to its lane. */}
      <FocusedPaneOverlay
        pane={focusedPane}
        onSeeAlsoClick={handleSeeAlsoClick}
        onClose={() => setFocusedPaneId(null)}
      />

      {/* Mid-call Read Docs — same dossier that lives on the idle
          page, now also available during an active call. Rendered
          outside the otr-dim wrapper so it stays full contrast. */}
      <CaseDocs open={docsOpen} onClose={() => setDocsOpen(false)} />
      {/* DonnaFlash overlay removed — the full-screen shout was too
          much. The bit lives in Harvey's VOICE now: a short secretary
          line before he fires stock/news tools, ending in an audible,
          drawn-out "DONNAAAAA" the TTS actually performs. */}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// FocusedPaneOverlay — voice-driven "expand" target. Harvey says "expand
// the Apple card" → backend fires manage_screen(expand, AAPL) → the
// matching pane flies to the center, scales up, and shows its fullest
// form (statutes expand their full text; stock cards get a bigger body;
// hill intel shows every row). Scrim + ESC + click-out all dismiss.
// ────────────────────────────────────────────────────────────────────────
function FocusedPaneOverlay({
  pane,
  onClose,
  onSeeAlsoClick,
}: {
  pane: Pane | null;
  onClose: () => void;
  onSeeAlsoClick?: (item: SeeAlsoItem) => void;
}) {
  return (
    <AnimatePresence>
      {pane && (
        <motion.div
          key="focus-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          {/* No scrim. Center stage IS the focus by design now —
              the pinwheel lives at the bottom, there's nothing
              visually competing with the evidence card, and
              dimming the background added a stagey "modal" feel we
              don't want. A transparent click-catcher still sits
              behind the card to dismiss on outside-click. */}
          <motion.div
            onClick={onClose}
            className="fixed inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />

          {/* Card layer. The outer flex uses items-start with top +
              bottom padding so tall cards (stock fundamentals, full
              statute) can scroll naturally within the overlay — they
              don't get clipped by the viewport like they would under
              items-center. pb-[34vh] reserves space below the card
              so the shrunk pinwheel spinning at the bottom of the
              screen doesn't hide any content. */}
          <div
            className="relative flex min-h-full w-full justify-center px-6 pt-[8vh] pb-[34vh]"
            style={{ pointerEvents: "none" }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 6 }}
              transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
              className="w-full max-w-[620px]"
              style={{ pointerEvents: "auto" }}
            >
              <FocusedPaneBody
                pane={pane}
                onSeeAlsoClick={onSeeAlsoClick}
                onClose={onClose}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Dynamic import from GlassPaneStack so we can reuse the existing pane
// card components without duplicating. Kept inline as a small render
// switch — each pane gets its "expanded" props where applicable.
import { StatutePaneCard } from "./GlassPaneStack";
import { NewsTickerPane } from "./panes/NewsTickerPane";
import { ArticleSpotlightPane } from "./panes/ArticleSpotlightPane";
import { StockCardPane } from "./panes/StockCardPane";
import { HillIntelPane } from "./panes/HillIntelPane";

function FocusedPaneBody({
  pane,
  onSeeAlsoClick,
  onClose,
}: {
  pane: Pane;
  onSeeAlsoClick?: (item: SeeAlsoItem) => void;
  onClose: () => void;
}) {
  switch (pane.kind) {
    case "statute":
      // Force the "fullText + see-also pills" expanded state by
      // synthesizing a pane whose quote IS the full text.
      return (
        <StatutePaneCard
          pane={{
            ...pane,
            quote: pane.fullText || pane.quote,
          }}
          onDismiss={onClose}
          onSeeAlsoClick={onSeeAlsoClick}
        />
      );
    case "news_ticker":
      return <NewsTickerPane data={pane.data} paneId={pane.id} onDismiss={onClose} />;
    case "article_spotlight":
      return (
        <ArticleSpotlightPane data={pane.data} paneId={pane.id} onDismiss={onClose} />
      );
    case "stock_card":
      // defaultExpanded=true: in the rail a stock card is a chart
      // mini. When Harvey voice-expands ("bring Tesla to the center"),
      // the focus overlay is where the user wants the WHOLE thing —
      // fundamentals, ranges, everything — visible without a click.
      return (
        <StockCardPane
          data={pane.data}
          paneId={pane.id}
          onDismiss={onClose}
          defaultExpanded
        />
      );
    case "hill_intel":
      return <HillIntelPane data={pane.data} paneId={pane.id} onDismiss={onClose} />;
    default:
      return null;
  }
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

