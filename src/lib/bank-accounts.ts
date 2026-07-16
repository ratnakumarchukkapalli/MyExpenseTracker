import type { SupabaseClient } from "@supabase/supabase-js";
import { updateMonthlyExpenseTotal, cascadeUpdateFutureMonths } from "./monthly-totals";

/**
 * Adjusts a bank account's running balance by `delta` (negative for a
 * charge, positive to reverse one). No-ops silently if the account doesn't
 * belong to the user — callers pass IDs from trusted rows.
 */
export async function adjustBankAccountBalance(
  supabase: SupabaseClient,
  userId: string,
  accountId: number,
  delta: number
) {
  const { data: account } = await supabase
    .from("bank_accounts")
    .select("current_balance")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!account) return;

  await supabase
    .from("bank_accounts")
    .update({
      current_balance: Number(account.current_balance) + delta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("user_id", userId);
}

/**
 * Re-runs the current month's cascade so a bank-account change that isn't
 * itself an expense (manual balance edit, create, delete, transfer) still
 * propagates into future months' Carryover — cascadeUpdateFutureMonths
 * substitutes the live bank-account sum whenever it's cascading from the
 * real current calendar month, so this just needs to trigger from "today".
 */
export async function resyncCurrentMonthCascade(supabase: SupabaseClient, userId: string) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const updatedSummary = await updateMonthlyExpenseTotal(supabase, userId, month, year);
  await cascadeUpdateFutureMonths(supabase, userId, month, year, {
    remaining_amount: Number(updatedSummary?.remaining_amount ?? 0),
    savings_fd: Number(updatedSummary?.savings_fd ?? 0),
    savings_sip: Number(updatedSummary?.savings_sip ?? 0),
    savings_shares: Number(updatedSummary?.savings_shares ?? 0),
    savings_nps: Number(updatedSummary?.savings_nps ?? 0),
    savings_pf: Number(updatedSummary?.savings_pf ?? 0),
  });
}
