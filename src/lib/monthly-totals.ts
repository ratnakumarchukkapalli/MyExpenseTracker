import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Recalculates total_expenses, sodexo_spent, and remaining_amount for a month.
 * Credit card expenses are deferred (paid off later) — they're excluded from
 * total_expenses entirely, so they never touch the bank or count against the budget.
 * remaining_amount only deducts bank-paid expenses (sodexo never touched the bank).
 */
export async function updateMonthlyExpenseTotal(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const [expenseSumResult, existingResult] = await Promise.all([
    supabase
      .from("expenses")
      .select("amount, payment_source")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lt("date", endDate),
    supabase
      .from("monthly_summary")
      .select("*")
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle(),
  ]);

  const rows = expenseSumResult.data ?? [];
  const total_expenses = rows
    .filter((row) => row.payment_source !== "credit_card")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const sodexo_spent = rows
    .filter((row) => row.payment_source === "sodexo")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const existing = existingResult.data;
  const salary = Number(existing?.salary ?? 0);
  const previous_month_remaining = Number(existing?.previous_month_remaining ?? 0);
  const interest_income = Number(existing?.interest_income ?? 0);
  const savings_fd = Number(existing?.savings_fd ?? 0);
  const savings_sip = Number(existing?.savings_sip ?? 0);
  const savings_shares = Number(existing?.savings_shares ?? 0);

  // Sodexo-tagged expenses come from the Sodexo card, not the bank
  const bank_expenses = total_expenses - sodexo_spent;
  const remaining_amount =
    previous_month_remaining + salary + interest_income - bank_expenses;
  const cash_equivalents =
    remaining_amount + savings_fd + savings_sip + savings_shares;

  let updatedRow;
  if (existing) {
    const { data } = await supabase
      .from("monthly_summary")
      .update({
        total_expenses,
        sodexo_spent,
        remaining_amount,
        cash_equivalents,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year)
      .select()
      .single();
    updatedRow = data;
  } else {
    const { data } = await supabase
      .from("monthly_summary")
      .insert({
        user_id: userId,
        month,
        year,
        total_expenses,
        sodexo_spent,
        remaining_amount,
        cash_equivalents,
      })
      .select()
      .single();
    updatedRow = data;
  }

  return updatedRow;
}

/**
 * Recursively updates future months' previous_month_remaining, remaining_amount,
 * and investment snapshots (SIP, Stocks, FD, NPS, PF).
 * Ensures that changes in one month propagate through the entire chain.
 */
export async function cascadeUpdateFutureMonths(
  supabase: SupabaseClient,
  userId: string,
  startMonth: number,
  startYear: number,
  sourceValues: {
    remaining_amount: number;
    savings_fd?: number;
    savings_sip?: number;
    savings_shares?: number;
    savings_nps?: number;
    savings_pf?: number;
    sodexo_balance?: number;
  }
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
  let currentOpeningBalance = sourceValues.remaining_amount;
  
  // Track carry-forward values for investments
  let currentFD = sourceValues.savings_fd;
  let currentSIP = sourceValues.savings_sip;
  let currentShares = sourceValues.savings_shares;
  let currentNPS = sourceValues.savings_nps;
  let currentPF = sourceValues.savings_pf;
  let currentSodexo = sourceValues.sodexo_balance;

  // Process up to 24 months (2 years) to ensure long-term corrections propagate
  const maxMonths = Math.min(futureRows.length, 24);

  for (let i = 0; i < maxMonths; i++) {
    const row = futureRows[i];
    
    // Heuristic: If a month is "fresh" (no salary/expenses logged yet), 
    // it's a carry-forward candidate for investment values too.
    const isCarryForwardMonth = Number(row.salary) === 0 && Number(row.total_expenses) === 0;

    const nextRemaining =
      currentOpeningBalance +
      Number(row.salary) +
      Number(row.interest_income) -
      Number(row.total_expenses);

    const update: any = {
      ...row,
      previous_month_remaining: currentOpeningBalance,
      remaining_amount: nextRemaining,
      updated_at: new Date().toISOString(),
    };

    // Propagate investments
    // For SIP and Stocks, we always propagate because these are "Total Portfolio" snapshots
    // and the user expects corrections to flow through automatically.
    if (currentSIP !== undefined) update.savings_sip = currentSIP;
    if (currentShares !== undefined) update.savings_shares = currentShares;

    // For FD, NPS, PF (which the user often updates manually), we propagate 
    // only if the month is a "carry-forward" month (no manual edits logged yet).
    if (isCarryForwardMonth) {
      if (currentFD !== undefined) update.savings_fd = currentFD;
      if (currentNPS !== undefined) update.savings_nps = currentNPS;
      if (currentPF !== undefined) update.savings_pf = currentPF;
      if (currentSodexo !== undefined) update.sodexo_balance = currentSodexo;
      update.sodexo_credit = 0;
    }

    // Recalculate cash_equivalents with new (potentially propagated) values
    update.cash_equivalents =
      nextRemaining +
      Number(update.savings_fd ?? row.savings_fd ?? 0) +
      Number(update.savings_sip ?? row.savings_sip ?? 0) +
      Number(update.savings_shares ?? row.savings_shares ?? 0);

    updates.push(update);

    currentOpeningBalance = nextRemaining;
    
    // For the next iteration, use this month's EOM as the new baseline
    currentFD = Number(update.savings_fd ?? row.savings_fd ?? 0);
    currentSIP = Number(update.savings_sip ?? row.savings_sip ?? 0);
    currentShares = Number(update.savings_shares ?? row.savings_shares ?? 0);
    currentNPS = Number(update.savings_nps ?? row.savings_nps ?? 0);
    currentPF = Number(update.savings_pf ?? row.savings_pf ?? 0);
    currentSodexo = Number(update.sodexo_balance ?? row.sodexo_balance ?? 0);
  }

  if (updates.length > 0) {
    // Single bulk update for all modified months
    await supabase.from("monthly_summary").upsert(updates);
  }
}

/**
 * Syncs the monthly summary with the current live wealth totals (SIP & Stocks)
 * and then cascades the updated summary to future months.
 */
export async function syncMonthlyWealthSnapshot(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
) {
  // 1. Fetch live totals
  const [sipResponse, stockResponse, summaryResponse] = await Promise.all([
    supabase.from("sip_funds").select("units, current_nav").eq("user_id", userId),
    supabase.from("stock_holdings").select("shares, current_price").eq("user_id", userId),
    supabase.from("monthly_summary").select("*").eq("user_id", userId).eq("month", month).eq("year", year).maybeSingle()
  ]);

  const sipTotal = (sipResponse.data ?? []).reduce((sum, f) => sum + (Number(f.units || 0) * Number(f.current_nav || 0)), 0);
  const stockTotal = (stockResponse.data ?? []).reduce((sum, s) => sum + (Number(s.shares || 0) * Number(s.current_price || 0)), 0);
  
  const existing = summaryResponse.data;
  if (!existing) return;

  const cash_equivalents = Number(existing.remaining_amount) + Number(existing.savings_fd) + sipTotal + stockTotal;

  // 2. Update April (or selected month) summary
  const { data: updatedSummary } = await supabase
    .from("monthly_summary")
    .update({
      savings_sip: sipTotal,
      savings_shares: stockTotal,
      cash_equivalents,
      updated_at: new Date().toISOString()
    })
    .eq("id", existing.id)
    .select()
    .single();

  if (updatedSummary) {
    // 3. Cascade corrections to all future months
    await cascadeUpdateFutureMonths(supabase, userId, month, year, {
      remaining_amount: updatedSummary.remaining_amount,
      savings_fd: updatedSummary.savings_fd,
      savings_sip: updatedSummary.savings_sip,
      savings_shares: updatedSummary.savings_shares,
      savings_nps: updatedSummary.savings_nps,
      savings_pf: updatedSummary.savings_pf
    });
  }
}
