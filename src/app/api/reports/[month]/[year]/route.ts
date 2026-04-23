import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

type P = { params: Promise<{ month: string; year: string }> };

// GET /api/reports/[month]/[year]
export async function GET(_req: NextRequest, { params }: P) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { month, year } = await params;

  const { data } = await supabase
    .from("monthly_reports")
    .select("report_data")
    .eq("user_id", user.id)
    .eq("month", Number(month))
    .eq("year", Number(year))
    .maybeSingle();

  if (!data) return Response.json(null);

  try {
    return Response.json(
      typeof data.report_data === "string"
        ? JSON.parse(data.report_data)
        : data.report_data
    );
  } catch {
    return Response.json(null);
  }
}

// POST /api/reports/[month]/[year] — upsert report
export async function POST(request: NextRequest, { params }: P) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { month, year } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });

  const { error: dbError } = await supabase
    .from("monthly_reports")
    .upsert(
      {
        user_id: user.id,
        month: Number(month),
        year: Number(year),
        report_data: body,
      },
      { onConflict: "user_id,month,year" }
    );

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ ok: true });
}

// DELETE /api/reports/[month]/[year]
export async function DELETE(_req: NextRequest, { params }: P) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { month, year } = await params;

  const { error: dbError } = await supabase
    .from("monthly_reports")
    .delete()
    .eq("user_id", user.id)
    .eq("month", Number(month))
    .eq("year", Number(year));

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ changes: 1 });
}
