import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

// POST /api/subscriptions/[id]/pay
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const subId = Number(id);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("amount")
    .eq("id", subId)
    .eq("user_id", user.id)
    .single();

  if (!sub) return Response.json({ error: "Not found" }, { status: 404 });

  const paidDate = new Date().toISOString().split("T")[0];

  // Insert payment and update last_paid_date in parallel
  const [payResult] = await Promise.all([
    supabase
      .from("subscription_payments")
      .insert({ subscription_id: subId, user_id: user.id, amount: sub.amount, paid_date: paidDate })
      .select()
      .single(),
    supabase
      .from("subscriptions")
      .update({ last_paid_date: paidDate })
      .eq("id", subId)
      .eq("user_id", user.id),
  ]);

  if (payResult.error) return Response.json({ error: payResult.error.message }, { status: 500 });

  return Response.json({ id: payResult.data.id, paid_date: paidDate }, { status: 201 });
}

// GET /api/subscriptions/[id]/pay — payment history
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const { data, error: dbError } = await supabase
    .from("subscription_payments")
    .select("*")
    .eq("subscription_id", Number(id))
    .eq("user_id", user.id)
    .order("paid_date", { ascending: false });

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? []);
}
