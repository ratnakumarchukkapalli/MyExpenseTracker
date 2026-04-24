import { SupabaseClient } from "@supabase/supabase-js";
import { syncMonthlyWealthSnapshot } from "./monthly-totals";

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
  const now = new Date();
  const m = month ?? (now.getMonth() + 1);
  const y = year ?? now.getFullYear();
  
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
  const now = new Date();
  const m = month ?? (now.getMonth() + 1);
  const y = year ?? now.getFullYear();

  await syncMonthlyWealthSnapshot(supabase, userId, m, y);
}
