# Business Rules

## Net Worth Formula
```
net_worth = remaining_amount + savings_fd + savings_sip + savings_shares + savings_nps + savings_pf
```

## Remaining Amount Formula
```
remaining_amount = previous_month_remaining + salary + interest_income - total_expenses
```
`previous_month_remaining` is the "Carryover" shown on the Dashboard — the closing cash from the prior month.

## Portfolio Snapshot Rule (CRITICAL)
**Past months use stored `savings_sip` / `savings_shares` from `monthly_summary`.**  
**Only the current month uses live `current_nav × units` / `current_price × shares`.**

Why: The Electron app updates portfolio values in `monthly_summary` only when that month is current. Past months retain the value as it was when that month closed.

Implementation in `Dashboard.tsx`:
```typescript
const isCurrentMonth = currentMonth === new Date().getMonth() + 1
                     && currentYear === new Date().getFullYear();
const displaySIP    = (isCurrentMonth && liveWealth) ? liveWealth.sip    : monthlySummary.savings_sip;
const displayShares = (isCurrentMonth && liveWealth) ? liveWealth.stocks : monthlySummary.savings_shares;
```

## Auto-Sync Guard (CRITICAL)
The GET API for `monthly-summary` can auto-recalculate `remaining_amount` IF the opening balance is stale.  
**This ONLY runs for carry-forward rows** (salary=0 AND total_expenses=0).  
**Real months (salary>0 OR expenses>0) are NEVER overwritten by the auto-sync.**

Why: Before this guard, viewing any month after a bulk-patch cascaded recalculations and corrupted data.

Code location: `src/app/api/monthly-summary/[month]/[year]/route.ts` lines 37-56.

## Carry-Forward Rows
When a month has no data yet (no row in monthly_summary), the GET API:
1. Looks up the previous month's `remaining_amount` and savings values
2. Creates a "carry-forward" row inheriting those values
3. Persists it via `after()` (background, non-blocking)

Carry-forward rows have `salary=0` and `total_expenses=0`. They are the only rows the auto-sync may overwrite.

## Chain Reaction (POST → next month update)
When saving a monthly summary via POST, the API:
1. Saves the current month
2. Via `after()`: updates next month's `previous_month_remaining` if that row exists

This ensures the Carryover value is always up to date for the following month.

## cash_equivalents
```
cash_equivalents = remaining_amount + savings_fd + savings_sip + savings_shares
```
Note: NPS and PF are NOT included in cash_equivalents (they're locked savings). This matches the Electron app.

## SQLite is Source of Truth
The Electron app's SQLite database is authoritative. When Supabase data diverges, always sync FROM SQLite, not the other way.

For bulk sync, use Supabase REST PATCH:
```bash
curl -X PATCH "$SUPABASE_URL/rest/v1/monthly_summary?month=eq.4&year=eq.2026&user_id=eq.UUID" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"remaining_amount": 658725.49, ...}'
```

## Supabase PATCH Pattern
Always filter with `month=eq.X&year=eq.Y&user_id=eq.UUID` — never patch without a user_id filter.

## requireAuth vs requireAuthFast
- `requireAuth()` — full session validation + fresh Supabase client. Use for all mutations (POST/PUT/DELETE).
- `requireAuthFast()` — faster cached session read. Use for GET routes. **Do not use for writes.**

## after() Usage
Use `after()` from `next/server` for background tasks that don't need to block the response:
- Persisting carry-forward rows
- Updating next month's opening balance
- Recalculating monthly totals after expense changes

Never use `after()` when the response must reflect the result of that operation.

## Never Do
- Use live `current_nav × units` for past months — use `savings_sip` from monthly_summary
- Auto-sync `remaining_amount` for months with salary or expense data
- DELETE from `monthly_summary` — update in place
- String-concatenate SQL/Supabase queries — always use parameterized/chained filters
- Store amounts in lakhs — always full rupees
