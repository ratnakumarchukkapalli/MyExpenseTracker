import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
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

  // Insert transaction AND fetch fund totals in parallel
  const [txnResult, fundResult] = await Promise.all([
    supabase
      .from("sip_transactions")
      .insert({
        user_id:          user.id,
        fund_id:          body.fundId,
        transaction_date: body.date,
        units:            body.units,
        purchase_nav:     body.nav,
        amount:           body.amount,
        transaction_type: body.type ?? "SIP",
      })
      .select()
      .single(),
    supabase
      .from("sip_funds")
      .select("units, invested_value")
      .eq("user_id", user.id)
      .eq("id", body.fundId)
      .single(),
  ]);

  if (txnResult.error) return Response.json({ error: txnResult.error.message }, { status: 500 });

  // Update fund totals with fetched values
  if (fundResult.data) {
    await supabase
      .from("sip_funds")
      .update({
        units:          (fundResult.data.units ?? 0) + body.units,
        invested_value: (fundResult.data.invested_value ?? 0) + body.amount,
      })
      .eq("user_id", user.id)
      .eq("id", body.fundId);
  }

  // Chain Reaction: Sync wealth snapshot for the month of the transaction
  const txnDate = new Date(body.date);
  const m = txnDate.getMonth() + 1;
  const y = txnDate.getFullYear();

  after(async () => {
    const { syncMonthlyWealthSnapshot } = await import("@/lib/monthly-totals");
    await syncMonthlyWealthSnapshot(supabase, user.id, m, y);
  });

  return Response.json({ id: txnResult.data.id }, { status: 201 });
}
