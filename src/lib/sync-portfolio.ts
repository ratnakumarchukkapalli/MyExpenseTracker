import { SupabaseClient } from "@supabase/supabase-js";
import { syncMonthlyWealthSnapshot, getActiveBudgetMonth } from "./monthly-totals";

/**
 * The month a live-portfolio sync belongs to when the caller didn't name one.
 *
 * Must be the active budget month, NOT the calendar month. Only one month owns
 * live values; every other month keeps its frozen snapshot. Under the 25th-salary
 * workflow those two diverge for the last week of every month — on 29 Jul 2026
 * the calendar said July while the budget month was August, so an unqualified
 * refresh-prices call overwrote closed July's savings_sip/savings_shares with
 * today's live portfolio. That destroyed July's stock snapshot after a holding
 * was sold: July lost a position it still held at its close, and its net worth
 * read ~1.76L low.
 */
async function defaultSyncMonth(
  supabase: SupabaseClient,
  userId: string,
  month?: number,
  year?: number
): Promise<{ m: number; y: number }> {
  if (month != null && year != null) return { m: month, y: year };
  const active = await getActiveBudgetMonth(supabase, userId);
  return { m: month ?? active.month, y: year ?? active.year };
}

/**
 * Recalculates total stock portfolio value and updates the monthly summary.
 * Now supports targeting a specific month and triggers cascading updates.
 */
export async function syncStocksToMonthlySummary(
  supabase: SupabaseClient,
  userId: string,
  month?: number,
  year?: number
) {
  const { m, y } = await defaultSyncMonth(supabase, userId, month, year);
  await syncMonthlyWealthSnapshot(supabase, userId, m, y);
}

/**
 * Recalculates total SIP portfolio value and updates the monthly summary.
 */
export async function syncSIPToMonthlySummary(
  supabase: SupabaseClient,
  userId: string,
  month?: number,
  year?: number
) {
  const { m, y } = await defaultSyncMonth(supabase, userId, month, year);
  await syncMonthlyWealthSnapshot(supabase, userId, m, y);
}
