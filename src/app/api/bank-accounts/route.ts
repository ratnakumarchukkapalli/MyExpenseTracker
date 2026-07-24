import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { BankAccountSchema } from "@/lib/schemas/bank-account";
import { resyncCurrentMonthCascade } from "@/lib/bank-accounts";
import { after, NextRequest } from "next/server";

// GET /api/bank-accounts
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  return Response.json(data ?? [], {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}

// POST /api/bank-accounts
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = BankAccountSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.is_salary_account) {
    await supabase
      .from("bank_accounts")
      .update({ is_salary_account: false })
      .eq("user_id", user.id)
      .eq("is_salary_account", true);
  }

  const { data, error: dbError } = await supabase
    .from("bank_accounts")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  after(() => resyncCurrentMonthCascade(supabase, user.id));

  return Response.json(data, { status: 201 });
}
