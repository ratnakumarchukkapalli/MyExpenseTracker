import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { RETIREMENT_DEFAULTS } from "@/lib/retirement";
import { RetirementPlanUpdateSchema } from "@/lib/schemas/retirement";
import { NextRequest } from "next/server";

// GET /api/retirement-plan — auto-creates a default row on first load
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("retirement_plan")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  if (data) return Response.json(data);

  const { data: created, error: insertError } = await supabase
    .from("retirement_plan")
    .insert({
      user_id: user.id,
      birth_year: new Date().getFullYear() - 30,
      ...RETIREMENT_DEFAULTS,
    })
    .select()
    .single();

  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });
  return Response.json(created, { status: 201 });
}

// PUT /api/retirement-plan
export async function PUT(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = RetirementPlanUpdateSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error: dbError } = await supabase
    .from("retirement_plan")
    .upsert({ ...parsed.data, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select()
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data);
}
