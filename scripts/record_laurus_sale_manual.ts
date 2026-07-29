/**
 * One-time: 100 LAURUSLABS sold on 2026-07-28 @ Rs 1,757.10 (avg buy Rs 992.70),
 * Rs 1,75,480.48 credited to Kotak. Applied manually because scripts/021_stock_sales.sql
 * had not been run yet, so the proper sell route was unavailable.
 *
 * This half only removes the holding and re-snapshots the portfolio. The Kotak
 * credit is applied separately through the bank-accounts UI, which fires
 * resyncCurrentMonthCascade — the second half of the same sequential cascade
 * the sell route performs internally (snapshot first, bank resync second).
 *
 * Uses the app's own syncMonthlyWealthSnapshot rather than a hand-derived
 * savings_shares figure, so the value and the 24-month cascade stay consistent
 * with every other write path.
 *
 * Usage: npx tsx scripts/record_laurus_sale_manual.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { syncMonthlyWealthSnapshot } from "../src/lib/monthly-totals";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const TICKER = "LAURUSLABS";
const SHARES_SOLD = 100;
const MONTH = 8;
const YEAR = 2026;

async function run() {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const userId = env.ADMIN_USER_ID;

  const { data: holding } = await supabase
    .from("stock_holdings")
    .select("id, ticker, shares, buy_price, current_price")
    .eq("user_id", userId)
    .eq("ticker", TICKER)
    .maybeSingle();

  if (!holding) {
    console.log(`${TICKER} holding not found — already applied?`);
    return;
  }

  console.log(
    `Found ${holding.ticker}: ${holding.shares} shares @ buy ${holding.buy_price}, ` +
      `last price ${holding.current_price} (= ${(holding.shares * holding.current_price).toFixed(2)} in savings_shares)`
  );

  if (Number(holding.shares) !== SHARES_SOLD) {
    console.error(
      `Expected ${SHARES_SOLD} shares, found ${holding.shares}. Aborting rather than guessing.`
    );
    process.exit(1);
  }

  await supabase
    .from("stock_holdings")
    .delete()
    .eq("user_id", userId)
    .eq("id", holding.id);
  console.log("Holding removed.");

  await syncMonthlyWealthSnapshot(supabase, userId, MONTH, YEAR);
  console.log(`Portfolio re-snapshotted for ${MONTH}/${YEAR} and cascaded forward.`);

  const { data: row } = await supabase
    .from("monthly_summary")
    .select("remaining_amount, savings_sip, savings_shares, cash_equivalents")
    .eq("user_id", userId)
    .eq("month", MONTH)
    .eq("year", YEAR)
    .single();

  console.log("\nAfter:");
  console.log("  savings_shares  :", row?.savings_shares);
  console.log("  savings_sip     :", row?.savings_sip);
  console.log("  remaining_amount:", row?.remaining_amount, "(unchanged — Kotak credit still pending)");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
