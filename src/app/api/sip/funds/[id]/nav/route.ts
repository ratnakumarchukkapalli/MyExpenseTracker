import { requireAuth } from "@/lib/auth-guard";
import { syncSIPToMonthlySummary } from "@/lib/sync-portfolio";
import { after } from "next/server";
import { NextRequest } from "next/server";

// PUT /api/sip/funds/[id]/nav — update current_nav and last_nav_update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const fundId = parseInt(id, 10);
  if (isNaN(fundId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body?.currentNav) return Response.json({ error: "currentNav required" }, { status: 400 });

  // Read current NAV before overwriting so we can store it as prev_nav
  const { data: existing } = await supabase
    .from("sip_funds")
    .select("current_nav")
    .eq("user_id", user.id)
    .eq("id", fundId)
    .maybeSingle();

  const updatePayload: Record<string, unknown> = {
    current_nav: body.currentNav,
    last_nav_update: body.lastNavUpdate ?? new Date().toISOString().split("T")[0],
  };
  if (existing?.current_nav != null && Number(existing.current_nav) > 0) {
    updatePayload.prev_nav = existing.current_nav;
  }

  const { error: dbError } = await supabase
    .from("sip_funds")
    .update(updatePayload)
    .eq("user_id", user.id)
    .eq("id", fundId);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  // Sync SIP portfolio value in background — don't block the response
  after(async () => {
    await syncSIPToMonthlySummary(supabase, user.id);
  });


  return Response.json({ success: true });
}
