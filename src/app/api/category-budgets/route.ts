import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { z } from "zod";
import { NextRequest } from "next/server";

const BudgetSchema = z.object({
  category: z.string().min(1),
  budget_type: z.enum(["percentage", "fixed"]).default("percentage"),
  budget_value: z.number().min(0),
});

// GET /api/category-budgets
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("category_budgets")
    .select("*")
    .eq("user_id", user.id)
    .order("category");

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? [], {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
  });
}

// POST /api/category-budgets — upsert by category
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = BudgetSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { error: dbError } = await supabase.from("category_budgets").upsert(
    {
      user_id: user.id,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,category" }
  );

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ changes: 1 });
}
