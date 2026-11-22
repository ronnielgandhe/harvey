import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 5;
const GLOBAL = 60;
const BRAINS = new Set(["opus", "sonnet", "haiku"]);
const hits = new Map<string, number[]>();
let globalHits: number[] = [];

function allow(ip: string): boolean {
  const now = Date.now();
  const fresh = (list: number[]) => list.filter((t) => now - t < WINDOW_MS);
  globalHits = fresh(globalHits);
  const mine = fresh(hits.get(ip) ?? []);
  if (mine.length >= PER_IP || globalHits.length >= GLOBAL) {
    hits.set(ip, mine);
    return false;
  }
  mine.push(now);
  globalHits.push(now);
  hits.set(ip, mine);
  if (hits.size > 5000) hits.clear();
  return true;
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json(
      {
        error:
          "LiveKit env vars missing. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and NEXT_PUBLIC_LIVEKIT_URL.",
      },
      { status: 500 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) {
    return NextResponse.json(
      { error: "too many calls from here. give it a few minutes." },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  }

  const roomName = `harvey-room-${Date.now()}`;
  const identity = `client-${Math.random().toString(36).slice(2, 10)}`;

  const requested = req.nextUrl.searchParams.get("brain") ?? "";
  const brain = BRAINS.has(requested) ? requested : "opus";

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: 60 * 10,
    attributes: { "harvey.brain": brain },
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return NextResponse.json({ token, url, roomName, identity });
}
