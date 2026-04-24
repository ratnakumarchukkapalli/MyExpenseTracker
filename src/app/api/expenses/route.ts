import { requireAuthFast } from "@/lib/auth-guard";
import { ExpenseCreateSchema } from "@/lib/schemas/expense";
import { updateMonthlyExpenseTotal, cascadeUpdateFutureMonths } from "@/lib/monthly-totals";
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

  // 1. Parallelize Insert and Summary Fetch (Round-trip 1)
  const [insertRes, summaryRes] = await Promise.all([
    supabase
      .from("expenses")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single(),
    supabase
      .from("monthly_summary")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", m)
      .eq("year", y)
      .maybeSingle(),
  ]);

  if (insertRes.error) return Response.json({ error: insertRes.error.message }, { status: 500 });
  const data = insertRes.data;

  // 2. Recalculate total manually and update (Round-trip 2)
  const existingSummary = summaryRes.data;
  const oldTotal = Number(existingSummary?.total_expenses ?? 0);
  const newTotal = oldTotal + Number(parsed.data.amount);
  const newBalance = await updateMonthlyExpenseTotal(supabase, user.id, m, y, newTotal, existingSummary);

  after(async () => {
    await cascadeUpdateFutureMonths(supabase, user.id, m, y, newBalance);
  });

  // 3. Return both the new expense and the updated summary (Round-trip 2)
  return Response.json({ 
    id: data.id, 
    expense: data,
    summary: {
      ...existingSummary,
      total_expenses: newTotal,
      remaining_amount: newBalance,
      cash_equivalents: newBalance + Number(existingSummary?.savings_fd ?? 0) + Number(existingSummary?.savings_sip ?? 0) + Number(existingSummary?.savings_shares ?? 0)
    }
  }, { status: 201 });
}
