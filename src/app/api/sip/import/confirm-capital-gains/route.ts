import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

interface Transaction {
  fundName: string;
  schemeCode: string;
  folio: string;
  purchaseDate: string;
  units: number;
  purchaseNav: number;
  amount: number;
  redeemDate?: string | null;
  redeemNav?: number | null;
}

// POST /api/sip/import/confirm-capital-gains
// Body: { transactions: [...] }
// Groups by schemeCode to upsert sip_funds, then inserts transactions
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.transactions)) {
    return Response.json({ error: "transactions[] required" }, { status: 400 });
  }

  const transactions = body.transactions as Transaction[];

  // Group by schemeCode+folio to identify unique funds
  const fundsMap = new Map<string, Transaction>();
  for (const t of transactions) {
    const key = `${t.schemeCode}_${t.folio}`;
    if (!fundsMap.has(key)) fundsMap.set(key, t);
  }

  // Fetch all existing funds upfront (one query instead of N queries)
  const schemeCodes = [...new Set(transactions.map((t) => t.schemeCode))];
  const { data: existingFunds } = await supabase
    .from("sip_funds")
    .select("id, scheme_code, folio_number")
    .eq("user_id", user.id)
    .in("scheme_code", schemeCodes);

  const existingMap = new Map(
    (existingFunds ?? []).map((f) => [`${f.scheme_code}_${f.folio_number}`, f.id])
  );

  // Build schemeCode+folio → fund id map, inserting missing funds in parallel
  const fundIdMap = new Map<string, number>();
  const toInsert: { key: string; fund: Transaction }[] = [];

  for (const [key, f] of fundsMap) {
    const existingId = existingMap.get(key);
    if (existingId) {
      fundIdMap.set(key, existingId);
    } else {
      toInsert.push({ key, fund: f });
    }
  }

  // Insert missing funds in parallel
  if (toInsert.length > 0) {
    const insertResults = await Promise.all(
      toInsert.map(({ key, fund: f }) =>
        supabase
          .from("sip_funds")
          .insert({
            user_id: user.id, fund_name: f.fundName, scheme_code: f.schemeCode,
            folio_number: f.folio, fund_type: "historical",
          })
          .select("id")
          .single()
          .then((r) => ({ key, id: r.data?.id as number | undefined }))
      )
    );
    for (const { key, id } of insertResults) {
      if (id) fundIdMap.set(key, id);
    }
  }

  // Upsert all transactions in parallel
  const txnResults = await Promise.all(
    transactions.map((t) => {
      const key = `${t.schemeCode}_${t.folio}`;
      const fundId = fundIdMap.get(key);
      if (!fundId) return Promise.resolve(false);
      return supabase
        .from("sip_transactions")
        .upsert(
          {
            user_id: user.id, fund_id: fundId,
            transaction_date: t.purchaseDate, units: t.units,
            purchase_nav: t.purchaseNav, amount: t.amount,
            redeem_date: t.redeemDate ?? null, redeem_nav: t.redeemNav ?? null,
            transaction_type: "SIP",
          },
          { ignoreDuplicates: true }
        )
        .then(() => true);
    })
  );

  return Response.json({ saved: txnResults.filter(Boolean).length });
}
