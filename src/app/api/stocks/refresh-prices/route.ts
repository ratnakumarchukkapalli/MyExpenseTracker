import { requireAuth } from "@/lib/auth-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncStocksToMonthlySummary } from "@/lib/sync-portfolio";
import { after } from "next/server";

const PYTHON_API = "http://127.0.0.1:8765";

import { unstable_cache, revalidateTag } from "next/cache";

async function fetchStockPrice(ticker: string) {
  const res = await fetch(`${PYTHON_API}/stocks/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const price = data?.price ?? data?.current_price ?? null;
  return (price != null && !isNaN(price)) ? price : null;
}

const getCachedQuote = unstable_cache(
  async (ticker: string) => fetchStockPrice(ticker),
  ['stock-quotes'],
  { revalidate: 3600 }
);

// POST /api/stocks/refresh-prices
// Fetches all holdings, calls Python API for each, updates prices
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

  // Fetch all prices in parallel - BYPASS CACHE during manual refresh
  const priceResults = await Promise.all(
    holdings.map(async (h) => {
      try {
        const price = await fetchStockPrice(h.ticker);
        if (price != null) {
          return { id: h.id, ticker: h.ticker, price, success: true };
        } else {
          return { id: h.id, ticker: h.ticker, price: null, success: false, error: "No price in response" };
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { id: h.id, ticker: h.ticker, price: null, success: false, error: msg };
      }
    })
  );

  // Collect successful updates and fire ALL DB writes in parallel
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

  // Sync stock portfolio value to monthly_summary in background
  after(async () => {
    const client = await createSupabaseServerClient();
    await syncStocksToMonthlySummary(client, user.id);
  });


  // Purge the stock-quotes cache so other components (like dashboard) see fresh data
  revalidateTag('stock-quotes');

  return Response.json({ results, updatedCount: successfulUpdates.length });
}
