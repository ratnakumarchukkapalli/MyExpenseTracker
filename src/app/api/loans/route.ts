import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { LoanSchema } from "@/lib/schemas/loan";
import { after } from "next/server";
import { NextRequest } from "next/server";

// GET /api/loans — auto-deactivates expired loans in background, returns current data
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const cutoff = new Date();
  cutoff.setDate(1);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Run deactivation in background — don't block the read
  after(async () => {
    await supabase
      .from("loans")
      .update({ status: "inactive" })
      .eq("user_id", user.id)
      .eq("status", "active")
      .lt("end_date", cutoffStr)
      .not("end_date", "is", null);
  });


  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonthStart = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const [{ data, error: dbError }, paidRes] = await Promise.all([
    supabase
      .from("loans")
      .select("*")
      .eq("user_id", user.id)
      .order("due_day"),
    // EMI expenses this month act as the payment record (see /api/loans/[id]/pay)
    supabase
      .from("expenses")
      .select("description")
      .eq("user_id", user.id)
      .like("description", "Loan EMI: %")
      .gte("date", monthStart)
      .lt("date", nextMonthStart),
  ]);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  const paidDescriptions = new Set((paidRes.data ?? []).map((e) => e.description));
  const loans = (data ?? []).map((l) => ({
    ...l,
    paid_this_month: paidDescriptions.has(`Loan EMI: ${l.name}`),
  }));

  return Response.json(loans, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}

// POST /api/loans
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = LoanSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const insertData = {
    ...parsed.data,
    user_id: user.id,
    start_date: parsed.data.start_date ?? new Date().toISOString().split("T")[0],
  };

  const { data, error: dbError } = await supabase
    .from("loans")
    .insert(insertData)
    .select()
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ id: data.id }, { status: 201 });
}
