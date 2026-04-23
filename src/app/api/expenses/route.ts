import { requireAuth } from "@/lib/auth-guard";
import { ExpenseCreateSchema } from "@/lib/schemas/expense";
import { updateMonthlyExpenseTotal } from "@/lib/monthly-totals";
import { after } from "next/server";
import { NextRequest } from "next/server";

// GET /api/expenses?month=4&year=2026
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
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

  return Response.json(data);
}

// POST /api/expenses
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = ExpenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { data, error: dbError } = await supabase
    .from("expenses")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  const expenseDate = new Date(parsed.data.date);
  after(() =>
    updateMonthlyExpenseTotal(
      supabase,
      user.id,
      expenseDate.getMonth() + 1,
      expenseDate.getFullYear()
    )
  );

  return Response.json({ id: data.id }, { status: 201 });
}
