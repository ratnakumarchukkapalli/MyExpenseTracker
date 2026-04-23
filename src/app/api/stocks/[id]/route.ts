import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

// PUT /api/stocks/[id] — update holding fields
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
  if (!body) return Response.json({ error: "Body required" }, { status: 400 });

  const allowedFields = ["ticker", "company_name", "shares", "buy_price", "buy_date", "notes", "av_symbol"];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  if (!Object.keys(updates).length) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error: dbError } = await supabase
    .from("stock_holdings")
    .update(updates)
    .eq("user_id", user.id)
    .eq("id", holdingId);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ success: true });
}

// DELETE /api/stocks/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const holdingId = parseInt(id, 10);
  if (isNaN(holdingId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  const { error: dbError } = await supabase
    .from("stock_holdings")
    .delete()
    .eq("user_id", user.id)
    .eq("id", holdingId);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ success: true });
}
