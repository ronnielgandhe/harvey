import { NextResponse } from "next/server";

/**
 * GET /api/newsfeed
 * Server-side proxy to Google News RSS, returning the top N Canadian
 * legal/courts headlines. Powers the pre-roll marquee on the landing
 * page (thin scrolling wire-service ticker at the bottom).
 *
 * Cached for 5 minutes so a fast refresh doesn't hammer the feed.
 */

export const revalidate = 300;

const FEED_URL =
  "https://news.google.com/rss/search?q=canada+law+OR+courts+OR+supreme+court&hl=en-CA&gl=CA&ceid=CA:en";

interface Item {
  title: string;
  source: string;
  link: string;
  pubDate: string;
}

function parseItems(xml: string, limit: number): Item[] {
  const items: Item[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null && items.length < limit) {
    const chunk = m[1];
    const pick = (tag: string) => {
      const cdata = new RegExp(
        `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`,
        "i",
      );
      const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
      const mm = chunk.match(cdata) || chunk.match(plain);
      return mm ? mm[1].trim() : "";
    };
    items.push({
      title: pick("title"),
      source: pick("source"),
      link: pick("link"),
      pubDate: pick("pubDate"),
    });
  }
  return items;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(
    20,
    Math.max(1, parseInt(searchParams.get("count") || "10", 10) || 10),
  );
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
        { error: `feed returned ${res.status}`, items: [] },
        { status: 502 },
      );
    }
    const xml = await res.text();
    const items = parseItems(xml, count).filter((i) => i.title);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: "fetch_failed", detail: String(err), items: [] },
      { status: 500 },
    );
  }
}
