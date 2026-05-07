import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { NextRequest, after } from "next/server";
import { z } from "zod";

const SipFundSchema = z.object({
  fund_name:      z.string().min(1).max(300),
  scheme_code:    z.string().max(20).optional().nullable(),
  folio_number:   z.string().max(50).optional().nullable(),
  fund_type:      z.enum(["active", "historical"]).default("active"),
  units:          z.number().nonnegative(),
  invested_value: z.number().nonnegative(),
  current_nav:    z.number().positive().optional().nullable(),
  sip_amount:     z.number().nonnegative().optional().nullable(),
});

// GET /api/sip/funds
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("sip_funds")
    .select("*")
    .eq("user_id", user.id)
    .order("fund_type", { ascending: true })
    .order("fund_name", { ascending: true });

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? []);
}

// POST /api/sip/funds — manually add a fund
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const raw = await request.json().catch(() => null);
  const parsed = SipFundSchema.safeParse(raw);
  if (!parsed.success)
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { data, error: dbError } = await supabase
    .from("sip_funds")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  after(async () => {
    const { syncMonthlyWealthSnapshot } = await import("@/lib/monthly-totals");
    await syncMonthlyWealthSnapshot(supabase, user.id, m, y);
  });

  return Response.json({ id: data.id }, { status: 201 });
}
