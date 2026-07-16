import { requireAuth } from "@/lib/auth-guard";
import { BankAccountUpdateSchema } from "@/lib/schemas/bank-account";
import { resyncCurrentMonthCascade } from "@/lib/bank-accounts";
import { after, NextRequest } from "next/server";

type P = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: P) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = BankAccountUpdateSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { error: dbError } = await supabase
    .from("bank_accounts")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", Number(id))
    .eq("user_id", user.id);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  after(() => resyncCurrentMonthCascade(supabase, user.id));

  return Response.json({ changes: 1 });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const { error: dbError } = await supabase
    .from("bank_accounts")
    .delete()
    .eq("id", Number(id))
    .eq("user_id", user.id);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  after(() => resyncCurrentMonthCascade(supabase, user.id));

  return Response.json({ changes: 1 });
}
