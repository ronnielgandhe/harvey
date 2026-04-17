import { NextResponse } from "next/server";

/**
 * GET /api/stock?ticker=NVDA
 * Server-side proxy to Yahoo Finance's public chart endpoint. Same
 * payload shape the LiveKit data channel emits for `stock_card` —
 * lets the frontend pull a real quote without waiting on a live call.
 *
 * Not cached — we want fresh prices when the preview page is opened.
 */

export const dynamic = "force-dynamic";

interface StockResponse {
  symbol?: string;
  shortName?: string;
  currency?: string;
  price?: number;
  previousClose?: number;
  change?: number;
  changePct?: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  exchange?: string;
  closes?: number[];
  error?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get("ticker") || "NVDA").toUpperCase();
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(ticker) +
    "?interval=1d&range=1mo";

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (HarveyPreview/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json<StockResponse>(
        { error: `yahoo ${res.status}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return NextResponse.json<StockResponse>(
        { error: "no_result" },
        { status: 502 },
      );
    }
    const meta = result.meta || {};
    const price = meta.regularMarketPrice;
    const prev = meta.previousClose ?? meta.chartPreviousClose;
    if (typeof price !== "number" || typeof prev !== "number") {
      return NextResponse.json<StockResponse>(
        { error: "missing_price" },
        { status: 502 },
      );
    }
    const change = price - prev;
    const changePct = prev ? (change / prev) * 100 : 0;
    const rawCloses: unknown[] =
      result?.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses
      .map((n) => (typeof n === "number" ? n : Number(n)))
      .filter((n) => Number.isFinite(n))
      .map((n) => Math.round(n * 100) / 100);

    return NextResponse.json<StockResponse>({
      symbol: meta.symbol ?? ticker,
      shortName: meta.shortName ?? meta.longName ?? ticker,
      currency: meta.currency ?? "USD",
      price: Math.round(price * 100) / 100,
      previousClose: Math.round(prev * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      exchange: meta.exchangeName ?? meta.fullExchangeName,
      closes,
    });
  } catch (err) {
    return NextResponse.json<StockResponse>(
      { error: `fetch_failed: ${String(err)}` },
      { status: 500 },
    );
  }
}
