import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/sync-monthly-summary
// Syncs monthly_summary from SQLite to Supabase (admin only)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { month, year, userId, data } = await request.json();
    const supabase = await createSupabaseServiceClient();

    const { error } = await supabase
      .from("monthly_summary")
      .upsert(
        {
          user_id: userId,
          month,
          year,
          ...data,
        },
        { onConflict: "user_id,month,year" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
