import { requireAuth } from "@/lib/auth-guard";
import { updateMonthlyExpenseTotal, cascadeUpdateFutureMonths } from "@/lib/monthly-totals";
import { adjustBankAccountBalance } from "@/lib/bank-accounts";
import { after, NextRequest } from "next/server";

// POST /api/subscriptions/[id]/pay
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const subId = Number(id);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("amount, billing_type, renewal_date, name, category, last_paid_date, bank_account_id")
    .eq("id", subId)
    .eq("user_id", user.id)
    .single();

  if (!sub) return Response.json({ error: "Not found" }, { status: 404 });

  const paidDate = new Date().toISOString().split("T")[0];

  // Prevent duplicate payments on the same day
  if (sub.last_paid_date === paidDate) {
    return Response.json({ error: "Subscription already marked as paid today" }, { status: 400 });
  }
  
  // Calculate next renewal date
  let nextRenewal = sub.renewal_date;
  if (sub.renewal_date) {
    const d = new Date(sub.renewal_date);
    if (sub.billing_type === "monthly") {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setFullYear(d.getFullYear() + 1);
    }
    nextRenewal = d.toISOString().split("T")[0];
  }

  // 1. Create the expense record first (so it's deducted from balance) — its id
  //    gets linked into the payment record below, so "Undo Payment" can find and
  //    remove the exact expense it created instead of relying on manual cleanup.
  const expenseRes = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      amount: sub.amount,
      date: paidDate,
      description: `Subscription: ${sub.name}`,
      category: "MonthlyBills",
      note: `Paid via subscription tracker`,
      payment_source: "bank",
      bank_account_id: sub.bank_account_id ?? null,
    })
    .select()
    .single();

  if (expenseRes.error) return Response.json({ error: expenseRes.error.message }, { status: 500 });

  if (sub.bank_account_id) {
    await adjustBankAccountBalance(supabase, user.id, sub.bank_account_id, -Number(sub.amount));
  }

  // 2. Insert payment record (linked to the expense)
  // 3. Update subscription status
  const [payResult, updateResult] = await Promise.all([
    supabase
      .from("subscription_payments")
      .insert({ subscription_id: subId, user_id: user.id, amount: sub.amount, paid_date: paidDate, expense_id: expenseRes.data.id })
      .select()
      .single(),
    supabase
      .from("subscriptions")
      .update({
        last_paid_date: paidDate,
        renewal_date: nextRenewal
      })
      .eq("id", subId)
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

  return Response.json({
    id: payResult.data.id,
    paid_date: paidDate,
    next_renewal: nextRenewal
  }, { status: 201 });
}

// DELETE /api/subscriptions/[id]/pay — undo the most recent payment
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const subId = Number(id);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("billing_type, renewal_date")
    .eq("id", subId)
    .eq("user_id", user.id)
    .single();

  if (!sub) return Response.json({ error: "Not found" }, { status: 404 });

  // Most recent payment is the one to undo; the one before it (if any) is what
  // last_paid_date should revert to.
  const { data: payments } = await supabase
    .from("subscription_payments")
    .select("id, paid_date, expense_id")
    .eq("subscription_id", subId)
    .eq("user_id", user.id)
    .order("paid_date", { ascending: false })
    .limit(2);

  if (!payments || payments.length === 0) {
    return Response.json({ error: "No payment to undo" }, { status: 400 });
  }

  const [latest, previous] = payments;
  const restoredLastPaid = previous ? previous.paid_date : null;

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

  // Reverse the exact +1 cycle that Pay Now applied
  let restoredRenewal = sub.renewal_date;
  if (sub.renewal_date) {
    const d = new Date(sub.renewal_date);
    if (sub.billing_type === "monthly") {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setFullYear(d.getFullYear() - 1);
    }
    restoredRenewal = d.toISOString().split("T")[0];
  }

  const tasks: PromiseLike<any>[] = [
    supabase
      .from("subscriptions")
      .update({ last_paid_date: restoredLastPaid, renewal_date: restoredRenewal })
      .eq("id", subId)
      .eq("user_id", user.id),
    supabase
      .from("subscription_payments")
      .delete()
      .eq("id", latest.id)
      .eq("user_id", user.id),
  ];

  if (latest.expense_id) {
    tasks.push(
      supabase.from("expenses").delete().eq("id", latest.expense_id).eq("user_id", user.id)
    );
  }

  const results = await Promise.all(tasks);
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

  return Response.json({ last_paid_date: restoredLastPaid, renewal_date: restoredRenewal });
}

// GET /api/subscriptions/[id]/pay — payment history
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const { data, error: dbError } = await supabase
    .from("subscription_payments")
    .select("*")
    .eq("subscription_id", Number(id))
    .eq("user_id", user.id)
    .order("paid_date", { ascending: false });

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? []);
}
