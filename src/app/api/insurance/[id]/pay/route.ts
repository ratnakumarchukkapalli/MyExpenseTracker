import { requireAuth } from "@/lib/auth-guard";
import { updateMonthlyExpenseTotal, cascadeUpdateFutureMonths } from "@/lib/monthly-totals";
import { adjustBankAccountBalance } from "@/lib/bank-accounts";
import { after, NextRequest } from "next/server";

function advanceDueDate(dueDate: string, premiumMode: string | null) {
  const due = new Date(dueDate);
  switch (premiumMode) {
    case "monthly":    due.setMonth(due.getMonth() + 1); break;
    case "quarterly":  due.setMonth(due.getMonth() + 3); break;
    case "biennial":   due.setFullYear(due.getFullYear() + 2); break;
    default:           due.setFullYear(due.getFullYear() + 1); break; // yearly / single
  }
  return due.toISOString().split("T")[0];
}

// POST /api/insurance/[id]/pay — record the premium as an expense and advance next_due_date
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const policyId = Number(id);

  const { data: policy } = await supabase
    .from("insurance_policies")
    .select("name, insurer, premium_amount, premium_mode, next_due_date, last_paid_date, bank_account_id")
    .eq("id", policyId)
    .eq("user_id", user.id)
    .single();

  if (!policy) return Response.json({ error: "Policy not found" }, { status: 404 });

  // Mirrors ExpenseForm's defaultDate rule / loans + subscriptions pay routes: if
  // the caller is viewing a month other than the real current one (e.g. paying a
  // premium during the salary-transition week while already on next month's tab),
  // file it under that viewed month instead of literal "today" — otherwise it
  // silently lands in the wrong month's spend.
  const body = await req.json().catch(() => null);
  const viewedMonth = Number(body?.month);
  const viewedYear = Number(body?.year);
  const today = new Date();
  const hasViewedMonth = Number.isInteger(viewedMonth) && Number.isInteger(viewedYear);
  const isViewingRealCurrentMonth =
    viewedMonth === today.getMonth() + 1 && viewedYear === today.getFullYear();

  const paidDate =
    hasViewedMonth && !isViewingRealCurrentMonth
      ? `${viewedYear}-${String(viewedMonth).padStart(2, "0")}-01`
      : today.toISOString().split("T")[0];

  // Prevent duplicate payments on the same day (the card's mark-paid button and
  // the overdue/due-soon banners all hit this route)
  if (policy.last_paid_date === paidDate) {
    return Response.json({ error: "Premium already marked as paid today" }, { status: 400 });
  }

  const newDueDate = policy.next_due_date
    ? advanceDueDate(policy.next_due_date, policy.premium_mode)
    : null;

  // 1. Create the expense first (so it's deducted from balance) — its id gets
  //    linked into the payment record below, so "Undo Payment" can find and
  //    remove the exact expense it created.
  const expenseRes = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      amount: policy.premium_amount,
      date: paidDate,
      description: `Insurance: ${policy.name || policy.insurer}`,
      category: "MonthlyBills",
      note: "Paid via insurance tracker",
      payment_source: "bank",
      bank_account_id: policy.bank_account_id ?? null,
    })
    .select()
    .single();

  if (expenseRes.error) return Response.json({ error: expenseRes.error.message }, { status: 500 });

  if (policy.bank_account_id) {
    await adjustBankAccountBalance(supabase, user.id, policy.bank_account_id, -Number(policy.premium_amount));
  }

  // 2. Insert payment record (linked to the expense)
  // 3. Advance the policy's due date
  const [payResult, updateResult] = await Promise.all([
    supabase
      .from("insurance_payments")
      .insert({
        policy_id: policyId,
        user_id: user.id,
        amount: policy.premium_amount,
        paid_date: paidDate,
        prev_due_date: policy.next_due_date,
        expense_id: expenseRes.data.id,
      })
      .select()
      .single(),
    supabase
      .from("insurance_policies")
      .update({ next_due_date: newDueDate, last_paid_date: paidDate })
      .eq("id", policyId)
      .eq("user_id", user.id),
  ]);

  if (payResult.error) return Response.json({ error: payResult.error.message }, { status: 500 });
  if (updateResult.error) return Response.json({ error: updateResult.error.message }, { status: 500 });

  // Update monthly summary so the cash balance reflects this expense
  const paidMonth = new Date(paidDate).getMonth() + 1;
  const paidYear = new Date(paidDate).getFullYear();

  const updatedSummary = await updateMonthlyExpenseTotal(supabase, user.id, paidMonth, paidYear);

  after(async () => {
    await cascadeUpdateFutureMonths(supabase, user.id, paidMonth, paidYear, {
      remaining_amount: Number(updatedSummary?.remaining_amount ?? 0),
      savings_fd:       Number(updatedSummary?.savings_fd ?? 0),
      savings_sip:      Number(updatedSummary?.savings_sip ?? 0),
      savings_shares:   Number(updatedSummary?.savings_shares ?? 0),
      savings_nps:      Number(updatedSummary?.savings_nps ?? 0),
      savings_pf:       Number(updatedSummary?.savings_pf ?? 0),
    });
  });

  return Response.json({ id: payResult.data.id, paid_date: paidDate, newDueDate }, { status: 201 });
}

// DELETE /api/insurance/[id]/pay — undo the most recent premium payment
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const policyId = Number(id);

  const { data: policy } = await supabase
    .from("insurance_policies")
    .select("premium_mode, next_due_date")
    .eq("id", policyId)
    .eq("user_id", user.id)
    .single();

  if (!policy) return Response.json({ error: "Policy not found" }, { status: 404 });

  // Most recent payment is the one to undo; the one before it (if any) is what
  // last_paid_date should revert to.
  const { data: payments } = await supabase
    .from("insurance_payments")
    .select("id, paid_date, prev_due_date, expense_id")
    .eq("policy_id", policyId)
    .eq("user_id", user.id)
    .order("paid_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(2);

  if (!payments || payments.length === 0) {
    return Response.json({ error: "No payment to undo" }, { status: 400 });
  }

  const [latest, previous] = payments;
  const restoredLastPaid = previous ? previous.paid_date : null;
  // prev_due_date is what Pay Now overwrote; fall back to reversing the interval
  // for rows written before that column existed.
  let restoredDueDate = latest.prev_due_date ?? policy.next_due_date;
  if (!latest.prev_due_date && policy.next_due_date) {
    const due = new Date(policy.next_due_date);
    switch (policy.premium_mode) {
      case "monthly":    due.setMonth(due.getMonth() - 1); break;
      case "quarterly":  due.setMonth(due.getMonth() - 3); break;
      case "biennial":   due.setFullYear(due.getFullYear() - 2); break;
      default:           due.setFullYear(due.getFullYear() - 1); break;
    }
    restoredDueDate = due.toISOString().split("T")[0];
  }

  // Fetch the linked expense before deleting it, so its bank account charge can be reversed
  let expenseToReverse: { amount: number; payment_source: string | null; bank_account_id: number | null } | null = null;
  if (latest.expense_id) {
    const { data } = await supabase
      .from("expenses")
      .select("amount, payment_source, bank_account_id")
      .eq("id", latest.expense_id)
      .eq("user_id", user.id)
      .maybeSingle();
    expenseToReverse = data;
  }

  const tasks: PromiseLike<unknown>[] = [
    supabase
      .from("insurance_policies")
      .update({ last_paid_date: restoredLastPaid, next_due_date: restoredDueDate })
      .eq("id", policyId)
      .eq("user_id", user.id),
    supabase
      .from("insurance_payments")
      .delete()
      .eq("id", latest.id)
      .eq("user_id", user.id),
  ];

  if (latest.expense_id) {
    tasks.push(
      supabase.from("expenses").delete().eq("id", latest.expense_id).eq("user_id", user.id)
    );
  }

  const results = (await Promise.all(tasks)) as { error?: { message: string } | null }[];
  const dbError = results.find((r) => r?.error)?.error;
  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  if (expenseToReverse?.payment_source === "bank" && expenseToReverse.bank_account_id) {
    await adjustBankAccountBalance(supabase, user.id, expenseToReverse.bank_account_id, Number(expenseToReverse.amount));
  }

  // Recalc monthly summary for the month the undone expense fell in
  if (latest.expense_id) {
    const paidMonth = new Date(latest.paid_date).getMonth() + 1;
    const paidYear = new Date(latest.paid_date).getFullYear();

    const updatedSummary = await updateMonthlyExpenseTotal(supabase, user.id, paidMonth, paidYear);

    after(async () => {
      await cascadeUpdateFutureMonths(supabase, user.id, paidMonth, paidYear, {
        remaining_amount: Number(updatedSummary?.remaining_amount ?? 0),
        savings_fd:       Number(updatedSummary?.savings_fd ?? 0),
        savings_sip:      Number(updatedSummary?.savings_sip ?? 0),
        savings_shares:   Number(updatedSummary?.savings_shares ?? 0),
        savings_nps:      Number(updatedSummary?.savings_nps ?? 0),
        savings_pf:       Number(updatedSummary?.savings_pf ?? 0),
      });
    });
  }

  return Response.json({ last_paid_date: restoredLastPaid, next_due_date: restoredDueDate });
}

// GET /api/insurance/[id]/pay — payment history
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const { data, error: dbError } = await supabase
    .from("insurance_payments")
    .select("*")
    .eq("policy_id", Number(id))
    .eq("user_id", user.id)
    .order("paid_date", { ascending: false });

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? []);
}
