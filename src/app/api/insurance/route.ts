import { requireAuth } from "@/lib/auth-guard";
import { InsuranceSchema } from "@/lib/schemas/insurance";
import { NextRequest } from "next/server";

// GET /api/insurance
export async function GET() {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("insurance_policies")
    .select("*")
    .eq("user_id", user.id)
    .order("type")
    .order("next_due_date");

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? [], {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
  });
}

// POST /api/insurance
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = InsuranceSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error: dbError } = await supabase
    .from("insurance_policies")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ id: data.id }, { status: 201 });
}
