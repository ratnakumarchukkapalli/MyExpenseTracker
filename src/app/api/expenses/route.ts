import { requireAuthFast } from "@/lib/auth-guard";
import { ExpenseCreateSchema } from "@/lib/schemas/expense";
import { updateMonthlyExpenseTotal, cascadeUpdateFutureMonths } from "@/lib/monthly-totals";
import { adjustCreditCardBalance } from "@/lib/credit-cards";
import { after } from "next/server";
import { NextRequest } from "next/server";

// GET /api/expenses?month=4&year=2026
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  let query = supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (month && year) {
    const m = String(month).padStart(2, "0");
    query = query
      .gte("date", `${year}-${m}-01`)
      .lt(
        "date",
        Number(month) === 12
          ? `${Number(year) + 1}-01-01`
          : `${year}-${String(Number(month) + 1).padStart(2, "0")}-01`
      );
  }

  const { data, error: dbError } = await query;
  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  return Response.json(data, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

// POST /api/expenses
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = ExpenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const expenseDate = new Date(parsed.data.date);
  const m = expenseDate.getMonth() + 1;
  const y = expenseDate.getFullYear();

  const insertRes = await supabase
    .from("expenses")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (insertRes.error) return Response.json({ error: insertRes.error.message }, { status: 500 });
  const data = insertRes.data;

  if (parsed.data.payment_source === "credit_card" && parsed.data.credit_card_id) {
    await adjustCreditCardBalance(supabase, user.id, parsed.data.credit_card_id, parsed.data.amount);
  }

  const updatedSummary = await updateMonthlyExpenseTotal(supabase, user.id, m, y);

  after(async () => {
    await cascadeUpdateFutureMonths(supabase, user.id, m, y, {
      remaining_amount: Number(updatedSummary?.remaining_amount ?? 0),
      savings_fd: Number(updatedSummary?.savings_fd ?? 0),
      savings_sip: Number(updatedSummary?.savings_sip ?? 0),
      savings_shares: Number(updatedSummary?.savings_shares ?? 0),
      savings_nps: Number(updatedSummary?.savings_nps ?? 0),
      savings_pf: Number(updatedSummary?.savings_pf ?? 0),
    });
  });

  // 3. Return both the new expense and the updated summary (Round-trip 2)
  return Response.json({
    id: data.id,
    expense: data,
    summary: updatedSummary,
  }, { status: 201 });
}
