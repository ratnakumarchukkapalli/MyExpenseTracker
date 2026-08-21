import { requireAuth } from "@/lib/auth-guard";
import { NextRequest, after } from "next/server";
import { z } from "zod";

const SipFundUpdateSchema = z.object({
  fund_name:      z.string().min(1).max(300),
  scheme_code:    z.string().max(20).optional().nullable(),
  folio_number:   z.string().max(50).optional().nullable(),
  fund_type:      z.enum(["active", "historical"]),
  units:          z.number().nonnegative(),
  invested_value: z.number().nonnegative(),
  current_nav:    z.number().positive().optional().nullable(),
  sip_amount:     z.number().nonnegative().optional().nullable(),
});

// PUT /api/sip/funds/[id] — edit fund details (e.g. re-link a wrong/stale AMFI
// scheme code). There was previously no way to fix a fund's scheme code short
// of deleting and re-adding it, so a fund matched to a retired/incorrect code
// during import would silently stop getting live NAVs forever.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const fundId = parseInt(id, 10);
  if (isNaN(fundId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  const raw = await request.json().catch(() => null);
  const parsed = SipFundUpdateSchema.safeParse(raw);
  if (!parsed.success)
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { error: dbError } = await supabase
    .from("sip_funds")
    .update(parsed.data)
    .eq("user_id", user.id)
    .eq("id", fundId);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  // Units/invested_value/current_nav can also be hand-corrected here, so
  // resync the live total the same way POST /api/sip/funds does.
  after(async () => {
    const { syncMonthlyWealthSnapshot, getActiveBudgetMonth } = await import("@/lib/monthly-totals");
    const { month, year } = await getActiveBudgetMonth(supabase, user.id);
    await syncMonthlyWealthSnapshot(supabase, user.id, month, year);
  });

  return Response.json({ success: true });
}

// DELETE /api/sip/funds/[id] — deletes fund (cascade removes transactions via FK)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const fundId = parseInt(id, 10);
  if (isNaN(fundId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  // Delete transactions first (in case FK cascade is not enforced)
  await supabase
    .from("sip_transactions")
    .delete()
    .eq("user_id", user.id)
    .eq("fund_id", fundId);

  const { error: dbError } = await supabase
    .from("sip_funds")
    .delete()
    .eq("user_id", user.id)
    .eq("id", fundId);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  // Active budget month, not the calendar month — see POST /api/sip/funds.
  after(async () => {
    const { syncMonthlyWealthSnapshot, getActiveBudgetMonth } = await import("@/lib/monthly-totals");
    const { month, year } = await getActiveBudgetMonth(supabase, user.id);
    await syncMonthlyWealthSnapshot(supabase, user.id, month, year);
  });

  return Response.json({ success: true });
}
