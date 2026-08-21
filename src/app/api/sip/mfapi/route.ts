import { NextRequest, NextResponse } from "next/server";
import { requireAuthFast } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuthFast();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  
  if (!path) {
    return NextResponse.json({ error: "Path parameter is required" }, { status: 400 });
  }

  // Sanitize path to prevent SSRF (only allow mf/...)
  if (!path.startsWith("mf/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const url = `https://api.mfapi.in/${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: `MFAPI returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("MFAPI Proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch from MFAPI" }, { status: 500 });
  }
}
