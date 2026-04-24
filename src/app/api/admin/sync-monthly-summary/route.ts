import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Fields allowed in monthly_summary upsert — prevents arbitrary column injection
const ALLOWED_FIELDS = new Set([
  "salary", "total_expenses", "remaining_amount", "previous_month_remaining",
  "interest_income", "savings_fd", "savings_sip", "savings_shares",
  "savings_nps", "savings_pf", "cash_equivalents",
]);

// POST /api/admin/sync-monthly-summary
// Called only from Electron app to sync SQLite → Supabase
export async function POST(request: NextRequest) {
  // 1. Verify admin bearer token
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Lock to single known user — prevents cross-user data tampering
  const allowedUserId = process.env.ADMIN_USER_ID;
  if (!allowedUserId) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const { month, year, userId, data } = await request.json();

    // 3. Validate userId matches the configured owner
    if (userId !== allowedUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Validate month and year are in range
    const m = Number(month);
    const y = Number(year);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    // 5. Whitelist fields — reject any unknown keys in data
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "data must be an object" }, { status: 400 });
    }
    const safeData: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      if (ALLOWED_FIELDS.has(key)) {
        safeData[key] = data[key];
      }
    }

    const supabase = await createSupabaseServiceClient();
    const { error } = await supabase
      .from("monthly_summary")
      .upsert(
        { user_id: allowedUserId, month: m, year: y, ...safeData },
        { onConflict: "user_id,month,year" }
      );

    if (error) {
      return NextResponse.json({ error: "Sync failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
