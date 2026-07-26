import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { BankAccountTransferSchema } from "@/lib/schemas/bank-account";
import { adjustBankAccountBalance, resyncCurrentMonthCascade } from "@/lib/bank-accounts";
import { after, NextRequest } from "next/server";

// GET /api/bank-accounts/transfer — recent non-reverted transfers, for the Undo list
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("bank_transfers")
    .select("id, from_account_id, to_account_id, amount, created_at")
    .eq("user_id", user.id)
    .is("reverted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? []);
}

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

  const { data: transfer, error: insertError } = await supabase
    .from("bank_transfers")
    .insert({ user_id: user.id, from_account_id, to_account_id, amount })
    .select("id")
    .single();
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  after(() => resyncCurrentMonthCascade(supabase, user.id));

  return Response.json({ success: true, id: transfer.id }, { status: 201 });
}
