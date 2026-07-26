import { requireAuth } from "@/lib/auth-guard";
import { updateMonthlyExpenseTotal, cascadeUpdateFutureMonths } from "@/lib/monthly-totals";
import { adjustBankAccountBalance } from "@/lib/bank-accounts";
import { after, NextRequest } from "next/server";

// POST /api/loans/[id]/pay — record this month's EMI as an expense
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const loanId = Number(id);

  const { data: loan } = await supabase
    .from("loans")
    .select("name, amount, status, bank_account_id")
    .eq("id", loanId)
    .eq("user_id", user.id)
    .single();

  if (!loan) return Response.json({ error: "Not found" }, { status: 404 });

  // Mirrors ExpenseForm's defaultDate rule / subscriptions' pay route: if the
  // caller is viewing a month other than the real current one (e.g. paying
  // during the salary-transition week while already on next month's tab),
  // file it under that viewed month instead of literal "today" — otherwise
  // it silently lands in the wrong month's spend.
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
  const paidMonth = hasViewedMonth && !isViewingRealCurrentMonth ? viewedMonth : today.getMonth() + 1;
  const paidYear = hasViewedMonth && !isViewingRealCurrentMonth ? viewedYear : today.getFullYear();
  const monthStart = `${paidYear}-${String(paidMonth).padStart(2, "0")}-01`;
  const nextMonthStart = paidMonth === 12
    ? `${paidYear + 1}-01-01`
    : `${paidYear}-${String(paidMonth + 1).padStart(2, "0")}-01`;
  const description = `Loan EMI: ${loan.name}`;

  // One EMI per loan per calendar month — the expense row is the payment record
  const { data: existing } = await supabase
    .from("expenses")
    .select("id")
    .eq("user_id", user.id)
    .eq("description", description)
    .gte("date", monthStart)
    .lt("date", nextMonthStart)
    .limit(1);

  if (existing && existing.length > 0) {
    return Response.json({ error: "EMI already paid this month" }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("expenses").insert({
    user_id: user.id,
    amount: loan.amount,
    date: paidDate,
    description,
    category: "LOANS/CC",
    note: "Paid via loan tracker",
    payment_source: "bank",
    bank_account_id: loan.bank_account_id ?? null,
  });

  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  if (loan.bank_account_id) {
    await adjustBankAccountBalance(supabase, user.id, loan.bank_account_id, -Number(loan.amount));
  }

  // Update monthly summary so the cash balance reflects this expense
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

  return Response.json({ paid_date: paidDate }, { status: 201 });
}
