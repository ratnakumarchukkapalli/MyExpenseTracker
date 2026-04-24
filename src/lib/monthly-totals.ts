import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Recalculates total_expenses and remaining_amount for a month after any expense change.
 * Mirrors the updateMonthlyExpenseTotal() function in main.js.
 */
export async function updateMonthlyExpenseTotal(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number,
  manualTotalExpenses?: number,
  existingSummary?: any
) {
  let total_expenses = 0;
  let existing = existingSummary ?? null;

  if (manualTotalExpenses !== undefined) {
    total_expenses = manualTotalExpenses;
    if (!existing) {
      const { data } = await supabase
        .from("monthly_summary")
        .select("*")
        .eq("user_id", userId)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();
      existing = data;
    }
  } else {
    // Fetch current expense sum and existing monthly_summary in parallel to save a round-trip
    const [expenseSumResult, existingResult] = await Promise.all([
      supabase
        .from("expenses")
        .select("amount")
        .eq("user_id", userId)
        .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lt(
          "date",
          month === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(month + 1).padStart(2, "0")}-01`
        ),
      supabase
        .from("monthly_summary")
        .select("*")
        .eq("user_id", userId)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle(),
    ]);

    total_expenses = (expenseSumResult.data ?? []).reduce(
      (sum, row) => sum + Number(row.amount),
      0
    );
    existing = existingResult.data;
  }
 
  const salary = Number(existing?.salary ?? 0);
  const previous_month_remaining = Number(existing?.previous_month_remaining ?? 0);
  const interest_income = Number(existing?.interest_income ?? 0);
  const savings_fd = Number(existing?.savings_fd ?? 0);
  const savings_sip = Number(existing?.savings_sip ?? 0);
  const savings_shares = Number(existing?.savings_shares ?? 0);

  const remaining_amount =
    previous_month_remaining + salary + interest_income - total_expenses;
  const cash_equivalents =
    remaining_amount + savings_fd + savings_sip + savings_shares;

  if (existing) {
    await supabase
      .from("monthly_summary")
      .update({
        total_expenses,
        remaining_amount,
        cash_equivalents,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year);
  } else {
    await supabase.from("monthly_summary").insert({
      user_id: userId,
      month,
      year,
      total_expenses,
      remaining_amount,
      cash_equivalents,
    });
  }

  return remaining_amount;
}

/**
 * Recursively updates future months' previous_month_remaining and remaining_amount.
 * Ensures that changes in one month propagate through the entire chain of carry-overs.
 */
export async function cascadeUpdateFutureMonths(
  supabase: SupabaseClient,
  userId: string,
  startMonth: number,
  startYear: number,
  newOpeningBalance: number
) {
  // Fetch all potential future months at once to avoid network round-trips
  const { data: allRows } = await supabase
    .from("monthly_summary")
    .select("*")
    .eq("user_id", userId)
    .gte("year", startYear)
    .order("year", { ascending: true })
    .order("month", { ascending: true });

  if (!allRows || allRows.length === 0) return;

  // Filter for months strictly after the starting month/year
  const futureRows = allRows.filter(
    (r) => r.year > startYear || (r.year === startYear && r.month > startMonth)
  );

  if (futureRows.length === 0) return;

  const updates = [];
  let currentOpeningBalance = newOpeningBalance;

  // Process only the next 12 months to keep performance snappy and avoid massive cascades
  // but enough to cover any reasonable carry-forward scenario
  const maxMonths = Math.min(futureRows.length, 12);

  for (let i = 0; i < maxMonths; i++) {
    const row = futureRows[i];
    const nextRemaining =
      currentOpeningBalance +
      Number(row.salary) +
      Number(row.interest_income) -
      Number(row.total_expenses);

    updates.push({
      ...row,
      previous_month_remaining: currentOpeningBalance,
      remaining_amount: nextRemaining,
      cash_equivalents:
        nextRemaining +
        Number(row.savings_fd) +
        Number(row.savings_sip) +
        Number(row.savings_shares),
      updated_at: new Date().toISOString(),
    });

    currentOpeningBalance = nextRemaining;
  }

  if (updates.length > 0) {
    // Single bulk update for all modified months
    await supabase.from("monthly_summary").upsert(updates);
  }
}
