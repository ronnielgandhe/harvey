import { NextResponse } from "next/server";

/**
 * GET /api/headline
 * Server-side proxy to Google News RSS for a single Canadian
 * legal-news headline. Returns the most recent story title + source.
 *
 * This runs on Vercel's edge / Node runtime — no CORS issue, no key,
 * cached for 5 minutes so we don't hammer the RSS feed on every
 * landing render.
 */

export const revalidate = 300; // 5 min

const FEED_URL =
  "https://news.google.com/rss/search?q=canada+law+OR+courts&hl=en-CA&gl=CA&ceid=CA:en";

function parseFirstItem(xml: string): {
  title?: string;
  source?: string;
  link?: string;
  pubDate?: string;
} {
  const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
  if (!itemMatch) return {};
  const item = itemMatch[1];
  const pick = (tag: string) => {
    // Handle both plain tags and CDATA
    const cdata = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, "i");
    const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const m = item.match(cdata) || item.match(plain);
    return m ? m[1].trim() : undefined;
  };
  return {
    title: pick("title"),
    source: pick("source"),
    link: pick("link"),
    pubDate: pick("pubDate"),
  };
}

export async function GET() {
  try {
    const res = await fetch(FEED_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HarveyCounsel/1.0; +https://harvey.vercel.app)",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `feed returned ${res.status}` },
        { status: 502 },
      );
    }
    const xml = await res.text();
    const item = parseFirstItem(xml);
    if (!item.title) {
      return NextResponse.json({ error: "no_items" }, { status: 502 });
    }
    return NextResponse.json({
      title: item.title,
      source: item.source ?? "",
      link: item.link ?? "",
      pubDate: item.pubDate ?? "",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "fetch_failed", detail: String(err) },
      { status: 500 },
    );
  }
}
