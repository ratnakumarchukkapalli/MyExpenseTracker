import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { CreditCardSchema } from "@/lib/schemas/credit-card";
import { NextRequest } from "next/server";

// GET /api/credit-cards
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("credit_cards")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  return Response.json(data ?? [], {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}

// POST /api/credit-cards
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = CreditCardSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error: dbError } = await supabase
    .from("credit_cards")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
