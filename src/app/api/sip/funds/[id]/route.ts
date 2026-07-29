import { requireAuth } from "@/lib/auth-guard";
import { NextRequest, after } from "next/server";

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
