import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { SubscriptionSchema } from "@/lib/schemas/subscription";
import { after } from "next/server";
import { NextRequest } from "next/server";

function advanceMonthlyRenewal(renewalDate: string): string {
  const d = new Date(renewalDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (d < today) d.setMonth(d.getMonth() + 1);
  return d.toISOString().split("T")[0];
}

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

  // Auto-advance past monthly renewal dates in the background (don't block response)
  const toUpdate: { id: number; advanced: string }[] = [];
  const updated = (rows ?? []).map((sub) => {
    if (
      sub.billing_type === "monthly" &&
      sub.renewal_date &&
      sub.status === "active"
    ) {
      const advanced = advanceMonthlyRenewal(sub.renewal_date);
      if (advanced !== sub.renewal_date) {
        toUpdate.push({ id: sub.id, advanced });
        return { ...sub, renewal_date: advanced };
      }
    }
    return sub;
  });

  // Fire DB updates in background after response is sent
  if (toUpdate.length > 0) {
    after(() =>
      Promise.all(
        toUpdate.map(({ id, advanced }) =>
          supabase
            .from("subscriptions")
            .update({ renewal_date: advanced })
            .eq("id", id)
            .eq("user_id", user.id)
        )
      )
    );
  }

  return Response.json(updated, {
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
