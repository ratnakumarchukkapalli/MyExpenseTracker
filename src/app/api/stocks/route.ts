import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { NextRequest, after } from "next/server";
import { z } from "zod";

const StockSchema = z.object({
  ticker:        z.string().min(1).max(20).regex(/^[A-Z0-9&.-]+$/i, "Invalid ticker"),
  company_name:  z.string().min(1).max(200),
  shares:        z.number().positive("shares must be positive"),
  buy_price:     z.number().positive("buy_price must be positive"),
  buy_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  current_price: z.number().positive().optional().nullable(),
  notes:         z.string().max(500).optional().nullable(),
  av_symbol:     z.string().max(30).optional().nullable(),
});

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

  const raw = await request.json().catch(() => null);
  const parsed = StockSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const body = parsed.data;

  const { data, error: dbError } = await supabase
    .from("stock_holdings")
    .insert({
      user_id:       user.id,
      ticker:        body.ticker.toUpperCase(),
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
