import type { SupabaseClient } from "@supabase/supabase-js";

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
