"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Globe, X } from "lucide-react";

export interface OpenResourceData {
  url: string;
  label: string;
  favicon?: string;
  why?: string;
}

interface Props {
  data: OpenResourceData;
  paneId: string;
  onDismiss?: (id: string) => void;
}

function getFaviconUrl(url: string, fallback?: string) {
  if (fallback) return fallback;
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?sz=64&domain=${u.hostname}`;
  } catch {
    return undefined;
  }
}

export function OpenResourcePane({ data, paneId, onDismiss }: Props) {
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const fav = getFaviconUrl(data.url, data.favicon);

  // Fallback if iframe doesn't load within 3s
  useEffect(() => {
    const t = setTimeout(() => {
      if (!iframeLoaded) setIframeBlocked(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [iframeLoaded]);

  return (
    <div className="glass-pane relative overflow-hidden rounded-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--rule)] bg-[var(--background-elev)] overflow-hidden">
            {fav ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fav}
                alt=""
                className="h-4 w-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Globe className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.75} />
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--accent)]">
              Resource
            </span>
            <span className="truncate font-display text-[14px] text-[var(--foreground)]">
              {data.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--foreground-muted)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--accent)]"
            aria-label="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
          </a>
          {onDismiss && (
            <button
              onClick={() => onDismiss(paneId)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--foreground-faint)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--foreground)]"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Iframe / fallback */}
      <div className="relative mx-3 mb-3 overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--background-elev)]">
        {!iframeBlocked ? (
          <div className="relative h-[260px] w-full">
            <iframe
              src={data.url}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              referrerPolicy="no-referrer"
              loading="lazy"
              onLoad={() => setIframeLoaded(true)}
              onError={() => setIframeBlocked(true)}
              className="h-full w-full bg-white"
              title={data.label}
            />
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--background-elev)]">
                <div className="flex flex-col items-center gap-2">
                  <div className="skeleton h-2 w-32 rounded" />
                  <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--foreground-faint)]">
                    Loading…
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-[200px] w-full flex-col items-center justify-center gap-3 p-6 transition-colors hover:bg-[rgba(0,0,0,0.02)]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--rule)] bg-[var(--background-elev)]">
              {fav ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fav} alt="" className="h-7 w-7" />
              ) : (
                <Globe className="h-6 w-6 text-[var(--accent)]" strokeWidth={1.5} />
              )}
            </div>
            <div className="text-center">
              <div className="font-display text-[15px] text-[var(--foreground)]">
                {data.label}
              </div>
              <div className="mt-1 truncate max-w-[320px] font-mono text-[10px] text-[var(--foreground-faint)]">
                {data.url}
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.28em] text-[var(--accent)] group-hover:border-[var(--accent)]/60">
              <ExternalLink className="h-3 w-3" strokeWidth={2} />
              Click to open
            </div>
          </a>
        )}
      </div>

      {/* Why */}
      {data.why && (
        <div className="px-4 pb-4">
          <p className="font-display italic text-[13px] leading-relaxed text-[var(--foreground-muted)] border-l-2 border-[var(--accent)]/60 pl-3">
            {data.why}
          </p>
        </div>
      )}
    </div>
  );
}
