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
    .select("amount, billing_type, renewal_date, name, category, last_paid_date")
    .eq("id", subId)
    .eq("user_id", user.id)
    .single();

  if (!sub) return Response.json({ error: "Not found" }, { status: 404 });

  const paidDate = new Date().toISOString().split("T")[0];

  // Prevent duplicate payments on the same day
  if (sub.last_paid_date === paidDate) {
    return Response.json({ error: "Subscription already marked as paid today" }, { status: 400 });
  }
  
  // Calculate next renewal date
  let nextRenewal = sub.renewal_date;
  if (sub.renewal_date) {
    const d = new Date(sub.renewal_date);
    if (sub.billing_type === "monthly") {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setFullYear(d.getFullYear() + 1);
    }
    nextRenewal = d.toISOString().split("T")[0];
  }

  // 1. Insert payment record
  // 2. Update subscription status
  // 3. Create an expense record (so it's deducted from balance)
  const [payResult, updateResult, expenseRes] = await Promise.all([
    supabase
      .from("subscription_payments")
      .insert({ subscription_id: subId, user_id: user.id, amount: sub.amount, paid_date: paidDate })
      .select()
      .single(),
    supabase
      .from("subscriptions")
      .update({ 
        last_paid_date: paidDate,
        renewal_date: nextRenewal 
      })
      .eq("id", subId)
      .eq("user_id", user.id),
    supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        amount: sub.amount,
        date: paidDate,
        description: `Subscription: ${sub.name}`,
        category: sub.category || "Bills",
        note: `Paid via subscription tracker`
      })
  ]);

  if (payResult.error) return Response.json({ error: payResult.error.message }, { status: 500 });
  if (updateResult.error) return Response.json({ error: updateResult.error.message }, { status: 500 });

  return Response.json({ 
    id: payResult.data.id, 
    paid_date: paidDate,
    next_renewal: nextRenewal
  }, { status: 201 });
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
