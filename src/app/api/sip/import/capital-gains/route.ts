import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";
import ExcelJS from "exceljs";

// POST /api/sip/import/capital-gains
// Receives multipart form with `file` field, parses Capital Gains sheet,
// returns { transactions: [...] }
export async function POST(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ error: "Form data required" }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "file field required" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: "File too large (max 10MB)" }, { status: 413 });

  const nodeBuf = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(nodeBuf as any);

  const ws = wb.worksheets[0];
  if (!ws) return Response.json({ error: "No worksheet found in file" }, { status: 400 });

  // Convert worksheet to array of arrays
  const rows: string[][] = [];
  ws.eachRow((row: ExcelJS.Row) => {
    const vals = row.values as (ExcelJS.CellValue | null | undefined)[];
    rows.push(vals.slice(1).map((v) => (v == null ? "" : String(v).trim())));
  });

  const headerIdx = rows.findIndex(
    (r) => r[0] === "Scheme Name" && r[1] === "Scheme Code"
  );
  if (headerIdx === -1) {
    return Response.json({ error: "Could not find Capital Gains data in this file." }, { status: 422 });
  }

  const data = rows
    .slice(headerIdx + 1)
    .filter((r) => r[0] && r[5] && /^\d{4}-\d{2}-\d{2}/.test(r[5]));

  const transactions = data.map((r) => ({
    fundName:     r[0],
    schemeCode:   r[1],
    folio:        r[3],
    purchaseDate: r[5],
    units:        parseFloat(r[6]) || 0,
    purchaseNav:  parseFloat(r[7]) || 0,
    amount:       (parseFloat(r[6]) || 0) * (parseFloat(r[7]) || 0),
    redeemDate:   r[9] || null,
    redeemNav:    r[11] ? parseFloat(r[11]) : null,
  }));

  return Response.json({ transactions });
}
