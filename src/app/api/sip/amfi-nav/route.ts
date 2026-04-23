import { NextRequest, NextResponse } from "next/server";

const AMFI_URL = "https://portal.amfiindia.com/spages/NAVAll.txt";

const AMFI_MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function convertAmfiDate(d: string) {
  const [day, mon, year] = d.trim().split("-");
  return `${year}-${AMFI_MONTHS[mon]}-${day.padStart(2, "0")}`;
}

// POST /api/sip/amfi-nav
export async function POST(request: NextRequest) {
  try {
    const { schemeCodes } = await request.json();
    if (!Array.isArray(schemeCodes) || schemeCodes.length === 0) {
      return NextResponse.json({ error: "schemeCodes array required" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(AMFI_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: `AMFI API returned ${res.status}` }, { status: 500 });
    }

    const text = await res.text();
    const map: Record<string, { nav: number; date: string }> = {};

    for (const line of text.split("\n")) {
      const parts = line.split(";");
      if (parts.length < 6) continue;

      const code = parts[0].trim();
      if (!schemeCodes.includes(code)) continue;

      const nav = parseFloat(parts[4]);
      const date = convertAmfiDate(parts[5]);

      if (!isNaN(nav) && date) {
        map[code] = { nav, date };
      }
    }

    return NextResponse.json(map);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch AMFI data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
