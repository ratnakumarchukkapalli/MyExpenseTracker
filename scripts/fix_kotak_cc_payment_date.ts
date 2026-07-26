/**
 * One-time fix: the credit-cards/[id]/pay route (before its budget-period fix)
 * dated a payment with the literal calendar date instead of the active budget
 * month, misfiling a Kotak CC payment into July's ledger when it belonged in
 * August's. Moves the expense's date, then recomputes both months using the
 * app's own recalculation functions (not hand-derived formulas) and cascades
 * the correction forward.
 *
 * Usage: npx tsx scripts/fix_kotak_cc_payment_date.ts
 */
import { createClient } from "@supabase/supabase-js";
import { updateMonthlyExpenseTotal, cascadeUpdateFutureMonths } from "../src/lib/monthly-totals";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const USER_ID = process.env.ADMIN_USER_ID!;
const EXPENSE_ID = 3427;

async function run() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: before } = await supabase
    .from("expenses")
    .select("id, date, description, amount")
    .eq("id", EXPENSE_ID)
    .eq("user_id", USER_ID)
    .single();
  console.log("Expense before:", before);
  if (!before || before.date !== "2026-07-26") {
    throw new Error("Expense not in expected state — aborting");
  }

  const { error: updateError } = await supabase
    .from("expenses")
    .update({ date: "2026-08-01" })
    .eq("id", EXPENSE_ID)
    .eq("user_id", USER_ID);
  if (updateError) throw updateError;
  console.log("Moved expense date to 2026-08-01");

  const julySummary = await updateMonthlyExpenseTotal(supabase, USER_ID, 7, 2026);
  console.log("July recomputed:", { total_expenses: julySummary?.total_expenses, remaining_amount: julySummary?.remaining_amount });

  const augSummary = await updateMonthlyExpenseTotal(supabase, USER_ID, 8, 2026);
  console.log("August recomputed (pre-cascade):", { total_expenses: augSummary?.total_expenses, remaining_amount: augSummary?.remaining_amount });

  await cascadeUpdateFutureMonths(supabase, USER_ID, 7, 2026, {
    remaining_amount: Number(julySummary?.remaining_amount ?? 0),
    savings_fd: Number(julySummary?.savings_fd ?? 0),
    savings_sip: Number(julySummary?.savings_sip ?? 0),
    savings_shares: Number(julySummary?.savings_shares ?? 0),
    savings_nps: Number(julySummary?.savings_nps ?? 0),
    savings_pf: Number(julySummary?.savings_pf ?? 0),
  });
  console.log("Cascaded forward from July");

  const { data: after } = await supabase
    .from("monthly_summary")
    .select("month, year, total_expenses, remaining_amount, previous_month_remaining")
    .eq("user_id", USER_ID)
    .in("month", [7, 8, 9])
    .eq("year", 2026)
    .order("month");
  console.log("Final state (Jul/Aug/Sep 2026):", after);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
