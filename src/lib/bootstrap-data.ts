import type { SupabaseClient, User } from "@supabase/supabase-js";
import { after } from "next/server";
import { advanceSubscriptionsLocally, persistSubscriptionAdvances } from "./subscriptions";

export type BootstrapData = {
  expenses: unknown[];
  subscriptions: unknown[];
  summary: unknown | null;
  user: { email: string | null; name: string | null };
  prevMonthExpenses: unknown[];
  yearlyRows: {
    month: number;
    year: number;
    cash: number;
    fd: number;
    sip: number;
    shares: number;
    nps_pf: number;
    salary: number;
    savings: number;
  }[];
  yearlyCategoryRows: { month: number; category: string; total: number }[];
  categoryBudgets: unknown[];
  loanMilestones: unknown[];
  creditCards: unknown[];
};

export async function fetchBootstrapData(
  supabase: SupabaseClient,
  user: User,
  month: number,
  year: number,
  // light=true: skip static data (subscriptions, yearly chart, budgets, loans)
  // used on month navigation to only fetch month-specific data (3 queries vs 8)
  light = false
): Promise<BootstrapData> {
  const m = String(month).padStart(2, "0");
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevM = String(prevMonth).padStart(2, "0");
  const today = new Date().toISOString().split("T")[0];

  const staticPlaceholder = Promise.resolve({ data: null, error: null });

  const [
    expensesRes,
    subscriptionsRes,
    summaryRes,
    prevExpensesRes,
    yearlySummaryRes,
    yearlyExpensesRes,
    categoryBudgetsRes,
    loanMilestonesRes,
    creditCardsRes,
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", `${year}-${m}-01`)
      .lt("date", month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`)
      .order("date", { ascending: false }),
    light ? staticPlaceholder : supabase.from("subscriptions").select("*").eq("user_id", user.id),
    supabase
      .from("monthly_summary")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle(),
    supabase
      .from("expenses")
      .select("category, amount, description")
      .eq("user_id", user.id)
      .gte("date", `${prevYear}-${prevM}-01`)
      .lt("date", prevMonth === 12 ? `${prevYear + 1}-01-01` : `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`),
    light ? staticPlaceholder : supabase
      .from("monthly_summary")
      .select("month, year, remaining_amount, savings_fd, savings_sip, savings_shares, savings_nps, savings_pf, salary")
      .eq("user_id", user.id)
      .eq("year", year)
      .order("month"),
    light ? staticPlaceholder : supabase
      .from("expenses")
      .select("date, amount, category")
      .eq("user_id", user.id)
      .gte("date", `${year}-01-01`)
      .lt("date", `${year + 1}-01-01`),
    light ? staticPlaceholder : supabase.from("category_budgets").select("*").eq("user_id", user.id).order("category"),
    light ? staticPlaceholder : supabase
      .from("loans")
      .select("name, amount, end_date")
      .eq("user_id", user.id)
      .eq("status", "active")
      .not("end_date", "is", null)
      .gte("end_date", today)
      .order("end_date"),
    light ? staticPlaceholder : supabase
      .from("credit_cards")
      .select("*")
      .eq("user_id", user.id)
      .order("name"),
  ]);

  let subscriptions: unknown[] = [];
  if (!light && subscriptionsRes.data) {
    const result = advanceSubscriptionsLocally(subscriptionsRes.data);
    subscriptions = result.subscriptions;
    if (result.toUpdate.length > 0) {
      after(() => persistSubscriptionAdvances(supabase, user.id, result.toUpdate));
    }
  }

  let yearlyRows: BootstrapData["yearlyRows"] = [];
  let yearlyCategoryRows: BootstrapData["yearlyCategoryRows"] = [];
  if (!light) {
    const savingsByMonth: Record<number, number> = {};
    const categoryByMonth: Record<string, Record<string, number>> = {};
    for (const e of (yearlyExpensesRes.data as { date: string; amount: number; category: string }[] | null) ?? []) {
      const mo = String(Number((e.date as string).slice(5, 7)));
      if (e.category === "Savings") {
        savingsByMonth[Number(mo)] = (savingsByMonth[Number(mo)] ?? 0) + Number(e.amount);
      }
      if (!categoryByMonth[mo]) categoryByMonth[mo] = {};
      categoryByMonth[mo][e.category] = (categoryByMonth[mo][e.category] ?? 0) + Number(e.amount);
    }
    for (const [mo, cats] of Object.entries(categoryByMonth)) {
      for (const [category, total] of Object.entries(cats)) {
        yearlyCategoryRows.push({ month: Number(mo), category, total: Math.round(total) });
      }
    }
    yearlyRows = ((yearlySummaryRes.data as any[] | null) ?? []).map((r) => ({
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
  }

  return {
    expenses: expensesRes.data ?? [],
    subscriptions,
    summary: summaryRes.data ?? null,
    user: {
      email: user.email ?? null,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
    },
    prevMonthExpenses: prevExpensesRes.data ?? [],
    yearlyRows,
    yearlyCategoryRows,
    categoryBudgets: (categoryBudgetsRes.data as unknown[] | null) ?? [],
    loanMilestones: (loanMilestonesRes.data as unknown[] | null) ?? [],
    creditCards: (creditCardsRes.data as unknown[] | null) ?? [],
  };
}
