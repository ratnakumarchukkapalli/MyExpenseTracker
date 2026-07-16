import { requireAuthFast } from "@/lib/auth-guard";
import { ExpenseUpdateSchema } from "@/lib/schemas/expense";
import { updateMonthlyExpenseTotal, cascadeUpdateFutureMonths } from "@/lib/monthly-totals";
import { adjustCreditCardBalance } from "@/lib/credit-cards";
import { adjustBankAccountBalance } from "@/lib/bank-accounts";
import { after } from "next/server";
import { NextRequest } from "next/server";

// PUT /api/expenses/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { id } = await params;
  const expenseId = Number(id);
  if (!expenseId) return Response.json({ error: "Invalid id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = ExpenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Fetch old date + card/account charge info to know which month(s) to recalculate
  // and how to reconcile credit card / bank account balances
  const { data: old } = await supabase
    .from("expenses")
    .select("date, amount, payment_source, credit_card_id, bank_account_id")
    .eq("id", expenseId)
    .eq("user_id", user.id)
    .single();

  if (!old) return Response.json({ error: "Not found" }, { status: 404 });

  const { error: dbError } = await supabase
    .from("expenses")
    .update(parsed.data)
    .eq("id", expenseId)
    .eq("user_id", user.id);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  // Reconcile credit card balances: reverse the old charge, apply the new one
  const oldCardId = old.payment_source === "credit_card" ? old.credit_card_id : null;
  const newCardId = parsed.data.payment_source === "credit_card" ? parsed.data.credit_card_id : null;
  if (oldCardId) {
    await adjustCreditCardBalance(supabase, user.id, oldCardId, -Number(old.amount));
  }
  if (newCardId) {
    await adjustCreditCardBalance(supabase, user.id, newCardId, parsed.data.amount);
  }

  // Reconcile bank account balances: reverse the old debit, apply the new one
  const oldAccountId = (old.payment_source ?? "bank") === "bank" ? old.bank_account_id : null;
  const newAccountId = (parsed.data.payment_source ?? "bank") === "bank" ? parsed.data.bank_account_id : null;
  if (oldAccountId) {
    await adjustBankAccountBalance(supabase, user.id, oldAccountId, Number(old.amount));
  }
  if (newAccountId) {
    await adjustBankAccountBalance(supabase, user.id, newAccountId, -parsed.data.amount);
  }

  // Recalculate monthly totals for both old and new month (if different)
  const newDate = new Date(parsed.data.date);
  const newMonth = newDate.getMonth() + 1;
  const newYear = newDate.getFullYear();

  const oldDate = new Date(old.date);
  const oldMonth = oldDate.getMonth() + 1;
  const oldYear = oldDate.getFullYear();

  const monthsToUpdate = [{ month: newMonth, year: newYear }];
  if (oldMonth !== newMonth || oldYear !== newYear) {
    monthsToUpdate.push({ month: oldMonth, year: oldYear });
  }

  const results = await Promise.all(
    monthsToUpdate.map(({ month, year }) =>
      updateMonthlyExpenseTotal(supabase, user.id, month, year)
    )
  );

  after(async () => {
    await Promise.all(
      monthsToUpdate.map((m, i) => {
        const summary = results[i];
        return cascadeUpdateFutureMonths(supabase, user.id, m.month, m.year, {
          remaining_amount: summary.remaining_amount,
          savings_fd: summary.savings_fd,
          savings_sip: summary.savings_sip,
          savings_shares: summary.savings_shares,
          savings_nps: summary.savings_nps,
          savings_pf: summary.savings_pf,
        });
      })
    );
  });


  return Response.json({ changes: 1 });
}

// DELETE /api/expenses/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { id } = await params;
  const expenseId = Number(id);
  if (!expenseId) return Response.json({ error: "Invalid id" }, { status: 400 });

  // Delete and return date/amount/card/account info in a single query (Round-trip 1)
  const { data: deleted, error: dbError } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("user_id", user.id)
    .select("date, amount, payment_source, credit_card_id, bank_account_id")
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  if (!deleted) return Response.json({ changes: 0 });

  if (deleted.payment_source === "credit_card" && deleted.credit_card_id) {
    await adjustCreditCardBalance(supabase, user.id, deleted.credit_card_id, -Number(deleted.amount));
  }
  if ((deleted.payment_source ?? "bank") === "bank" && deleted.bank_account_id) {
    await adjustBankAccountBalance(supabase, user.id, deleted.bank_account_id, Number(deleted.amount));
  }

  const expenseDate = new Date(deleted.date);
  const m = expenseDate.getMonth() + 1;
  const y = expenseDate.getFullYear();

  const updatedSummary = await updateMonthlyExpenseTotal(supabase, user.id, m, y);

  after(async () => {
    await cascadeUpdateFutureMonths(supabase, user.id, m, y, {
      remaining_amount: updatedSummary.remaining_amount,
      savings_fd: updatedSummary.savings_fd,
      savings_sip: updatedSummary.savings_sip,
      savings_shares: updatedSummary.savings_shares,
      savings_nps: updatedSummary.savings_nps,
      savings_pf: updatedSummary.savings_pf,
    });
  });


  return Response.json({ changes: 1 });
}
