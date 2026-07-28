import { requireAuth } from "@/lib/auth-guard";
import { adjustBankAccountBalance } from "@/lib/bank-accounts";
import { reverseSipTransaction } from "@/lib/sip-transactions";
import { after, NextRequest } from "next/server";

/**
 * DELETE /api/stocks/sell/[id] — undo a mis-entered sale.
 *
 * Reverses every allocation, restores the shares on the holding (re-inserting
 * the holding from the sale's denormalized fields if it was fully sold and
 * deleted), then marks the sale reverted rather than deleting it — the row is
 * kept so the history stays auditable.
 *
 * Note: like bank transfers, this cannot roll back a credit that
 * snapshotBankBalancesForMonth has already frozen into a closed month's
 * per-account split (see src/lib/bank-accounts.ts). Undoing shortly after the
 * sale, which is the whole point of the button, stays inside that window.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const saleId = parseInt(id, 10);
  if (isNaN(saleId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  const { data: sale } = await supabase
    .from("stock_sales")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", saleId)
    .maybeSingle();

  if (!sale) return Response.json({ error: "Sale not found" }, { status: 404 });
  if (sale.reverted_at)
    return Response.json({ error: "Sale already reverted" }, { status: 400 });

  const { data: allocations } = await supabase
    .from("stock_sale_allocations")
    .select("*")
    .eq("user_id", user.id)
    .eq("sale_id", saleId);

  for (const alloc of allocations ?? []) {
    if (alloc.destination === "bank" && alloc.bank_account_id != null) {
      await adjustBankAccountBalance(
        supabase,
        user.id,
        alloc.bank_account_id,
        -Number(alloc.amount)
      );
    } else if (alloc.destination === "sip" && alloc.sip_transaction_id != null) {
      await reverseSipTransaction(supabase, user.id, alloc.sip_transaction_id);
    }
  }

  // Restore the shares. holding_id survives a partial sale; a full sale deleted
  // the holding and ON DELETE SET NULL cleared the link, so rebuild it from the
  // denormalized ticker/company/avg_buy_price captured at sale time.
  let restoredHoldingId: number | null = null;
  if (sale.holding_id != null) {
    const { data: holding } = await supabase
      .from("stock_holdings")
      .select("id, shares")
      .eq("user_id", user.id)
      .eq("id", sale.holding_id)
      .maybeSingle();

    if (holding) {
      await supabase
        .from("stock_holdings")
        .update({ shares: Number(holding.shares) + Number(sale.shares_sold) })
        .eq("user_id", user.id)
        .eq("id", holding.id);
      restoredHoldingId = holding.id;
    }
  }

  if (restoredHoldingId == null) {
    const { data: reinserted } = await supabase
      .from("stock_holdings")
      .insert({
        user_id:      user.id,
        ticker:       sale.ticker,
        company_name: sale.company_name ?? sale.ticker,
        shares:        Number(sale.shares_sold),
        buy_price:     Number(sale.avg_buy_price),
        // Restoring the price matters: syncMonthlyWealthSnapshot values holdings
        // at shares × current_price, so a null here would silently zero this
        // holding out of savings_shares instead of undoing the sale.
        current_price: sale.last_price != null ? Number(sale.last_price) : null,
        last_updated:  sale.sell_date,
        notes:         sale.broker ?? null,
      })
      .select("id")
      .single();
    restoredHoldingId = reinserted?.id ?? null;
  }

  await supabase
    .from("stock_sales")
    .update({ reverted_at: new Date().toISOString(), holding_id: restoredHoldingId })
    .eq("user_id", user.id)
    .eq("id", saleId);

  const [saleYear, saleMonth] = String(sale.sell_date).split("-").map(Number);

  after(async () => {
    // Same sequential ordering as the sale itself — see POST /api/stocks/sell.
    const { syncMonthlyWealthSnapshot } = await import("@/lib/monthly-totals");
    await syncMonthlyWealthSnapshot(supabase, user.id, saleMonth, saleYear);
    const { resyncCurrentMonthCascade } = await import("@/lib/bank-accounts");
    await resyncCurrentMonthCascade(supabase, user.id);
  });

  return Response.json({ success: true, holding_id: restoredHoldingId });
}
