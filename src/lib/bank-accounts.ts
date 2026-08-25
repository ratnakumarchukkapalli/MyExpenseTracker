import type { SupabaseClient } from "@supabase/supabase-js";
import {
  updateMonthlyExpenseTotal,
  cascadeUpdateFutureMonths,
  getActiveBudgetMonth,
} from "./monthly-totals";

/**
 * Adjusts a bank account's running balance by `delta` (negative for a
 * charge, positive to reverse one). No-ops silently if the account doesn't
 * belong to the user — callers pass IDs from trusted rows.
 */
export async function adjustBankAccountBalance(
  supabase: SupabaseClient,
  userId: string,
  accountId: number,
  delta: number
) {
  const { data: account } = await supabase
    .from("bank_accounts")
    .select("current_balance")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!account) return;

  await supabase
    .from("bank_accounts")
    .update({
      current_balance: Number(account.current_balance) + delta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("user_id", userId);
}

/**
 * Captures each account's balance as it stood at the end of `month`/`year` into
 * bank_account_balances, so a closed month's tiles can show that month's split
 * instead of today's. bank_accounts holds one running "as of now" value, so the
 * historical figure has to be derived by rolling back everything that has moved
 * since:
 *
 *  - bank-attributed expenses dated after the month (they debited the account
 *    the instant they were logged, whatever date they carry) are added back
 *  - salary already synced into the designated salary account for a later month
 *    is subtracted back off
 *
 * Transfers are the one thing that can't be undone — bank-accounts/transfer
 * mutates both balances without writing an audit row, so a transfer made after
 * the month has closed silently shifts that month's recorded split. Snapshot at
 * close (the caller does) and the window for that is near zero.
 *
 * `excludeMonth`/`excludeYear` skip one later month from the salary-removal
 * step — the caller uses this for the month it is upserting *right now*: that
 * row already carries the new salary and `salary_bank_synced` by the time this
 * runs, but its credit hasn't hit `current_balance` yet (that happens after
 * this snapshot, in the same request). Without the exclusion, its still-unapplied
 * salary would get subtracted anyway, undercounting the closed month by exactly
 * that amount.
 *
 * Also finalizes monthly_summary.remaining_amount/cash_equivalents for the
 * closing month to this same total. While a month is active, the Dashboard
 * shows live bank total, not the stored ledger figure (previous_month_remaining
 * + salary − expenses) — so anything that moves a bank balance without an
 * expense row (a manual balance edit reconciling against a bank statement,
 * stock-sale proceeds routed to bank) is reflected live but never lands in the
 * ledger. Left uncorrected, the frozen remaining_amount silently disagrees with
 * what the month actually showed the whole time it was open.
 */
export async function snapshotBankBalancesForMonth(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number,
  excludeMonth?: number,
  excludeYear?: number
) {
  const nextMonthStart =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const [{ data: accounts }, { data: laterExpenses }, { data: laterSalaries }, { data: summaryRow }] =
    await Promise.all([
      supabase
        .from("bank_accounts")
        .select("id, current_balance, is_salary_account")
        .eq("user_id", userId),
      supabase
        .from("expenses")
        .select("amount, payment_source, bank_account_id")
        .eq("user_id", userId)
        .gte("date", nextMonthStart)
        .not("bank_account_id", "is", null),
      supabase
        .from("monthly_summary")
        .select("month, year, salary, salary_bank_synced")
        .eq("user_id", userId)
        .gt("salary", 0)
        .eq("salary_bank_synced", true),
      supabase
        .from("monthly_summary")
        .select("savings_fd, savings_sip, savings_shares")
        .eq("user_id", userId)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle(),
    ]);

  if (!accounts || accounts.length === 0) return;

  // Expenses debit the account on creation regardless of their date, so only
  // bank-sourced ones are in play (sodexo and credit-card spend never touched it).
  const addBack = new Map<number, number>();
  for (const e of laterExpenses ?? []) {
    if ((e.payment_source ?? "bank") !== "bank" || e.bank_account_id == null) continue;
    addBack.set(e.bank_account_id, (addBack.get(e.bank_account_id) ?? 0) + Number(e.amount));
  }

  const salaryToRemove = (laterSalaries ?? [])
    .filter((r) => r.year > year || (r.year === year && r.month > month))
    .filter((r) => !(r.month === excludeMonth && r.year === excludeYear))
    .reduce((sum, r) => sum + Number(r.salary), 0);

  const rows = accounts.map((a) => ({
    user_id: userId,
    bank_account_id: a.id,
    month,
    year,
    balance:
      Number(a.current_balance || 0) +
      (addBack.get(a.id) ?? 0) -
      (a.is_salary_account ? salaryToRemove : 0),
    updated_at: new Date().toISOString(),
  }));

  await supabase
    .from("bank_account_balances")
    .upsert(rows, { onConflict: "user_id,bank_account_id,month,year" });

  if (summaryRow) {
    const totalCash = rows.reduce((sum, r) => sum + r.balance, 0);
    const cash_equivalents =
      totalCash +
      Number(summaryRow.savings_fd || 0) +
      Number(summaryRow.savings_sip || 0) +
      Number(summaryRow.savings_shares || 0);

    await supabase
      .from("monthly_summary")
      .update({
        remaining_amount: totalCash,
        cash_equivalents,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year);
  }
}

/**
 * Re-runs the active budget month's cascade so a bank-account change that isn't
 * itself an expense (manual balance edit, create, delete, transfer) still
 * propagates into future months' Carryover — cascadeUpdateFutureMonths
 * substitutes the live bank-account sum whenever it's cascading from the active
 * budget month, which is the only month that owns those live balances.
 */
export async function resyncCurrentMonthCascade(supabase: SupabaseClient, userId: string) {
  const { month, year } = await getActiveBudgetMonth(supabase, userId);
  const updatedSummary = await updateMonthlyExpenseTotal(supabase, userId, month, year);
  await cascadeUpdateFutureMonths(supabase, userId, month, year, {
    remaining_amount: Number(updatedSummary?.remaining_amount ?? 0),
    savings_fd: Number(updatedSummary?.savings_fd ?? 0),
    savings_sip: Number(updatedSummary?.savings_sip ?? 0),
    savings_shares: Number(updatedSummary?.savings_shares ?? 0),
    savings_nps: Number(updatedSummary?.savings_nps ?? 0),
    savings_pf: Number(updatedSummary?.savings_pf ?? 0),
  });
}
