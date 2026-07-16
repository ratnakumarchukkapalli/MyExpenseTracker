import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Adjusts a credit card's running balance by `delta` (positive to add a
 * charge, negative to remove one or record a payment). No-ops silently if
 * the card doesn't belong to the user — callers pass IDs from trusted rows.
 */
export async function adjustCreditCardBalance(
  supabase: SupabaseClient,
  userId: string,
  cardId: number,
  delta: number
) {
  const { data: card } = await supabase
    .from("credit_cards")
    .select("current_balance")
    .eq("id", cardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!card) return;

  await supabase
    .from("credit_cards")
    .update({
      current_balance: Number(card.current_balance) + delta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .eq("user_id", userId);
}
