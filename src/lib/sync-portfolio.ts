import { SupabaseClient } from "@supabase/supabase-js";

// Recalculates total stock portfolio value (sum of shares * current_price)
// and writes it to monthly_summary.savings_shares for the current month.
export async function syncStocksToMonthlySummary(supabase: SupabaseClient, userId: string) {
  const { data: holdings } = await supabase
    .from("stock_holdings")
    .select("shares, current_price")
    .eq("user_id", userId);

  if (!holdings?.length) return;

  const total = holdings.reduce(
    (sum, h) => sum + (Number(h.shares || 0) * Number(h.current_price || 0)),
    0
  );
  const now = new Date();
  await supabase
    .from("monthly_summary")
    .update({ savings_shares: total })
    .eq("user_id", userId)
    .eq("month", now.getMonth() + 1)
    .eq("year", now.getFullYear());
}

// Recalculates total SIP portfolio value (sum of units * current_nav)
// and writes it to monthly_summary.savings_sip for the current month.
export async function syncSIPToMonthlySummary(supabase: SupabaseClient, userId: string) {
  const { data: funds } = await supabase
    .from("sip_funds")
    .select("units, current_nav")
    .eq("user_id", userId);

  if (!funds?.length) return;

  const total = funds.reduce(
    (sum, f) => sum + (Number(f.units || 0) * Number(f.current_nav || 0)),
    0
  );
  const now = new Date();
  await supabase
    .from("monthly_summary")
    .update({ savings_sip: total })
    .eq("user_id", userId)
    .eq("month", now.getMonth() + 1)
    .eq("year", now.getFullYear());
}
