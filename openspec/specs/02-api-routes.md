# API Routes

All routes live under `src/app/api/`. All require auth (Supabase cookie session).

## Bootstrap (primary data loader)

### GET `/api/bootstrap?month=M&year=Y`
File: `src/app/api/bootstrap/route.ts`

**The main data-loading endpoint.** Called once per month navigation. Fires 8 parallel Supabase queries in a single server-side round-trip, returning everything the Dashboard needs.

**Response:**
```json
{
  "expenses": [...],           // current month expenses
  "subscriptions": [...],      // all active subscriptions (renewal dates auto-advanced)
  "summary": {...},            // monthly_summary row for the requested month
  "user": { "email", "name" }, // from auth.user_metadata
  "prevMonthExpenses": [...],  // prior month expenses (for comparison)
  "yearlyRows": [...],         // monthly_summary rows for the full year
  "categoryBudgets": [...],    // category budget settings
  "loanMilestones": [...]      // active loans with upcoming end dates
}
```

**Performance:** Subscription renewal date advancement is computed in-process (~0ms pure JS) and DB writes are deferred via `after()` — does not block the response.

**Headers:** Returns `Server-Timing` for profiling auth + DB split in Chrome DevTools.

## Monthly Summary

### GET/POST `/api/monthly-summary/[month]/[year]`
File: `src/app/api/monthly-summary/[month]/[year]/route.ts`

**GET** — Fetch or auto-create a month's summary.
- If row exists and is a REAL month (salary > 0 OR expenses > 0): return as-is. **Never overwrite.**
- If row exists and is carry-forward (salary=0 AND expenses=0): auto-sync opening balance from previous month.
- If no row: create a carry-forward row inheriting previous month's `remaining_amount` and savings fields. Persisted via `after()`.

**POST** — Upsert monthly summary with recalculation.
- Recalculates `total_expenses` from actual `expenses` table.
- Computes `remaining_amount = previous_month_remaining + salary + interest_income - total_expenses`.
- Computes `cash_equivalents = remaining_amount + savings_fd + savings_sip + savings_shares`.
- After response: updates next month's `previous_month_remaining` if that row exists (chain reaction via `after()`).

## Expenses

### GET `/api/expenses?month=M&year=Y`
File: `src/app/api/expenses/route.ts`
Returns all expenses for the given month/year, ordered by date desc.

### POST `/api/expenses`
Create expense. Body: `{ date, description, amount, category, note? }`.
After insert: recalculates `monthly_summary.total_expenses` via `after()`.

### PUT `/api/expenses/[id]`
Update expense. After update: recalculates monthly total.

### DELETE `/api/expenses/[id]`
Delete expense. After delete: recalculates monthly total.

## Wealth / Portfolio

### GET `/api/wealth/total`
File: `src/app/api/wealth/total/route.ts`
Returns LIVE portfolio value: `SUM(units × current_nav)` from sip_funds + `SUM(shares × current_price)` from stock_holdings.
**Use for current month only.** Past months must use `monthly_summary.savings_sip/savings_shares`.

Returns: `{ live_portfolio_total, breakdown: { sip, stocks } }`

## SIP

### GET `/api/sip/funds`
All SIP funds for the user.

### POST `/api/sip/funds`
Add new fund. Body: `{ fund_name, scheme_code, fund_type, sip_amount, units, invested_value }`.

### PUT `/api/sip/funds/[id]`
Update fund (including current_nav after sync).

### DELETE `/api/sip/funds/[id]`
Delete fund.

### GET `/api/sip/transactions?fundId=X`
Transactions for a fund.

### POST `/api/sip/transactions`
Add transaction.

### GET `/api/sip/nav-history?schemeCode=X`
NAV history for a scheme code.

### POST `/api/sip/nav-history`
Bulk upsert NAV history.

### GET `/api/sip/amfi-nav?schemeCode=X`
Proxy AMFI NAV fetch (avoids CORS from browser).

### GET `/api/sip/mfapi?schemeCode=X`
Proxy mfapi.in historical NAV fetch.

## Stocks

### GET `/api/stocks/route.ts` (or `/api/stocks`)
All stock holdings.

### POST `/api/stocks`
Add holding.

### PUT `/api/stocks/[id]`
Update holding (including current_price after sync).

### DELETE `/api/stocks/[id]`
Delete holding.

### POST `/api/stocks/refresh-prices`
Fetch live prices for all holdings from Yahoo Finance server-side proxy.

## Financial Summary

### GET/POST `/api/financial-summary`
File: `src/app/api/financial-summary/route.ts`
Aggregate totals across all months (used for year-level views).

## Reports

### GET `/api/reports`
Monthly spending reports / AI-generated insights.

## Other Routes

| Route | Purpose |
|-------|---------|
| `/api/auth/...` | Supabase auth callbacks |
| `/api/admin/...` | Admin utilities (locked to ADMIN_USER_ID) |
| `/api/category-budgets` | Budget settings per category |
| `/api/loans` | Loan CRUD |
| `/api/loans/milestones` | Active loans with upcoming end dates |
| `/api/subscriptions` | Subscription CRUD |
| `/api/insurance` | Insurance policy CRUD |
| `/api/health` | Health check |

## Common Patterns

```typescript
// Always guard first — both call getUser() (validates JWT against Supabase Auth server)
const { user, supabase, error } = await requireAuthFast(); // reads
const { user, supabase, error } = await requireAuth();     // writes (same impl, different name for clarity)
if (error) return error;

// Filter by user always
supabase.from("table").select("*").eq("user_id", user.id)

// Background work that doesn't block response
after(async () => {
  await supabase.from("monthly_summary").update(...).eq("id", row.id);
});
```
