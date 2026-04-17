"use client";

import { useEffect, useRef } from "react";
import { useVoiceAssistant } from "@livekit/components-react";

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function Transcript() {
  const { agentTranscriptions, userTranscriptions } = useVoiceAssistantSafe();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Merge + sort transcriptions by their order/time
  const merged = [
    ...userTranscriptions.map((t) => ({ ...t, who: "YOU" as const })),
    ...agentTranscriptions.map((t) => ({ ...t, who: "HARVEY" as const })),
  ].sort((a, b) => (a.firstReceivedTime ?? 0) - (b.firstReceivedTime ?? 0));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [merged.length]);

  return (
    <div className="flex h-full flex-col rounded border border-[#d4af37]/20 bg-black/60 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-[#d4af37]/20 px-5 py-3">
        <div className="font-serif text-sm tracking-[0.35em] text-[#d4af37] uppercase">
          Transcript
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#f5f0e1]/40">
          Court Reporter Log
        </div>
      </div>

      <div
        ref={scrollRef}
        className="thin-scroll flex-1 overflow-y-auto px-5 py-4 space-y-4 font-mono text-sm"
      >
        {merged.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-[#d4af37]/30 font-serif italic text-base">
                Waiting for the record to commence…
              </div>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#f5f0e1]/30">
                Speak when ready
              </div>
            </div>
          </div>
        ) : (
          merged.map((entry, i) => {
            const ts = entry.firstReceivedTime
              ? new Date(entry.firstReceivedTime)
              : new Date();
            const isHarvey = entry.who === "HARVEY";
            return (
              <div key={`${entry.id ?? i}-${entry.who}`} className="fade-up">
                <div className="flex items-baseline gap-3">
                  <span className="text-[10px] text-[#f5f0e1]/30 tabular-nums">
                    [{formatTime(ts)}]
                  </span>
                  <span
                    className={`text-[11px] font-semibold tracking-[0.2em] uppercase ${
                      isHarvey ? "text-[#d4af37]" : "text-[#f5f0e1]/70"
                    }`}
                  >
                    {entry.who}:
                  </span>
                </div>
                <p
                  className={`mt-1 pl-[5.5rem] leading-relaxed ${
                    isHarvey ? "text-[#f5f0e1]" : "text-[#f5f0e1]/70"
                  }`}
                >
                  {entry.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Defensive wrapper since `useVoiceAssistant` API surface evolves between minor versions.
function useVoiceAssistantSafe() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const va = useVoiceAssistant() as any;
  return {
    agentTranscriptions: (va?.agentTranscriptions ?? []) as Array<{
      id?: string;
      text: string;
      firstReceivedTime?: number;
    }>,
    userTranscriptions: (va?.userTranscriptions ??
      va?.transcriptions ??
      []) as Array<{
      id?: string;
      text: string;
      firstReceivedTime?: number;
    }>,
  };
}
