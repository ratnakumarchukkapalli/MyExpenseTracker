import { requireAuthFast } from "@/lib/auth-guard";

export const revalidate = 0;

export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const [sipResponse, stockResponse] = await Promise.all([
    supabase.from("sip_funds").select("units, current_nav").eq("user_id", user.id),
    supabase.from("stock_holdings").select("shares, current_price").eq("user_id", user.id)
  ]);

  const { data: sipData, error: sipError } = sipResponse;
  const { data: stockData, error: stockError } = stockResponse;

  if (sipError || stockError) {
    return Response.json({ error: "Failed to fetch portfolio data" }, { status: 500 });
  }

  const sipTotal = (sipData ?? []).reduce((sum, f) => sum + (Number(f.units || 0) * Number(f.current_nav || 0)), 0);
  const stockTotal = (stockData ?? []).reduce((sum, s) => sum + (Number(s.shares || 0) * Number(s.current_price || 0)), 0);

  // Return ONLY the live portfolio sum
  return Response.json({
    live_portfolio_total: sipTotal + stockTotal,
    breakdown: {
      sip: sipTotal,
      stocks: stockTotal
    }
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
