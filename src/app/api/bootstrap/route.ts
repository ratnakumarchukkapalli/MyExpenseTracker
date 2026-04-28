import { requireAuthFast } from "@/lib/auth-guard";
import { fetchBootstrapData } from "@/lib/bootstrap-data";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const t0 = Date.now();
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;
  const tAuth = Date.now();

  const { searchParams } = request.nextUrl;
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));

  if (!month || !year) {
    return Response.json({ error: "Missing month/year" }, { status: 400 });
  }

  const data = await fetchBootstrapData(supabase, user, month, year);
  const tDb = Date.now();

  return Response.json(data, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Server-Timing": `auth;dur=${tAuth - t0}, db;dur=${tDb - tAuth}, total;dur=${Date.now() - t0}`,
    },
  });
}
