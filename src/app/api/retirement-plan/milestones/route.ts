import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { RetirementMilestoneSchema } from "@/lib/schemas/retirement";
import { NextRequest } from "next/server";

// GET /api/retirement-plan/milestones
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("retirement_milestones")
    .select("*")
    .eq("user_id", user.id)
    .order("target_year");

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? []);
}

// POST /api/retirement-plan/milestones
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = RetirementMilestoneSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error: dbError } = await supabase
    .from("retirement_milestones")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
