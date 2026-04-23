import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";
import ExcelJS from "exceljs";

// POST /api/sip/import/holdings
// Receives multipart form with `file` field (xlsx/xls), parses Holdings sheet,
// returns { funds: [...] } for user to confirm + match scheme codes
export async function POST(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ error: "Form data required" }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "file field required" }, { status: 400 });

  const nodeBuf = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(nodeBuf as any);

  const ws = wb.getWorksheet("Holdings") ?? wb.worksheets[0];
  if (!ws) return Response.json({ error: "No worksheet found in file" }, { status: 400 });

  // Convert worksheet to array of arrays
  const rows: string[][] = [];
  ws.eachRow((row: ExcelJS.Row) => {
    const vals = row.values as (ExcelJS.CellValue | null | undefined)[];
    rows.push(vals.slice(1).map((v) => (v == null ? "" : String(v).trim())));
  });

  const headerIdx = rows.findIndex(
    (r) => r.some((c) => c === "Scheme Name") && r.some((c) => c === "Units")
  );
  if (headerIdx === -1) {
    return Response.json({ error: "Could not find Holdings data in this file." }, { status: 422 });
  }

  const data = rows.slice(headerIdx + 1).filter((r) => r[0] && parseFloat(r[6]) > 0);
  const funds = data.map((r) => ({
    fundName:     r[0],
    amc:          r[1],
    category:     r[2],
    folio:        r[4],
    units:        parseFloat(r[6]) || 0,
    investedValue: parseFloat(r[7]) || 0,
    currentValue: parseFloat(r[8]) || 0,
    schemeCode:   null as string | null,
  }));

  return Response.json({ funds });
}
