import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

// GET /api/sip/nav-history?schemeCode=123456
// Returns last 365 entries ordered by nav_date ASC
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const schemeCode = request.nextUrl.searchParams.get("schemeCode");
  if (!schemeCode) return Response.json({ error: "schemeCode required" }, { status: 400 });

  const { data, error: dbError } = await supabase
    .from("nav_history")
    .select("nav_date, nav_value")
    .eq("user_id", user.id)
    .eq("scheme_code", schemeCode)
    .order("nav_date", { ascending: true })
    .limit(365);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? []);
}

// POST /api/sip/nav-history — bulk upsert NAV entries
// Body: { schemeCode: string, navData: [{ date: string, nav: string|number }] }
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body?.schemeCode || !Array.isArray(body?.navData)) {
    return Response.json({ error: "schemeCode and navData[] required" }, { status: 400 });
  }

  const rows = body.navData
    .filter((d: { date: string; nav: string | number }) => d.date && !isNaN(parseFloat(String(d.nav))))
    .map((d: { date: string; nav: string | number }) => ({
      user_id:     user.id,
      scheme_code: body.schemeCode,
      nav_date:    d.date,
      nav_value:   parseFloat(String(d.nav)),
    }));

  if (!rows.length) return Response.json({ inserted: 0 });

  const { error: dbError } = await supabase
    .from("nav_history")
    .upsert(rows, { onConflict: "user_id,scheme_code,nav_date", ignoreDuplicates: true });

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ inserted: rows.length });
}
