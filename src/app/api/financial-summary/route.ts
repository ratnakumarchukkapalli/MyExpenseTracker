import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { z } from "zod";
import { NextRequest } from "next/server";

const FinancialSummarySchema = z.object({
  fd_amount:     z.number().min(0).default(0),
  sip_amount:    z.number().min(0).default(0),
  shares_amount: z.number().min(0).default(0),
  nps_amount:    z.number().min(0).default(0),
  pf_amount:     z.number().min(0).default(0),
  month:         z.number().int().min(1).max(12),
  year:          z.number().int().min(2000),
});

// GET /api/financial-summary?month=4&year=2026
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const month = Number(searchParams.get("month"));
  const year  = Number(searchParams.get("year"));

  let query = supabase
    .from("financial_summary")
    .select("*")
    .eq("user_id", user.id);

  if (month && year) {
    query = query.eq("month", month).eq("year", year);
  } else {
    query = query.order("year", { ascending: false }).order("month", { ascending: false }).limit(1);
  }

  const { data, error: dbError } = await query.maybeSingle();
  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  return Response.json(data ?? {
    fd_amount: 0, sip_amount: 0, shares_amount: 0, nps_amount: 0, pf_amount: 0,
  });
}

// POST /api/financial-summary — upsert for month/year
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = FinancialSummarySchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { error: dbError } = await supabase
    .from("financial_summary")
    .upsert(
      { ...parsed.data, user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id,month,year" }
    );

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ ok: true });
}
