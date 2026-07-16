import { requireAuth } from "@/lib/auth-guard";
import { CreditCardPaySchema } from "@/lib/schemas/credit-card";
import { updateMonthlyExpenseTotal, cascadeUpdateFutureMonths } from "@/lib/monthly-totals";
import { adjustBankAccountBalance } from "@/lib/bank-accounts";
import { after, NextRequest } from "next/server";

// POST /api/credit-cards/[id]/pay — pay down the card from the bank, log the expense
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const cardId = Number(id);

  const body = await request.json().catch(() => null);
  const parsed = CreditCardPaySchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: card } = await supabase
    .from("credit_cards")
    .select("name, current_balance")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .single();

  if (!card) return Response.json({ error: "Not found" }, { status: 404 });

  const amount = parsed.data.amount;
  const now = new Date();
  const paidDate = now.toISOString().split("T")[0];
  const paidMonth = now.getMonth() + 1;
  const paidYear = now.getFullYear();

  const { error: insertError } = await supabase.from("expenses").insert({
    user_id: user.id,
    amount,
    date: paidDate,
    description: `Credit Card Payment: ${card.name}`,
    category: "LOANS/CC",
    note: "Paid via credit card tracker",
    payment_source: "bank",
    bank_account_id: parsed.data.bank_account_id ?? null,
  });

  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  if (parsed.data.bank_account_id) {
    await adjustBankAccountBalance(supabase, user.id, parsed.data.bank_account_id, -amount);
  }

  const newBalance = Math.max(0, Number(card.current_balance) - amount);
  const { error: cardUpdateError } = await supabase
    .from("credit_cards")
    .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
    .eq("id", cardId)
    .eq("user_id", user.id);

  if (cardUpdateError) return Response.json({ error: cardUpdateError.message }, { status: 500 });

  // Update monthly summary so the cash balance reflects this payment
  const updatedSummary = await updateMonthlyExpenseTotal(supabase, user.id, paidMonth, paidYear);

  after(async () => {
    await cascadeUpdateFutureMonths(supabase, user.id, paidMonth, paidYear, {
      remaining_amount: Number(updatedSummary?.remaining_amount ?? 0),
      savings_fd: Number(updatedSummary?.savings_fd ?? 0),
      savings_sip: Number(updatedSummary?.savings_sip ?? 0),
      savings_shares: Number(updatedSummary?.savings_shares ?? 0),
      savings_nps: Number(updatedSummary?.savings_nps ?? 0),
      savings_pf: Number(updatedSummary?.savings_pf ?? 0),
    });
  });

  return Response.json({ paid_date: paidDate, new_balance: newBalance }, { status: 201 });
}
