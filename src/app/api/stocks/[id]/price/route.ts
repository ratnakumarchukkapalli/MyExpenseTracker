import { requireAuth } from "@/lib/auth-guard";
import { syncStocksToMonthlySummary } from "@/lib/sync-portfolio";
import { after } from "next/server";
import { NextRequest } from "next/server";

// PUT /api/stocks/[id]/price — update current_price and last_updated=today
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const holdingId = parseInt(id, 10);
  if (isNaN(holdingId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (body?.price == null) return Response.json({ error: "price required" }, { status: 400 });

  const { error: dbError } = await supabase
    .from("stock_holdings")
    .update({
      current_price: body.price,
      last_updated:  new Date().toISOString().split("T")[0],
    })
    .eq("user_id", user.id)
    .eq("id", holdingId);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  // Sync portfolio value to monthly_summary in background — don't block response
  after(async () => {
    await syncStocksToMonthlySummary(supabase, user.id);
  });


  return Response.json({ success: true });
}
