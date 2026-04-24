import { requireAuthFast } from "@/lib/auth-guard";
import { ExpenseUpdateSchema } from "@/lib/schemas/expense";
import { updateMonthlyExpenseTotal, cascadeUpdateFutureMonths } from "@/lib/monthly-totals";
import { after } from "next/server";
import { NextRequest } from "next/server";

// PUT /api/expenses/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { id } = await params;
  const expenseId = Number(id);
  if (!expenseId) return Response.json({ error: "Invalid id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = ExpenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Fetch old date to know which month(s) to recalculate
  const { data: old } = await supabase
    .from("expenses")
    .select("date")
    .eq("id", expenseId)
    .eq("user_id", user.id)
    .single();

  if (!old) return Response.json({ error: "Not found" }, { status: 404 });

  const { error: dbError } = await supabase
    .from("expenses")
    .update(parsed.data)
    .eq("id", expenseId)
    .eq("user_id", user.id);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  // Recalculate monthly totals for both old and new month (if different)
  const newDate = new Date(parsed.data.date);
  const newMonth = newDate.getMonth() + 1;
  const newYear = newDate.getFullYear();

  const oldDate = new Date(old.date);
  const oldMonth = oldDate.getMonth() + 1;
  const oldYear = oldDate.getFullYear();

  const monthsToUpdate = [{ month: newMonth, year: newYear }];
  if (oldMonth !== newMonth || oldYear !== newYear) {
    monthsToUpdate.push({ month: oldMonth, year: oldYear });
  }

  const results = await Promise.all(
    monthsToUpdate.map(({ month, year }) =>
      updateMonthlyExpenseTotal(supabase, user.id, month, year)
    )
  );

  after(async () => {
    await Promise.all(
      monthsToUpdate.map((m, i) =>
        cascadeUpdateFutureMonths(supabase, user.id, m.month, m.year, results[i])
      )
    );
  });


  return Response.json({ changes: 1 });
}

// DELETE /api/expenses/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { id } = await params;
  const expenseId = Number(id);
  if (!expenseId) return Response.json({ error: "Invalid id" }, { status: 400 });

  // Delete and return date/amount in a single query (Round-trip 1)
  const { data: deleted, error: dbError } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("user_id", user.id)
    .select("date, amount")
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  if (!deleted) return Response.json({ changes: 0 });

  const expenseDate = new Date(deleted.date);
  const m = expenseDate.getMonth() + 1;
  const y = expenseDate.getFullYear();

  // Fetch summary to get old total (Round-trip 2)
  const { data: summary } = await supabase
    .from("monthly_summary")
    .select("total_expenses")
    .eq("user_id", user.id)
    .eq("month", m)
    .eq("year", y)
    .maybeSingle();

  // Update summary with new total (Round-trip 3)
  const oldTotal = Number(summary?.total_expenses ?? 0);
  const newTotal = oldTotal - Number(deleted.amount);
  const newBalance = await updateMonthlyExpenseTotal(supabase, user.id, m, y, newTotal);

  after(async () => {
    await cascadeUpdateFutureMonths(supabase, user.id, m, y, newBalance);
  });


  return Response.json({ changes: 1 });
}
