import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const year = Number(request.nextUrl.searchParams.get("year") ?? new Date().getFullYear());

  // Run both queries in parallel
  const [summaryResult, savingsResult] = await Promise.all([
    supabase
      .from("monthly_summary")
      .select("month, year, remaining_amount, savings_fd, savings_sip, savings_shares, savings_nps, savings_pf, salary")
      .eq("user_id", user.id)
      .eq("year", year)
      .order("month"),
    supabase
      .from("expenses")
      .select("date, amount")
      .eq("user_id", user.id)
      .eq("category", "Savings")
      .gte("date", `${year}-01-01`)
      .lt("date", `${year + 1}-01-01`),
  ]);

  const { data, error: dbError } = summaryResult;
  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  const { data: savingsExpenses } = savingsResult;

  const savingsByMonth: Record<number, number> = {};
  for (const e of savingsExpenses ?? []) {
    const m = Number(e.date.slice(5, 7));
    savingsByMonth[m] = (savingsByMonth[m] ?? 0) + Number(e.amount);
  }

  // Map to match the Electron `get-yearly-net-worth` shape + savings
  const rows = (data ?? []).map(r => ({
    month: r.month,
    year: r.year,
    cash: r.remaining_amount ?? 0,
    fd: r.savings_fd ?? 0,
    sip: r.savings_sip ?? 0,
    shares: r.savings_shares ?? 0,
    nps_pf: (r.savings_nps ?? 0) + (r.savings_pf ?? 0),
    salary: r.salary ?? 0,
    savings: savingsByMonth[r.month] ?? 0,
  }));

  return Response.json(rows);
}
