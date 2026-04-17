"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  StatutePaneCard,
  type Pane,
  type SeeAlsoItem,
} from "./GlassPaneStack";
import { NewsTickerPane } from "./panes/NewsTickerPane";
import { ArticleSpotlightPane } from "./panes/ArticleSpotlightPane";
import { StockCardPane } from "./panes/StockCardPane";
import { HillIntelPane } from "./panes/HillIntelPane";

/**
 * Renders the currently "in focus" pane at the center of the screen,
 * scaled up, while Harvey is speaking about it. Fades out when the
 * active turn ends, returning focus to the side stacks.
 *
 * The same pane still exists in the left/right stack (filtered out
 * via GlassPaneStack's `hideId` prop so we don't double-render).
 */

interface Props {
  pane: Pane | null;
  onDismiss?: (id: string) => void;
  onSeeAlsoClick?: (item: SeeAlsoItem) => void;
}

// Center stage width by pane kind — a bit roomier than the side stacks.
function widthFor(pane: Pane): number {
  switch (pane.kind) {
    case "statute":
      return 480;
    case "news_ticker":
      return 460;
    case "article_spotlight":
      return 480;
    case "stock_card":
      return 380;
    case "hill_intel":
      return 380;
    default:
      return 420;
  }
}

export function Spotlight({ pane, onDismiss, onSeeAlsoClick }: Props) {
  return (
    <AnimatePresence mode="wait">
      {pane && (
        <motion.div
          key={pane.id}
          initial={{ opacity: 0, scale: 0.94, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -10 }}
          transition={{ duration: 0.48, ease: [0.19, 1, 0.22, 1] }}
          className="pointer-events-none fixed inset-0 z-[32] flex items-center justify-center px-6"
        >
          <div
            className="pointer-events-auto"
            style={{ width: widthFor(pane) }}
          >
            <SpotlightContent
              pane={pane}
              onDismiss={onDismiss}
              onSeeAlsoClick={onSeeAlsoClick}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SpotlightContent({
  pane,
  onDismiss,
  onSeeAlsoClick,
}: {
  pane: Pane;
  onDismiss?: (id: string) => void;
  onSeeAlsoClick?: (item: SeeAlsoItem) => void;
}) {
  switch (pane.kind) {
    case "statute":
      return (
        <StatutePaneCard
          pane={pane}
          onDismiss={onDismiss}
          onSeeAlsoClick={onSeeAlsoClick}
        />
      );
    case "news_ticker":
      return (
        <NewsTickerPane data={pane.data} paneId={pane.id} onDismiss={onDismiss} />
      );
    case "article_spotlight":
      return (
        <ArticleSpotlightPane
          data={pane.data}
          paneId={pane.id}
          onDismiss={onDismiss}
        />
      );
    case "stock_card":
      return (
        <StockCardPane
          data={pane.data}
          paneId={pane.id}
          onDismiss={onDismiss}
        />
      );
    case "hill_intel":
      return (
        <HillIntelPane
          data={pane.data}
          paneId={pane.id}
          onDismiss={onDismiss}
        />
      );
    default:
      return null;
  }
}
