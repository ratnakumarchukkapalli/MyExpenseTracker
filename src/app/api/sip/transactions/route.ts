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

  // Chain Reaction: Sync wealth snapshot for the month of the transaction
  const txnDate = new Date(body.date);
  const m = txnDate.getMonth() + 1;
  const y = txnDate.getFullYear();

  after(async () => {
    const { syncMonthlyWealthSnapshot } = await import("@/lib/monthly-totals");
    await syncMonthlyWealthSnapshot(supabase, user.id, m, y);
  });

  return Response.json({ id: txnId }, { status: 201 });
}
