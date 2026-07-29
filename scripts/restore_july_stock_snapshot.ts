/**
 * Restores July 2026's savings_shares, which POST /api/stocks/refresh-prices
 * overwrote with today's live post-sale portfolio.
 *
 * Cause: syncStocksToMonthlySummary defaulted to the CALENDAR month when the
 * caller passed none. On 29 Jul 2026 the calendar said July while the active
 * budget month was August, so a price refresh wrote live values into closed
 * July — after Laurus Labs had been sold. July lost a position it still held at
 * its close and its net worth read ~1.76L low. Fixed in src/lib/sync-portfolio.ts
 * (defaults to getActiveBudgetMonth now); this repairs the row it damaged.
 *
 *   200479.90  live value of the 3 surviving holdings
 * + 178400.00  Laurus Labs, 100 @ 1784.00 (stock_sales.last_price, the price it
 *              carried when removed — the same figure that left savings_shares)
 *   ---------
 *   378879.90
 *
 * Deliberately does NOT cascade. cascadeUpdateFutureMonths propagates
 * savings_sip/savings_shares unconditionally to later months, so cascading from
 * July would push the restored figure into August and re-add the sold holding
 * to the live month. Only July's own row and its cash_equivalents are touched.
 *
 * savings_sip is left alone: it was overwritten too, but no SIP transaction fell
 * between July's close and the overwrite, so the live figure is within a few
 * days of correct and there is no better source to restore from.
 *
 * Usage: npx tsx scripts/restore_july_stock_snapshot.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const MONTH = 7;
const YEAR = 2026;

async function run() {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const userId = env.ADMIN_USER_ID;

  const { data: row } = await supabase
    .from("monthly_summary")
    .select("id, remaining_amount, savings_fd, savings_sip, savings_shares, savings_nps, savings_pf")
    .eq("user_id", userId)
    .eq("month", MONTH)
    .eq("year", YEAR)
    .single();

  if (!row) throw new Error(`No monthly_summary row for ${MONTH}/${YEAR}`);

  const { data: sale } = await supabase
    .from("stock_sales")
    .select("ticker, shares_sold, last_price")
    .eq("user_id", userId)
    .eq("sell_date", "2026-07-28")
    .is("reverted_at", null)
    .single();

  if (!sale?.last_price) throw new Error("Sale row missing last_price — cannot reconstruct");

  const soldValue = Number(sale.shares_sold) * Number(sale.last_price);
  const restoredShares = Number(row.savings_shares) + soldValue;
  const cash_equivalents =
    Number(row.remaining_amount) + Number(row.savings_fd) + Number(row.savings_sip) + restoredShares;

  console.log(`savings_shares ${row.savings_shares} + ${sale.ticker} ${soldValue.toFixed(2)} = ${restoredShares.toFixed(2)}`);

  const { error } = await supabase
    .from("monthly_summary")
    .update({
      savings_shares: restoredShares,
      cash_equivalents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) throw new Error(error.message);

  const KEYS = ["remaining_amount", "savings_fd", "savings_sip", "savings_shares", "savings_nps", "savings_pf"];
  const { data: months } = await supabase
    .from("monthly_summary")
    .select("*")
    .eq("user_id", userId)
    .eq("year", YEAR)
    .in("month", [6, 7, 8])
    .order("month");

  console.log("\nmonth   savings_shares    net worth        MoM");
  let prev: number | null = null;
  for (const r of months ?? []) {
    const nw = KEYS.reduce((s, k) => s + Number(r[k] || 0), 0);
    console.log(
      `${YEAR}-${String(r.month).padStart(2, "0")}  ${Number(r.savings_shares).toFixed(2).padStart(12)}  ` +
        `${nw.toFixed(2).padStart(12)}  ${prev === null ? "" : (nw - prev).toFixed(2).padStart(12)}`
    );
    prev = nw;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
