import { requireAuth } from "@/lib/auth-guard";

export const revalidate = 0;

export async function GET() {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  // Get total from SIP Funds (LIVE)
  const { data: sipData, error: sipError } = await supabase
    .from("sip_funds")
    .select("units, current_nav")
    .eq("user_id", user.id);

  // Get total from Stock Holdings (LIVE)
  const { data: stockData, error: stockError } = await supabase
    .from("stock_holdings")
    .select("shares, current_price")
    .eq("user_id", user.id);

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
  });
}
