# React Components

## Entry Point
- `src/app/dashboard/page.tsx` — dashboard page (server component, renders AppShell)
- `src/components/AppShell.tsx` — navigation shell, month/year picker, view routing

## Navigation Structure
```
Dashboard (default)  → Dashboard.tsx
Expenses             → ExpenseList.tsx
SIP Tracker          → SIPTracker.tsx
Stock Tracker        → StockTracker.tsx
Loans                → Loans.tsx
Subscriptions        → Subscriptions.tsx
Insurance            → Insurance.tsx
Reports              → MonthlyReport.tsx
```

## Key Components

### Dashboard.tsx (~1200 lines)
**Purpose:** Monthly financial overview — the homepage  
**State:** `currentMonth`, `currentYear`, `monthlySummary`, `expenses`, `liveWealth`  
**Data sources:**
- `GET /api/monthly-summary/[month]/[year]` → `monthlySummary`
- `GET /api/expenses?month=M&year=Y` → `expenses`
- `GET /api/wealth/total` → `liveWealth` (live portfolio, ONLY for current month)

**Net worth calculation (critical):**
```typescript
const isCurrentMonth = currentMonth === new Date().getMonth() + 1
                     && currentYear === new Date().getFullYear();

// Use live prices only for current month; past months use stored snapshot
const displaySIP = isCurrentMonth && liveWealth ? liveWealth.sip : monthlySummary.savings_sip;
const displayShares = isCurrentMonth && liveWealth ? liveWealth.stocks : monthlySummary.savings_shares;

const netWorth = monthlySummary.remaining_amount
               + monthlySummary.savings_fd
               + displaySIP
               + displayShares
               + monthlySummary.savings_nps
               + monthlySummary.savings_pf;
```

**Right panel stat-bar fields (in order):**
1. Cash (remaining_amount)
2. Carryover (previous_month_remaining) — "from last month"
3. FD (savings_fd)
4. SIP (displaySIP)
5. Stocks (displayShares)
6. NPS (savings_nps)
7. PF (savings_pf)
8. Total Net Worth

**Monthly summary edit modal:** Opens `MonthlySummaryModal` for salary, savings, interest edits. POSTs to `/api/monthly-summary/[month]/[year]`.

### SIPTracker.tsx (~900 lines)
**Purpose:** Mutual fund portfolio — add/edit funds, view NAV, transactions  
**Data sources:**
- `GET /api/sip/funds`
- `GET /api/sip/nav-history?schemeCode=X`
- `GET /api/sip/amfi-nav?schemeCode=X` — live NAV proxy
- ML analysis via `/api/sip/...` endpoints

**Key behaviour:** On mount, fetches live NAV from AMFI if any fund's `last_nav_update` is not today. Updates `sip_funds.current_nav` and syncs to `monthly_summary.savings_sip` for the CURRENT month only.

### StockTracker.tsx (~700 lines)
**Purpose:** Direct equity holdings — add/edit stocks, view live prices  
**Data sources:**
- `GET /api/stocks`
- `POST /api/stocks/refresh-prices` — Yahoo Finance proxy

**Key behaviour:** On mount, fetches live prices if any holding's `last_updated` is not today. Updates current_price and syncs to `monthly_summary.savings_shares` for CURRENT month only.

### ExpenseList.tsx (~600 lines)
**Purpose:** Paginated expense table with add/edit/delete  
**Data:** `GET /api/expenses?month=M&year=Y`  
**Mutations:** POST/PUT/DELETE `/api/expenses`

### AppShell.tsx
Navigation sidebar, month/year state management, passes `currentMonth`/`currentYear` down to all views via context or props.

### Other Components
| Component | Purpose |
|-----------|---------|
| `ExpenseForm.tsx` | Add/edit expense modal |
| `BudgetSettingsModal.tsx` | Category budget configuration |
| `CategoryDrillDown.tsx` | Drill into category spending |
| `Loans.tsx` | EMI/loan tracking |
| `LoanForm.tsx` | Add/edit loan modal |
| `Subscriptions.tsx` | Recurring payment list |
| `SubscriptionForm.tsx` | Add/edit subscription modal |
| `Insurance.tsx` | Insurance policy list |
| `MonthlyReport.tsx` | AI-generated spending report |
| `YearEndProjection.tsx` | Year-end cash forecast (ML) |
| `AIChat.tsx` | AI chat interface |
| `IPhoneImportModal.tsx` | Import expenses from iMessage |
| `MobileNav.tsx` | Bottom nav for mobile |

## Lib Utilities

| File | Purpose |
|------|---------|
| `src/lib/auth-guard.ts` | `requireAuth()` / `requireAuthFast()` |
| `src/lib/formatters.ts` | `formatCurrency()`, date formatters |
| `src/lib/monthly-totals.ts` | `updateMonthlyExpenseTotal()` — recalculates after expense change |
| `src/lib/sync-portfolio.ts` | Sync SIP/stock totals to monthly_summary |
| `src/lib/schemas/monthly-summary.ts` | Zod schema for POST body validation |
| `src/lib/schemas/expense.ts` | Zod schema for expense validation |
