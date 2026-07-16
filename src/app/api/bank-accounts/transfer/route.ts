import { requireAuth } from "@/lib/auth-guard";
import { BankAccountTransferSchema } from "@/lib/schemas/bank-account";
import { adjustBankAccountBalance } from "@/lib/bank-accounts";
import { NextRequest } from "next/server";

// POST /api/bank-accounts/transfer — move money between two of the user's own
// accounts. Not an expense: total Liquid Cash is unchanged, only the split moves.
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = BankAccountTransferSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { from_account_id, to_account_id, amount } = parsed.data;

  const { data: accounts } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("user_id", user.id)
    .in("id", [from_account_id, to_account_id]);

  if (!accounts || accounts.length !== 2) {
    return Response.json({ error: "One or both accounts not found" }, { status: 404 });
  }

  await Promise.all([
    adjustBankAccountBalance(supabase, user.id, from_account_id, -amount),
    adjustBankAccountBalance(supabase, user.id, to_account_id, amount),
  ]);

  return Response.json({ success: true }, { status: 201 });
}
