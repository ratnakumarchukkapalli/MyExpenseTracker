import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { MonthlySummaryUpdateSchema } from "@/lib/schemas/monthly-summary";
import { cascadeUpdateFutureMonths } from "@/lib/monthly-totals";
import { after } from "next/server";
import { NextRequest } from "next/server";

type RouteParams = { params: Promise<{ month: string; year: string }> };

// GET /api/monthly-summary/[month]/[year]
// Mirrors get-monthly-financial-summary: returns row or auto-carries forward from previous month
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { month, year } = await params;
  const m = Number(month);
  const y = Number(year);

  if (!m || !y) return Response.json({ error: "Invalid month/year" }, { status: 400 });

  // Fetch current month and previous month in parallel
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;

  const [rowResult, prevResult] = await Promise.all([
    supabase.from("monthly_summary").select("*").eq("user_id", user.id).eq("month", m).eq("year", y).maybeSingle(),
    supabase.from("monthly_summary").select("remaining_amount, savings_fd, savings_sip, savings_shares, savings_nps, savings_pf").eq("user_id", user.id).eq("month", prevMonth).eq("year", prevYear).maybeSingle()
  ]);

  const row = rowResult.data;
  const prev = prevResult.data;
  const expectedOpening = Number(prev?.remaining_amount ?? 0);

  // If record exists, check if opening balance or investment snapshots are stale.
  // Only auto-sync carry-forward rows (no salary/expense data recorded yet).
  if (row) {
    const isCarryForward = Number(row.salary) === 0 && Number(row.total_expenses) === 0;
    const isStaleOpening = isCarryForward && (Number(row.previous_month_remaining) !== expectedOpening);
    const isStaleSIP = Number(row.savings_sip) !== Number(prev?.savings_sip ?? 0);
    const isStaleStocks = Number(row.savings_shares) !== Number(prev?.savings_shares ?? 0);
    
    // For manual fields, we only sync if it's a pure carry-forward month
    const isStaleFD = isCarryForward && (Number(row.savings_fd) !== Number(prev?.savings_fd ?? 0));
    const isStaleNPS = isCarryForward && (Number(row.savings_nps) !== Number(prev?.savings_nps ?? 0));
    const isStalePF = isCarryForward && (Number(row.savings_pf) !== Number(prev?.savings_pf ?? 0));

    if (isStaleOpening || isStaleSIP || isStaleStocks || isStaleFD || isStaleNPS || isStalePF) {
      // Auto-sync stale values
      const newRemaining = isStaleOpening 
        ? (expectedOpening + Number(row.salary) + Number(row.interest_income) - Number(row.total_expenses))
        : Number(row.remaining_amount);
        
      const updateData: any = {
        savings_sip: Number(prev?.savings_sip ?? 0),
        savings_shares: Number(prev?.savings_shares ?? 0),
      };

      if (isStaleOpening) {
        updateData.previous_month_remaining = expectedOpening;
        updateData.remaining_amount = newRemaining;
      }
      if (isCarryForward) {
        updateData.savings_fd = Number(prev?.savings_fd ?? 0);
        updateData.savings_nps = Number(prev?.savings_nps ?? 0);
        updateData.savings_pf = Number(prev?.savings_pf ?? 0);
      }
      
      updateData.cash_equivalents = (updateData.remaining_amount ?? row.remaining_amount) + 
        (updateData.savings_fd ?? row.savings_fd) + 
        (updateData.savings_sip ?? row.savings_sip) + 
        (updateData.savings_shares ?? row.savings_shares);

      const { data: updatedRow } = await supabase
        .from("monthly_summary")
        .update(updateData)
        .eq("id", row.id)
        .select()
        .single();

      return Response.json(updatedRow || row);
    }
    return Response.json(row, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  // No record — fetch previous month in parallel with nothing (single query needed)

  const carryForward = {
    month: m,
    year: y,
    salary: 0,
    previous_month_remaining: Number(prev?.remaining_amount ?? 0),
    total_expenses: 0,
    remaining_amount: Number(prev?.remaining_amount ?? 0),
    interest_income: 0,
    savings_fd: Number(prev?.savings_fd ?? 0),
    savings_sip: Number(prev?.savings_sip ?? 0),
    savings_shares: Number(prev?.savings_shares ?? 0),
    savings_nps: Number(prev?.savings_nps ?? 0),
    savings_pf: Number(prev?.savings_pf ?? 0),
    cash_equivalents:
      Number(prev?.remaining_amount ?? 0) +
      Number(prev?.savings_fd ?? 0) +
      Number(prev?.savings_sip ?? 0) +
      Number(prev?.savings_shares ?? 0),
  };

  // Persist the auto-carry-forward record in the background (don't block response)
  after(async () => {
    await supabase
      .from("monthly_summary")
      .insert({ ...carryForward, user_id: user.id });
  });


  return Response.json(carryForward, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

// POST /api/monthly-summary/[month]/[year] — upsert with recalculation
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { month, year } = await params;
  const body = await request.json().catch(() => null);

  const parsed = MonthlySummaryUpdateSchema.safeParse({
    ...body,
    month: Number(month),
    year: Number(year),
  });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  // Recalculate expenses total from the actual expenses table
  const { data: expenseRows } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", user.id)
    .gte("date", `${d.year}-${String(d.month).padStart(2, "0")}-01`)
    .lt(
      "date",
      d.month === 12
        ? `${d.year + 1}-01-01`
        : `${d.year}-${String(d.month + 1).padStart(2, "0")}-01`
    );

  const total_expenses = (expenseRows ?? []).reduce(
    (sum, r) => sum + Number(r.amount),
    0
  );

  const remaining_amount =
    d.previous_month_remaining + d.salary + d.interest_income - total_expenses;
  const cash_equivalents =
    remaining_amount + d.savings_fd + d.savings_sip + d.savings_shares;

  const upsertData = {
    user_id: user.id,
    month: d.month,
    year: d.year,
    salary: d.salary,
    previous_month_remaining: d.previous_month_remaining,
    interest_income: d.interest_income,
    total_expenses,
    remaining_amount,
    savings_fd: d.savings_fd,
    savings_sip: d.savings_sip,
    savings_shares: d.savings_shares,
    savings_nps: d.savings_nps,
    savings_pf: d.savings_pf,
    cash_equivalents,
    updated_at: new Date().toISOString(),
  };

  const { error: dbError } = await supabase
    .from("monthly_summary")
    .upsert(upsertData, { onConflict: "user_id,month,year" });

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  // Chain Reaction: Update all future months' opening balances and investment snapshots
  after(async () => {
    await cascadeUpdateFutureMonths(supabase, user.id, d.month, d.year, {
      remaining_amount,
      savings_fd: d.savings_fd,
      savings_sip: d.savings_sip,
      savings_shares: d.savings_shares,
      savings_nps: d.savings_nps,
      savings_pf: d.savings_pf,
    });
  });

  return Response.json({ ...upsertData });
}
