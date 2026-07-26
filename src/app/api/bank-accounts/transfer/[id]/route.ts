import { requireAuth } from "@/lib/auth-guard";
import { adjustBankAccountBalance, resyncCurrentMonthCascade } from "@/lib/bank-accounts";
import { after, NextRequest } from "next/server";

type P = { params: Promise<{ id: string }> };

// DELETE /api/bank-accounts/transfer/[id] — undo a transfer by reversing the
// balance move and marking it reverted (kept, not deleted, as an audit trail).
export async function DELETE(_req: NextRequest, { params }: P) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const { data: transfer } = await supabase
    .from("bank_transfers")
    .select("id, from_account_id, to_account_id, amount, reverted_at")
    .eq("id", Number(id))
    .eq("user_id", user.id)
    .maybeSingle();

  if (!transfer) return Response.json({ error: "Not found" }, { status: 404 });
  if (transfer.reverted_at) return Response.json({ error: "Already reverted" }, { status: 400 });

  const amount = Number(transfer.amount);
  await Promise.all([
    adjustBankAccountBalance(supabase, user.id, transfer.from_account_id, amount),
    adjustBankAccountBalance(supabase, user.id, transfer.to_account_id, -amount),
  ]);

  const { error: updateError } = await supabase
    .from("bank_transfers")
    .update({ reverted_at: new Date().toISOString() })
    .eq("id", transfer.id)
    .eq("user_id", user.id);
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  after(() => resyncCurrentMonthCascade(supabase, user.id));

  return Response.json({ success: true });
}
