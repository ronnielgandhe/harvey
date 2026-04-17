"use client";

import { CallCTA } from "./CallCTA";
import { CaseBrief, ScrollCue } from "./CaseBrief";

interface Props {
  onAnswer: () => void;
  loading?: boolean;
  error?: string | null;
}

export function IncomingCall({ onAnswer, loading, error }: Props) {
  return (
    <div className="relative flex min-h-screen flex-col items-center px-6">
      {/* Hero section — fills the viewport. Call button sits below the
          centered PSL × Bluejay header (positioned via PearsonHeader). */}
      <div className="relative flex min-h-screen w-full flex-col items-center">
        <div className="flex flex-col items-center gap-6 pt-[62vh]">
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
        </div>

        {/* Scroll cue — invites the viewer to read the brief below */}
        <ScrollCue />
      </div>

      {/* Case brief — appears on scroll, shows tech + features + credits */}
      <CaseBrief />
    </div>
  );
}
