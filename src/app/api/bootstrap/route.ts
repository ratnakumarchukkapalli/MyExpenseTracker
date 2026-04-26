import { requireAuthFast } from "@/lib/auth-guard";
import { advanceSubscriptionsLocally, persistSubscriptionAdvances } from "@/lib/subscriptions";
import { after } from "next/server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const t0 = Date.now();
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;
  const tAuth = Date.now();

  const { searchParams } = request.nextUrl;
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));

  if (!month || !year) {
    return Response.json({ error: "Missing month/year" }, { status: 400 });
  }

  const m = String(month).padStart(2, "0");
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevM = String(prevMonth).padStart(2, "0");
  const today = new Date().toISOString().split("T")[0];

  const [
    expensesRes,
    subscriptionsRes,
    summaryRes,
    prevExpensesRes,
    yearlySummaryRes,
    yearlyExpensesRes,
    categoryBudgetsRes,
    loanMilestonesRes,
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", `${year}-${m}-01`)
      .lt("date", month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`)
      .order("date", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("monthly_summary")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle(),
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", `${prevYear}-${prevM}-01`)
      .lt("date", prevMonth === 12 ? `${prevYear + 1}-01-01` : `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`)
      .order("date", { ascending: false }),
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
    supabase
      .from("category_budgets")
      .select("*")
      .eq("user_id", user.id)
      .order("category"),
    supabase
      .from("loans")
      .select("name, amount, end_date")
      .eq("user_id", user.id)
      .eq("status", "active")
      .not("end_date", "is", null)
      .gte("end_date", today)
      .order("end_date"),
  ]);

  const tDb = Date.now();
  // Compute advanced dates locally (pure JS, ~0ms), persist DB writes after the response is sent
  const { subscriptions, toUpdate } = advanceSubscriptionsLocally(subscriptionsRes.data ?? []);
  if (toUpdate.length > 0) {
    after(() => persistSubscriptionAdvances(supabase, user.id, toUpdate));
  }

  const savingsByMonth: Record<number, number> = {};
  for (const e of yearlyExpensesRes.data ?? []) {
    const mo = Number((e.date as string).slice(5, 7));
    savingsByMonth[mo] = (savingsByMonth[mo] ?? 0) + Number(e.amount);
  }
  const yearlyRows = (yearlySummaryRes.data ?? []).map(r => ({
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

  return Response.json({
    expenses: expensesRes.data ?? [],
    subscriptions,
    summary: summaryRes.data ?? null,
    user: {
      email: user.email ?? null,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
    },
    prevMonthExpenses: prevExpensesRes.data ?? [],
    yearlyRows,
    categoryBudgets: categoryBudgetsRes.data ?? [],
    loanMilestones: loanMilestonesRes.data ?? [],
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Server-Timing": `auth;dur=${tAuth - t0}, db;dur=${tDb - tAuth}, total;dur=${Date.now() - t0}`,
    },
  });
}
