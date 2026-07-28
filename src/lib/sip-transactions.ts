import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Logs a sip_transactions row and rolls its units/amount into the fund's
 * running totals. Extracted from POST /api/sip/transactions so the stock-sale
 * route can route proceeds into a fund through the exact same path — a fund's
 * units and invested_value must only ever move via this helper, or the
 * portfolio total silently drifts from its transaction history.
 *
 * Returns the new sip_transactions.id so callers can record it for undo.
 */
export async function recordSipTransaction(
  supabase: SupabaseClient,
  userId: string,
  input: {
    fundId: number;
    date: string;
    units: number;
    nav: number;
    amount: number;
    type?: string;
  }
): Promise<number> {
  const [txnResult, fundResult] = await Promise.all([
    supabase
      .from("sip_transactions")
      .insert({
        user_id:          userId,
        fund_id:          input.fundId,
        transaction_date: input.date,
        units:            input.units,
        purchase_nav:     input.nav,
        amount:           input.amount,
        transaction_type: input.type ?? "SIP",
      })
      .select("id")
      .single(),
    supabase
      .from("sip_funds")
      .select("units, invested_value")
      .eq("user_id", userId)
      .eq("id", input.fundId)
      .single(),
  ]);

  if (txnResult.error) throw new Error(txnResult.error.message);

  if (fundResult.data) {
    await supabase
      .from("sip_funds")
      .update({
        units:          Number(fundResult.data.units ?? 0) + input.units,
        invested_value: Number(fundResult.data.invested_value ?? 0) + input.amount,
      })
      .eq("user_id", userId)
      .eq("id", input.fundId);
  }

  return txnResult.data.id as number;
}

/**
 * Exact inverse of recordSipTransaction: deletes the transaction row and backs
 * its units/amount out of the fund totals. Reads the units/amount off the
 * stored row rather than recomputing them from the sale, so a NAV change
 * between the sale and the undo can't leave a residue behind.
 *
 * No-ops if the row is already gone or isn't the user's.
 */
export async function reverseSipTransaction(
  supabase: SupabaseClient,
  userId: string,
  transactionId: number
) {
  const { data: txn } = await supabase
    .from("sip_transactions")
    .select("id, fund_id, units, amount")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!txn) return;

  const { data: fund } = await supabase
    .from("sip_funds")
    .select("units, invested_value")
    .eq("user_id", userId)
    .eq("id", txn.fund_id)
    .maybeSingle();

  await supabase
    .from("sip_transactions")
    .delete()
    .eq("id", txn.id)
    .eq("user_id", userId);

  if (fund) {
    await supabase
      .from("sip_funds")
      .update({
        units:          Math.max(0, Number(fund.units ?? 0) - Number(txn.units ?? 0)),
        invested_value: Math.max(0, Number(fund.invested_value ?? 0) - Number(txn.amount ?? 0)),
      })
      .eq("user_id", userId)
      .eq("id", txn.fund_id);
  }
}
