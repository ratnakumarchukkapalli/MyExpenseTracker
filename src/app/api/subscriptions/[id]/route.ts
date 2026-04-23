import { requireAuth } from "@/lib/auth-guard";
import { SubscriptionSchema } from "@/lib/schemas/subscription";
import { NextRequest } from "next/server";

type P = { params: Promise<{ id: string }> };

// PUT /api/subscriptions/[id]
export async function PUT(request: NextRequest, { params }: P) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = SubscriptionSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { error: dbError } = await supabase
    .from("subscriptions")
    .update(parsed.data)
    .eq("id", Number(id))
    .eq("user_id", user.id);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ changes: 1 });
}

// DELETE /api/subscriptions/[id]
export async function DELETE(_req: NextRequest, { params }: P) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const { error: dbError } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", Number(id))
    .eq("user_id", user.id);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ changes: 1 });
}
