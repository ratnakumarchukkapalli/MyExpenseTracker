import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Recalculates total_expenses and remaining_amount for a month after any expense change.
 * Mirrors the updateMonthlyExpenseTotal() function in main.js.
 */
export async function updateMonthlyExpenseTotal(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
) {
  // Sum all expenses for this month (including Savings — they physically leave the account)
  const { data: expenseSum } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", userId)
    .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
    .lt(
      "date",
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`
    );

  const total_expenses = (expenseSum ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );

  // Get existing monthly_summary row (may not exist)
  const { data: existing } = await supabase
    .from("monthly_summary")
    .select("*")
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

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
}
