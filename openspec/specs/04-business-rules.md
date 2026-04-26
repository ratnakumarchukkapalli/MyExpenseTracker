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

Why: Past months should retain the value as it was when that month closed.

**Synchronization Trigger**:
When adding/editing a SIP transaction or stock holding, the API calls `syncMonthlyWealthSnapshot`.
1. Recalculates live totals for SIP/Stocks.
2. Updates the current month's `savings_sip` and `savings_shares` in `monthly_summary`.
3. Cascades these values to future months.

## Auto-Sync Guard (CRITICAL)
The GET API for `monthly-summary` auto-recalculates values IF the data is stale compared to the previous month.
**What syncs:**
- `remaining_amount` (opening cash)
- `savings_sip` / `savings_shares` (portfolio snapshots)
- `savings_fd` / `savings_nps` / `savings_pf` (if the month is a "fresh" carry-forward month)

**Real months (salary > 0 OR expenses > 0) retain their authoritative cash balances, but portfolio snapshots still sync to maintain continuity.**

Why: Investment totals (SIP/Stocks) are expected to flow through automatically regardless of local month edits, unless a specific transaction is logged in that month.

Code location: `src/app/api/monthly-summary/[month]/[year]/route.ts`

## Carry-Forward Rows
When a month has no data yet (no row in monthly_summary), the GET API:
1. Looks up the previous month's `remaining_amount` and savings values
2. Creates a "carry-forward" row inheriting those values
3. Persists it via `after()` (background, non-blocking)

Carry-forward rows have `salary=0` and `total_expenses=0`. They are the only rows the auto-sync may overwrite.

## Chain Reaction (Multi-Month Cascade)
When saving a monthly summary or adding/deleting an expense, the app triggers a cascade update:
1. **Current Month**: Recalculated and saved synchronously for immediate consistency.
2. **Future Months**: Via `after()`, a bulk update propagates changes through the next 24 months.
   - Closing cash flows to the next month's opening cash.
   - Portfolio snapshots (SIP/Stocks) flow through all months.
   - Manual savings (FD/NPS/PF) flow through "fresh" months only.

This ensures that a correction in April is automatically reflected in May, June, and beyond.

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
Both `requireAuth()` and `requireAuthFast()` call `supabase.auth.getUser()` — full JWT validation against the Supabase Auth server. They are identical in implementation; the name distinction signals intent (reads vs. writes) but NOT a security difference. Never switch to `getSession()` on the server — it reads cookies without server-side verification and Supabase SDK will warn.

## Performance & UX
- **Bootstrap API**: `GET /api/bootstrap?month=M&year=Y` fires 8 parallel Supabase queries server-side, returning everything the Dashboard needs in 2 network calls total (bootstrap + optional wealth/total for current month). Do not add per-component fetches that duplicate bootstrap data.
- **after() for non-critical writes**: Subscription renewal date persistence, monthly cascade updates — all deferred via `after()` so they don't block the response.
- **Vercel region**: Functions pinned to `hnd1` (Tokyo) — co-located with Supabase `ap-northeast-1`. Do not change this; the user is in Hyderabad and DB round-trips from Tokyo are <5ms vs 200ms+ if mis-configured.
- **Optimistic UI**: Mutations (adding/deleting expenses) should update local React state instantly before the API call finishes.
- **Silent Refresh**: Background data refreshes should happen without a full-page loading screen to maintain a smooth experience.

## Never Do
- Use live `current_nav × units` for past months — use `savings_sip` from monthly_summary
- Auto-sync `remaining_amount` for months with salary or expense data
- DELETE from `monthly_summary` — update in place
- String-concatenate SQL/Supabase queries — always use parameterized/chained filters
- Store amounts in lakhs — always full rupees
