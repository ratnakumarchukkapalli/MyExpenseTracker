/**
 * One-time backfill: records the 2026-07-28 Laurus Labs sale in stock_sales +
 * stock_sale_allocations, for a sale whose money movement was already applied
 * by hand (scripts/record_laurus_sale_manual.ts removed the holding; the Kotak
 * credit was entered through the bank-accounts UI).
 *
 * Deliberately writes the rows directly instead of calling POST /api/stocks/sell:
 * that route would credit the bank a SECOND time and re-run the cascade. This is
 * a history repair, not a sale. Nothing here touches bank_accounts, sip_funds or
 * monthly_summary.
 *
 * last_price is 1784.00, the current_price the holding actually carried when it
 * was removed — savings_shares fell by 100 x 1784, so that is the figure the
 * net-worth delta has to be measured against, not the 1758.90 from the day before.
 *
 * The resulting row is a valid undo target: reverting it debits Kotak by the
 * net proceeds and restores 100 shares @ 992.70. Only do that after the Kotak
 * credit has been entered, or the debit runs against a balance that never
 * received it.
 *
 * Usage: npx tsx scripts/backfill_laurus_sale.ts
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

const SALE = {
  ticker: "LAURUSLABS",
  company_name: "Laurus Labs",
  shares_sold: 100,
  sell_price: 1757.1,
  sell_date: "2026-07-28",
  avg_buy_price: 992.7,
  last_price: 1784.0,
  broker: "Groww",
  notes: "Backfilled: money movement applied manually before 021_stock_sales.sql was run.",
};
const NET_CREDITED = 175480.48; // what actually landed in Kotak
const BANK_NAME = "Kotak";

async function run() {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const userId = env.ADMIN_USER_ID;

  const { data: existing } = await supabase
    .from("stock_sales")
    .select("id")
    .eq("user_id", userId)
    .eq("ticker", SALE.ticker)
    .eq("sell_date", SALE.sell_date)
    .maybeSingle();

  if (existing) {
    console.log(`Sale already recorded (id ${existing.id}) — nothing to do.`);
    return;
  }

  const { data: bank } = await supabase
    .from("bank_accounts")
    .select("id, name")
    .eq("user_id", userId)
    .eq("name", BANK_NAME)
    .maybeSingle();

  if (!bank) throw new Error(`Bank account "${BANK_NAME}" not found`);

  const gross_proceeds = SALE.shares_sold * SALE.sell_price;
  const charges = Number((gross_proceeds - NET_CREDITED).toFixed(2));
  const realized_pnl = Number(
    ((SALE.sell_price - SALE.avg_buy_price) * SALE.shares_sold - charges).toFixed(2)
  );

  const { data: sale, error } = await supabase
    .from("stock_sales")
    .insert({
      user_id: userId,
      holding_id: null, // holding was fully sold and removed
      ...SALE,
      gross_proceeds,
      charges,
      net_proceeds: NET_CREDITED,
      realized_pnl,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { error: allocError } = await supabase.from("stock_sale_allocations").insert({
    user_id: userId,
    sale_id: sale.id,
    destination: "bank",
    bank_account_id: bank.id,
    amount: NET_CREDITED,
  });

  if (allocError) throw new Error(allocError.message);

  console.log(`Recorded sale ${sale.id}: ${SALE.shares_sold} ${SALE.ticker} @ ${SALE.sell_price}`);
  console.log(`  gross        ${gross_proceeds.toFixed(2)}`);
  console.log(`  charges      ${charges.toFixed(2)}`);
  console.log(`  net proceeds ${NET_CREDITED.toFixed(2)}  → ${bank.name}`);
  console.log(`  realized P&L ${realized_pnl.toFixed(2)}  (reporting only — not added to net worth)`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
