import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { recordSipTransaction } from "@/lib/sip-transactions";
import { NextRequest, after } from "next/server";

// GET /api/sip/transactions?fundId=123
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const fundId = request.nextUrl.searchParams.get("fundId");
  if (!fundId) return Response.json({ error: "fundId required" }, { status: 400 });

  const { data, error: dbError } = await supabase
    .from("sip_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("fund_id", parseInt(fundId, 10))
    .order("transaction_date", { ascending: true });

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? []);
}

// POST /api/sip/transactions — log a new SIP installment and update fund totals
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body?.fundId || !body?.date || !body?.amount || !body?.nav || !body?.units) {
    return Response.json({ error: "fundId, date, amount, nav, units required" }, { status: 400 });
  }

  let txnId: number;
  try {
    txnId = await recordSipTransaction(supabase, user.id, {
      fundId: body.fundId,
      date:   body.date,
      units:  body.units,
      nav:    body.nav,
      amount: body.amount,
      type:   body.type,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  // Chain Reaction: sync live totals into the active budget month, not the
  // transaction's own date. Only the active budget month owns live values —
  // the two diverge for the last week of every month under the 25th-salary
  // workflow (see syncSIPToMonthlySummary) — and syncMonthlyWealthSnapshot
  // recomputes the whole live sip_funds total regardless of which
  // transaction triggered it, so the target month must be the active one or
  // the sync silently no-ops and the logged SIP never reaches the dashboard.
  after(async () => {
    const { syncMonthlyWealthSnapshot, getActiveBudgetMonth } = await import("@/lib/monthly-totals");
    const { month, year } = await getActiveBudgetMonth(supabase, user.id);
    await syncMonthlyWealthSnapshot(supabase, user.id, month, year);
  });

  return Response.json({ id: txnId }, { status: 201 });
}
