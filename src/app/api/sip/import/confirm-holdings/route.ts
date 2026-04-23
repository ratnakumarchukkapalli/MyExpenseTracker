import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

interface FundInput {
  fundName: string;
  schemeCode?: string | null;
  folio?: string;
  units: number;
  investedValue: number;
  currentValue: number;
}

// POST /api/sip/import/confirm-holdings
// Body: { funds: [{ fundName, schemeCode, folio, units, investedValue, currentValue }] }
// Upserts each fund to sip_funds (inserts if not exists by fund_name+folio)
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.funds)) {
    return Response.json({ error: "funds[] required" }, { status: 400 });
  }

  const funds = body.funds as FundInput[];

  // Fetch all existing funds for this user upfront (one query instead of N queries)
  const { data: existingFunds } = await supabase
    .from("sip_funds")
    .select("id, fund_name, folio_number")
    .eq("user_id", user.id);

  const existingMap = new Map(
    (existingFunds ?? []).map((f) => [`${f.fund_name}||${f.folio_number ?? ""}`, f.id])
  );

  const toInsert: object[] = [];
  const toUpdate: { id: number; data: object }[] = [];

  for (const f of funds) {
    const currentNav = f.units > 0 ? parseFloat((f.currentValue / f.units).toFixed(4)) : null;
    const key = `${f.fundName}||${f.folio ?? ""}`;
    const existingId = existingMap.get(key);

    if (existingId) {
      toUpdate.push({
        id: existingId,
        data: { scheme_code: f.schemeCode ?? null, units: f.units, invested_value: f.investedValue, current_nav: currentNav },
      });
    } else {
      toInsert.push({
        user_id: user.id, fund_name: f.fundName, scheme_code: f.schemeCode ?? null,
        folio_number: f.folio ?? null, fund_type: "active",
        units: f.units, invested_value: f.investedValue, current_nav: currentNav,
      });
    }
  }

  // Run all inserts and updates in parallel
  await Promise.all([
    toInsert.length > 0 ? supabase.from("sip_funds").insert(toInsert) : Promise.resolve(),
    ...toUpdate.map(({ id, data }) =>
      supabase.from("sip_funds").update(data).eq("id", id).eq("user_id", user.id)
    ),
  ]);

  return Response.json({ saved: funds.length });
}
