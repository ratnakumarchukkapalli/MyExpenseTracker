import { requireAuth } from "@/lib/auth-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncStocksToMonthlySummary } from "@/lib/sync-portfolio";
import { after } from "next/server";

// Yahoo Finance unofficial API — no key needed, works on Vercel
// Mirrors the yfinance fallback in Electron app's api/main.py
async function fetchStockPrice(ticker: string): Promise<number | null> {
  for (const suffix of [".NS", ".BO"]) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}${suffix}?interval=1d&range=1d`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const price: number | undefined = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price && price > 0) return price;
    } catch {
      continue;
    }
  }
  return null;
}

// POST /api/stocks/refresh-prices
export async function POST() {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { data: holdings, error: dbError } = await supabase
    .from("stock_holdings")
    .select("id, ticker")
    .eq("user_id", user.id);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  if (!holdings?.length) return Response.json({ results: [], updatedCount: 0 });

  const today = new Date().toISOString().split("T")[0];

  const priceResults = await Promise.all(
    holdings.map(async (h) => {
      try {
        const price = await fetchStockPrice(h.ticker);
        if (price != null) {
          return { id: h.id, ticker: h.ticker, price, success: true };
        }
        return { id: h.id, ticker: h.ticker, price: null, success: false, error: "No price returned" };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { id: h.id, ticker: h.ticker, price: null, success: false, error: msg };
      }
    })
  );

  const successfulUpdates = priceResults.filter((r) => r.success && r.price != null);
  const results = priceResults.map(({ ticker, price, success, error: err }) => ({
    ticker, price, success, ...(err ? { error: err } : {}),
  }));

  if (successfulUpdates.length > 0) {
    await Promise.all(
      successfulUpdates.map((r) =>
        supabase
          .from("stock_holdings")
          .update({ current_price: r.price, last_updated: today })
          .eq("user_id", user.id)
          .eq("id", r.id)
      )
    );
  }

  after(async () => {
    const client = await createSupabaseServerClient();
    await syncStocksToMonthlySummary(client, user.id);
  });

  return Response.json({ results, updatedCount: successfulUpdates.length });
}
