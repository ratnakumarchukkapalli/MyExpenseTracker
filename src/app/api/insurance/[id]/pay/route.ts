import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

// POST /api/insurance/[id]/pay — advance next_due_date by premium_mode interval
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const { data: policy } = await supabase
    .from("insurance_policies")
    .select("next_due_date, premium_mode")
    .eq("id", Number(id))
    .eq("user_id", user.id)
    .single();

  if (!policy) return Response.json({ error: "Policy not found" }, { status: 404 });

  const due = new Date(policy.next_due_date);
  switch (policy.premium_mode) {
    case "monthly":    due.setMonth(due.getMonth() + 1); break;
    case "quarterly":  due.setMonth(due.getMonth() + 3); break;
    case "biennial":   due.setFullYear(due.getFullYear() + 2); break;
    default:           due.setFullYear(due.getFullYear() + 1); break; // yearly / single
  }
  const newDueDate = due.toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const { error: dbError } = await supabase
    .from("insurance_policies")
    .update({ next_due_date: newDueDate, last_paid_date: today })
    .eq("id", Number(id))
    .eq("user_id", user.id);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ newDueDate });
}
