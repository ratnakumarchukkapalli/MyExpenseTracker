import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

// GET /api/stocks — all holdings ordered by created_at ASC
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("stock_holdings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? []);
}

// POST /api/stocks — add a new holding
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body?.ticker || !body?.company_name || !body?.shares || !body?.buy_price) {
    return Response.json(
      { error: "ticker, company_name, shares, buy_price required" },
      { status: 400 }
    );
  }

  const { data, error: dbError } = await supabase
    .from("stock_holdings")
    .insert({
      user_id:       user.id,
      ticker:        body.ticker,
      company_name:  body.company_name,
      shares:        body.shares,
      buy_price:     body.buy_price,
      buy_date:      body.buy_date ?? null,
      current_price: body.current_price ?? null,
      notes:         body.notes ?? null,
      av_symbol:     body.av_symbol ?? null,
    })
    .select()
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  // Chain Reaction: Sync wealth snapshot for the provided month/year
  const { searchParams } = request.nextUrl;
  const m = parseInt(searchParams.get("month") || "", 10);
  const y = parseInt(searchParams.get("year") || "", 10);

  if (m && y) {
    after(async () => {
      const { syncMonthlyWealthSnapshot } = await import("@/lib/monthly-totals");
      await syncMonthlyWealthSnapshot(supabase, user.id, m, y);
    });
  }

  return Response.json({ id: data.id }, { status: 201 });
}
