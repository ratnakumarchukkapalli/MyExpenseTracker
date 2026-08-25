import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { SubscriptionSchema } from "@/lib/schemas/subscription";
import { NextRequest } from "next/server";

// GET /api/subscriptions
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data: rows, error: dbError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  return Response.json(rows ?? [], {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}

// POST /api/subscriptions
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = SubscriptionSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error: dbError } = await supabase
    .from("subscriptions")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ id: data.id }, { status: 201 });
}
