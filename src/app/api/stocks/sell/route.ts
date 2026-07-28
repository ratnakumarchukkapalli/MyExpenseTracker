import { requireAuth, requireAuthFast } from "@/lib/auth-guard";
import { StockSaleSchema } from "@/lib/schemas/stock-sale";
import { adjustBankAccountBalance } from "@/lib/bank-accounts";
import { recordSipTransaction } from "@/lib/sip-transactions";
import { getActiveBudgetMonth } from "@/lib/monthly-totals";
import { after, NextRequest } from "next/server";

/**
 * GET /api/stocks/sell — sale history with allocations, newest first, feeding
 * the Realized Gains panel. Also returns the active budget month so the sell
 * modal can warn when a sale is being back-dated into a closed month.
 */
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const [salesResult, banksResult, fundsResult, activeMonth] = await Promise.all([
    supabase
      .from("stock_sales")
      .select("*")
      .eq("user_id", user.id)
      .is("reverted_at", null)
      .order("sell_date", { ascending: false })
      .order("id", { ascending: false }),
    supabase.from("bank_accounts").select("id, name").eq("user_id", user.id),
    supabase.from("sip_funds").select("id, fund_name").eq("user_id", user.id),
    getActiveBudgetMonth(supabase, user.id),
  ]);

  if (salesResult.error)
    return Response.json({ error: salesResult.error.message }, { status: 500 });

  const sales = salesResult.data ?? [];

  // Stitched in JS rather than via a PostgREST embed: stock_sale_allocations has
  // three nullable FKs and embeds get ambiguous fast. Two flat lookups are cheaper
  // to reason about than a nested select that breaks when a target row is deleted.
  let allocations: Record<string, unknown>[] = [];
  if (sales.length > 0) {
    const { data } = await supabase
      .from("stock_sale_allocations")
      .select("*")
      .eq("user_id", user.id)
      .in("sale_id", sales.map((s) => s.id));
    allocations = data ?? [];
  }

  const bankNames = new Map((banksResult.data ?? []).map((b) => [b.id, b.name]));
  const fundNames = new Map((fundsResult.data ?? []).map((f) => [f.id, f.fund_name]));

  const withAllocations = sales.map((sale) => ({
    ...sale,
    allocations: allocations
      .filter((a) => a.sale_id === sale.id)
      .map((a) => ({
        ...a,
        label:
          a.destination === "bank"
            ? bankNames.get(a.bank_account_id as number) ?? "Deleted account"
            : fundNames.get(a.sip_fund_id as number) ?? "Deleted fund",
      })),
  }));

  return Response.json({ sales: withAllocations, active_month: activeMonth });
}

/**
 * POST /api/stocks/sell — sell part or all of a holding and route the net
 * proceeds across any mix of bank accounts and SIP funds.
 *
 * Net-worth invariant: realized P&L is recorded for reporting and tax only and
 * is NEVER credited anywhere. That gain was already sitting in net worth as
 * unrealized value inside savings_shares (shares × current_price); crediting it
 * again on realization double-counts it. What actually moves:
 *   - bank leg: savings_shares falls by qty × current_price, bank balance rises
 *     by the allocated amount, so net worth moves by exactly
 *     (sell_price − last_fetched_price) × qty − charges. That is the real delta.
 *   - SIP leg: savings_shares falls, savings_sip rises by the same rupees. Net
 *     worth is flat, which is correct — it is a reallocation, not income.
 *
 * Proceeds deliberately never touch `salary` or `interest_income`: that would
 * corrupt income analytics, and remaining_amount would count the proceeds twice
 * once the wealth snapshot drops. bank_accounts.current_balance is the right
 * lever — resolveOpeningBalance already derives remaining_amount from it for the
 * active budget month.
 */
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = StockSaleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // ── Validate everything before mutating anything ────────────────────────────
  // supabase-js has no transactions, so a half-applied sale is unrecoverable
  // without manual DB surgery. Every check that can fail runs first.

  const { data: holding } = await supabase
    .from("stock_holdings")
    .select("id, ticker, company_name, shares, buy_price, current_price")
    .eq("user_id", user.id)
    .eq("id", input.holding_id)
    .maybeSingle();

  if (!holding) return Response.json({ error: "Holding not found" }, { status: 404 });

  if (input.shares_sold > Number(holding.shares) + 1e-6) {
    return Response.json(
      { error: `Only ${holding.shares} shares held, cannot sell ${input.shares_sold}` },
      { status: 400 }
    );
  }

  const bankIds = [
    ...new Set(
      input.allocations.flatMap((a) => (a.destination === "bank" ? [a.bank_account_id] : []))
    ),
  ];
  const fundIds = [
    ...new Set(
      input.allocations.flatMap((a) => (a.destination === "sip" ? [a.sip_fund_id] : []))
    ),
  ];

  const [banksResult, fundsResult] = await Promise.all([
    bankIds.length
      ? supabase.from("bank_accounts").select("id").eq("user_id", user.id).in("id", bankIds)
      : Promise.resolve({ data: [] as { id: number }[] }),
    fundIds.length
      ? supabase
          .from("sip_funds")
          .select("id, fund_name, current_nav")
          .eq("user_id", user.id)
          .in("id", fundIds)
      : Promise.resolve({ data: [] as { id: number; fund_name: string; current_nav: number | null }[] }),
  ]);

  const banks = banksResult.data ?? [];
  const funds = fundsResult.data ?? [];

  if (banks.length !== bankIds.length)
    return Response.json({ error: "One or more bank accounts not found" }, { status: 404 });
  if (funds.length !== fundIds.length)
    return Response.json({ error: "One or more SIP funds not found" }, { status: 404 });

  // A fund with no NAV would make units = amount / 0 → Infinity, which poisons
  // sip_funds.units permanently and blows up every downstream portfolio total.
  // Refuse the whole sale rather than route into it.
  const navless = funds.find((f) => !f.current_nav || Number(f.current_nav) <= 0);
  if (navless) {
    return Response.json(
      { error: `Refresh NAV for ${navless.fund_name} before routing proceeds into it` },
      { status: 400 }
    );
  }

  const fundById = new Map(funds.map((f) => [f.id, f]));

  const gross_proceeds = input.shares_sold * input.sell_price;
  const net_proceeds = gross_proceeds - input.charges;
  const realized_pnl =
    (input.sell_price - Number(holding.buy_price)) * input.shares_sold - input.charges;

  // ── Mutate ──────────────────────────────────────────────────────────────────

  const { data: sale, error: saleError } = await supabase
    .from("stock_sales")
    .insert({
      user_id:        user.id,
      holding_id:     holding.id,
      ticker:         holding.ticker,
      company_name:   holding.company_name,
      shares_sold:    input.shares_sold,
      sell_price:     input.sell_price,
      sell_date:      input.sell_date,
      avg_buy_price:  holding.buy_price,
      last_price:     holding.current_price ?? null,
      gross_proceeds,
      charges:        input.charges,
      net_proceeds,
      realized_pnl,
      broker:         input.broker ?? null,
      notes:          input.notes ?? null,
    })
    .select("id")
    .single();

  if (saleError) return Response.json({ error: saleError.message }, { status: 500 });

  for (const alloc of input.allocations) {
    if (alloc.destination === "bank") {
      await adjustBankAccountBalance(supabase, user.id, alloc.bank_account_id, alloc.amount);
      await supabase.from("stock_sale_allocations").insert({
        user_id:         user.id,
        sale_id:         sale.id,
        destination:     "bank",
        bank_account_id: alloc.bank_account_id,
        amount:          alloc.amount,
      });
    } else {
      const fund = fundById.get(alloc.sip_fund_id)!;
      const nav = Number(fund.current_nav);
      const sipTransactionId = await recordSipTransaction(supabase, user.id, {
        fundId: alloc.sip_fund_id,
        date:   input.sell_date,
        units:  alloc.amount / nav,
        nav,
        amount: alloc.amount,
        type:   "LUMPSUM",
      });
      await supabase.from("stock_sale_allocations").insert({
        user_id:            user.id,
        sale_id:            sale.id,
        destination:        "sip",
        sip_fund_id:        alloc.sip_fund_id,
        sip_transaction_id: sipTransactionId,
        amount:             alloc.amount,
      });
    }
  }

  // Holding goes last, deliberately: a mid-flight failure above leaves the
  // holding intact (recoverable by undoing the sale) rather than destroyed.
  const remainingShares = Number(holding.shares) - input.shares_sold;
  if (remainingShares <= 1e-6) {
    await supabase
      .from("stock_holdings")
      .delete()
      .eq("user_id", user.id)
      .eq("id", holding.id);
  } else {
    // buy_price is untouched — a partial sale at average cost does not move
    // average cost.
    await supabase
      .from("stock_holdings")
      .update({ shares: remainingShares })
      .eq("user_id", user.id)
      .eq("id", holding.id);
  }

  // Parse the date string directly; new Date('YYYY-MM-DD') is UTC-parsed and
  // rolls back a day for IST users on month boundaries.
  const [saleYear, saleMonth] = input.sell_date.split("-").map(Number);

  after(async () => {
    // Strictly sequential. syncMonthlyWealthSnapshot recomputes cash_equivalents
    // from the still-stale remaining_amount, so the bank resync has to land
    // second to correct it. Promise.all would race two cascades over the same
    // monthly_summary rows and the loser's writes win arbitrarily.
    const { syncMonthlyWealthSnapshot } = await import("@/lib/monthly-totals");
    await syncMonthlyWealthSnapshot(supabase, user.id, saleMonth, saleYear);
    const { resyncCurrentMonthCascade } = await import("@/lib/bank-accounts");
    await resyncCurrentMonthCascade(supabase, user.id);
  });

  return Response.json(
    { success: true, id: sale.id, gross_proceeds, net_proceeds, realized_pnl },
    { status: 201 }
  );
}
