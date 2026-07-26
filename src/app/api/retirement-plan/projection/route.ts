import { requireAuthFast } from "@/lib/auth-guard";
import { RETIREMENT_DEFAULTS, projectRetirement } from "@/lib/retirement";

// GET /api/retirement-plan/projection
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const [
    assumptionsRes,
    milestonesRes,
    loansRes,
    sipRes,
    stockRes,
    bankRes,
    recentSalaryRes,
  ] = await Promise.all([
    supabase.from("retirement_plan").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("retirement_milestones").select("target_year, amount").eq("user_id", user.id),
    supabase
      .from("loans")
      .select("amount, end_date")
      .eq("user_id", user.id)
      .in("status", ["active", "paused"])
      .not("end_date", "is", null),
    supabase.from("sip_funds").select("units, current_nav").eq("user_id", user.id),
    supabase.from("stock_holdings").select("shares, current_price").eq("user_id", user.id),
    supabase.from("bank_accounts").select("current_balance").eq("user_id", user.id),
    supabase
      .from("monthly_summary")
      .select("month, year, salary")
      .eq("user_id", user.id)
      .gt("salary", 0)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(12),
  ]);

  const assumptions = assumptionsRes.data ?? {
    birth_year: new Date().getFullYear() - 30,
    ...RETIREMENT_DEFAULTS,
  };

  const sipTotal = (sipRes.data ?? []).reduce((sum, f) => sum + Number(f.units || 0) * Number(f.current_nav || 0), 0);
  const stockTotal = (stockRes.data ?? []).reduce((sum, s) => sum + Number(s.shares || 0) * Number(s.current_price || 0), 0);
  const bankTotal = (bankRes.data ?? []).reduce((sum, b) => sum + Number(b.current_balance || 0), 0);
  const currentCorpus = sipTotal + stockTotal + bankTotal;

  const recentSalary = recentSalaryRes.data ?? [];
  let monthlySurplus = 0;
  let currentAnnualSalary = 0;
  let currentAnnualExpenses = 0;

  if (recentSalary.length > 0) {
    const totalSalary = recentSalary.reduce((sum, r) => sum + Number(r.salary || 0), 0);
    const n = recentSalary.length;
    const sorted = [...recentSalary].sort((a, b) => (a.year - b.year) || (a.month - b.month));
    const earliest = sorted[0];
    const startDate = `${earliest.year}-${String(earliest.month).padStart(2, "0")}-01`;
    const todayStr = new Date().toISOString().slice(0, 10);

    const { data: expenseRows } = await supabase
      .from("expenses")
      .select("amount, category")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lt("date", todayStr);

    const nonSavingsTotal = (expenseRows ?? [])
      .filter((e) => e.category !== "Savings")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    monthlySurplus = (totalSalary - nonSavingsTotal) / n;
    currentAnnualSalary = (totalSalary / n) * 12;
    currentAnnualExpenses = (nonSavingsTotal / n) * 12;
  }

  const autoMonthlySurplus = monthlySurplus;
  const surplusOverride = (assumptions as { monthly_surplus_override?: number | null }).monthly_surplus_override;
  if (surplusOverride != null) {
    monthlySurplus = Number(surplusOverride);
  }

  // The auto-calculated currentAnnualSalary is a trailing-12-month ACTUAL total,
  // which already includes any real bonus paid in that window. Applying
  // annual_bonus_pct on top of it would double-count that bonus. Only apply the
  // bonus rate when the user supplies a clean, bonus-excluded base salary.
  const autoAnnualSalary = currentAnnualSalary;
  const salaryOverride = (assumptions as { annual_salary_override?: number | null }).annual_salary_override;
  const bonusApplies = salaryOverride != null;
  if (bonusApplies) {
    currentAnnualSalary = Number(salaryOverride);
  }

  const result = projectRetirement({
    assumptions: { ...assumptions, annual_bonus_pct: bonusApplies ? assumptions.annual_bonus_pct : 0 },
    currentCorpus,
    currentAnnualSalary,
    monthlySurplus,
    currentAnnualExpenses,
    loanEndDates: (loansRes.data ?? []).map((l) => ({ amount: Number(l.amount), end_date: l.end_date as string })),
    milestones: (milestonesRes.data ?? []).map((m) => ({ target_year: m.target_year, amount: Number(m.amount) })),
  });

  return Response.json({
    ...result,
    inputs: {
      currentCorpus,
      monthlySurplus,
      autoMonthlySurplus,
      isOverride: surplusOverride != null,
      currentAnnualSalary,
      autoAnnualSalary,
      isSalaryOverride: bonusApplies,
      bonusApplied: bonusApplies,
      currentAnnualExpenses,
    },
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
