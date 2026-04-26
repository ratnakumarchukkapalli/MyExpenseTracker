# MET Webapp — Architecture Design

## What We Built

A cloud personal finance tracker that mirrors a local Electron/SQLite app. Single user. Deployed on Vercel, data in Supabase, built on Next.js 16 App Router.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER (Hyderabad, India)                                            │
│  Browser — React 19 + TypeScript                                    │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  VERCEL CDN EDGE — bom1 (Mumbai)                                    │
│  • Serves static assets (_next/static)                              │
│  • Proxies API requests → Tokyo function                            │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ ~100ms RTT
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  VERCEL FLUID COMPUTE — hnd1 (Tokyo)                                │
│  Next.js 16 App Router (Node.js runtime)                            │
│                                                                     │
│  Middleware (runs first on every request)                           │
│  └─ getUser() → validates JWT → redirect if unauthenticated         │
│                                                                     │
│  Route Handlers (src/app/api/)                                      │
│  ├─ /api/bootstrap          ← primary data loader (8 parallel q's)  │
│  ├─ /api/expenses           ← CRUD + monthly total recalc           │
│  ├─ /api/monthly-summary    ← salary/savings upsert + cascade       │
│  ├─ /api/wealth/total       ← live SIP + stock portfolio value      │
│  ├─ /api/stocks/refresh-prices ← Yahoo Finance proxy               │
│  ├─ /api/sip/*              ← fund/NAV/transaction CRUD             │
│  ├─ /api/loans              ← EMI tracking                          │
│  ├─ /api/subscriptions      ← renewal tracking + auto-advance       │
│  └─ /api/insurance          ← policy CRUD                           │
│                                                                     │
│  Shared Lib (src/lib/)                                              │
│  ├─ auth-guard.ts           ← requireAuth / requireAuthFast         │
│  ├─ monthly-totals.ts       ← expense total recalc                  │
│  ├─ subscriptions.ts        ← renewal date advance (pure JS)        │
│  └─ schemas/                ← Zod validation                        │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ <5ms (same Tokyo datacenter)
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SUPABASE — ap-northeast-1 (Tokyo)                                  │
│  PostgreSQL + Auth + Row Level Security                             │
│                                                                     │
│  Tables:                                                            │
│  ├─ expenses          — every transaction                           │
│  ├─ monthly_summary   — one row/month, net worth source of truth    │
│  ├─ sip_funds         — mutual fund holdings + current NAV          │
│  ├─ sip_transactions  — buy/sell history                            │
│  ├─ nav_history       — historical NAV for charting                 │
│  ├─ stock_holdings    — direct equity + current price               │
│  ├─ loans             — EMI schedule                                │
│  ├─ subscriptions     — recurring bills + renewal dates             │
│  ├─ insurance_policies — policies + premium schedule               │
│  └─ category_budgets  — per-category budget limits                  │
│                                                                     │
│  Auth: cookie-based JWT sessions (SSR-compatible)                  │
│  RLS: every table has user_id policy                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  EXTERNAL SERVICES                                                  │
│  ├─ Yahoo Finance (server-side) — stock price refresh               │
│  │   Tries {ticker}.NS (NSE) then {ticker}.BO (BSE)                │
│  └─ AMFI / mfapi.in (server-side) — mutual fund NAV                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SOURCE OF TRUTH (offline)                                          │
│  Electron App — SQLite (~Library/Application Support/MET/)          │
│  When Supabase diverges, always patch FROM SQLite.                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Request Lifecycle — Page Load

```
1. Browser requests /dashboard
2. Middleware: getUser() → auth OK → pass through
3. Server component renders AppShell (shell HTML, no data)
4. Browser renders skeleton UI

5. AppShell mounts → calls loadCoreData(month, year)
6. GET /api/bootstrap?month=5&year=2026
   └─ Server: requireAuth → getUser() [~5ms, same datacenter]
   └─ Server: 8 parallel Supabase queries [~10ms]:
       ├─ expenses (current month)
       ├─ subscriptions (all active)
       │   └─ advanceSubscriptionsLocally() [pure JS, ~0ms]
       ├─ monthly_summary (current month)
       ├─ expenses (previous month)
       ├─ monthly_summary rows (full year)
       ├─ yearly expenses (savings category)
       ├─ category_budgets
       └─ loans (active, upcoming end dates)
   └─ after(): persist any subscription date advances [non-blocking]
   └─ Returns all data in one JSON payload
7. AppShell stores data → passes as props to Dashboard
8. Dashboard renders with full data [~600ms total from step 5]

9. If current month: loadLiveWealth()
   └─ GET /api/wealth/total → live SIP + stock value [~400ms]
   └─ If >1hr since last scrape: POST /api/stocks/refresh-prices
       └─ Yahoo Finance → update current prices
       └─ GET /api/wealth/total again with updated prices
```

**Total API calls on load: 2** (bootstrap + optional wealth/total)  
Previously: 7 separate calls

---

## Request Lifecycle — Add Expense

```
1. User fills ExpenseForm → clicks Save
2. POST /api/expenses { date, description, amount, category }
   └─ requireAuth → getUser()
   └─ Parallel [Round-trip 1]:
       ├─ INSERT into expenses
       └─ SELECT monthly_summary for that month
   └─ Compute newTotal = oldTotal + amount
   └─ UPDATE monthly_summary [Round-trip 2]
   └─ after(): cascadeUpdateFutureMonths() [non-blocking]
   └─ Returns { expense, summary } → status 201
3. AppShell re-calls loadCoreData() → re-fetches bootstrap
   └─ UI refreshes with updated expenses + summary
```

---

## Data Flow — Net Worth

```
monthly_summary (one row per month)
│
├─ remaining_amount = prev_month_remaining + salary + interest - total_expenses
├─ savings_fd       (manually entered)
├─ savings_sip      ← SNAPSHOT (current month: live NAV × units)
│                      (past months: stored value, never overwritten)
├─ savings_shares   ← SNAPSHOT (same rule as savings_sip)
├─ savings_nps      (manually entered)
└─ savings_pf       (manually entered)

net_worth = remaining_amount + savings_fd + savings_sip
          + savings_shares + savings_nps + savings_pf

cash_equivalents = remaining_amount + savings_fd + savings_sip + savings_shares
                   (NPS + PF excluded — they're locked)
```

**Carryover chain:**
```
Jan remaining_amount
    → Feb previous_month_remaining
         → Feb remaining_amount (= prev + salary + interest - expenses)
              → Mar previous_month_remaining
                   → ...
```

---

## Component Architecture

```
src/
├─ app/
│   ├─ page.tsx              → redirect to /dashboard
│   ├─ dashboard/page.tsx    → server component, renders AppShell
│   ├─ login/page.tsx        → Supabase auth UI
│   └─ api/                  → all route handlers (see API section)
│
├─ components/
│   ├─ AppShell.tsx          → nav shell, month picker, bootstrap owner
│   │   └─ passes props ──→  Dashboard.tsx    (main view)
│   │                        ExpenseList.tsx  (expense tab)
│   │                        SIPTracker.tsx   (SIP tab)
│   │                        StockTracker.tsx (stocks tab)
│   │                        Loans.tsx        (loans tab)
│   │                        Subscriptions.tsx
│   │                        Insurance.tsx    (My Policies + Family tabs)
│   │                        MonthlyReport.tsx
│   │
│   ├─ Dashboard.tsx         → net worth, expense rings, stat-bar
│   │   ├─ receives: monthlySummary, expenses, prevMonthExpenses,
│   │   │            yearlyRows, categoryBudgets, loanMilestones (from AppShell)
│   │   └─ fetches: liveWealth (current month only, gated by isCurrentMonth)
│   │
│   ├─ MobileNav.tsx         → bottom tab bar (mobile only, max-width 768px)
│   └─ ... (other components listed in 03-components.md)
│
└─ lib/
    ├─ auth-guard.ts          → requireAuth / requireAuthFast (both: getUser())
    ├─ monthly-totals.ts      → updateMonthlyExpenseTotal, cascadeUpdateFutureMonths
    ├─ subscriptions.ts       → advanceSubscriptionsLocally (pure), persistSubscriptionAdvances
    ├─ supabase/
    │   ├─ server.ts          → createSupabaseServerClient (SSR cookie client)
    │   └─ client.ts          → createSupabaseBrowserClient
    └─ schemas/               → Zod schemas (expense, monthly-summary, etc.)
```

---

## Key Design Decisions

### 1. Bootstrap API as single data loader
**Decision:** One server-side endpoint fans out 8 parallel DB queries.  
**Why:** Eliminates 5+ round trips from the browser. Server-to-DB latency (Tokyo→Tokyo) is <5ms; browser-to-server latency is ~200ms. Doing 8 queries server-side costs 8×5ms=40ms; doing them from the browser costs 8×200ms=1600ms.

### 2. Vercel + Supabase co-location (both Tokyo)
**Decision:** `vercel.json` pins functions to `hnd1` (Tokyo). Supabase is in `ap-northeast-1` (Tokyo).  
**Why:** DB round-trips from the function are <5ms. Any other region adds 100-200ms per DB call — catastrophic for the 8-query bootstrap.

### 3. after() for non-critical writes
**Decision:** Subscription date advances and cascade future-month updates run via `after()` from `next/server`.  
**Why:** These writes don't affect the current response. Deferring them means the user gets their data 50-200ms faster.

### 4. Snapshot rule for portfolio values
**Decision:** Past months use stored `savings_sip`/`savings_shares`. Only current month uses live prices.  
**Why:** Portfolio prices change daily. A past month's net worth should reflect what it was when that month closed, not what prices are today. Using live prices for historical months causes net worth to fluctuate retroactively.

### 5. getUser() in every route handler
**Decision:** Both `requireAuth()` and `requireAuthFast()` call `supabase.auth.getUser()` — full server-side JWT validation.  
**Why:** `getSession()` reads cookies without verifying against Supabase Auth server. Even though middleware validates first, route handlers should independently validate — defense in depth. The latency penalty (~5ms in same-region Tokyo) is acceptable.

### 6. Middleware validates first
**Decision:** `src/middleware.ts` calls `getUser()` on every request and redirects unauthenticated users before any route handler runs.  
**Why:** Prevents unauthenticated requests from ever reaching route handlers. Combined with per-handler `requireAuth`, there are two independent auth checks.

### 7. Pure JS subscription advance
**Decision:** Subscription renewal date math is computed in JavaScript (no DB read needed) then DB writes are deferred.  
**Why:** The computation is pure (just date arithmetic). Separating computation from persistence lets us advance dates during bootstrap without adding a DB call to the hot path.

---

## Performance Profile (warm function, post-optimization)

| Action | Latency | Notes |
|--------|---------|-------|
| Bootstrap (warm) | ~600ms | 200ms user RTT + getUser ~5ms + 8 parallel DB queries ~10ms |
| Bootstrap (cold start) | ~1.3s | +~700ms for Vercel function warm-up |
| Expense save (warm) | ~400ms | 2 sequential DB round-trips after auth |
| Expense save (cold) | ~2s | Cold start on first call per idle period |
| Live wealth fetch | ~400ms | getUser + 2 DB queries (sip_funds + stock_holdings) |
| Stock price refresh | ~600ms | Yahoo Finance HTTP call (external) |

**Baseline before optimizations:** 7 separate API calls, ~1-2s each → 3-5s total load time.  
**After optimizations:** 2 API calls, ~600ms for bootstrap on warm function.

---

## Auth Architecture

```
Request arrives
    │
    ▼
Middleware (src/middleware.ts)
    │  supabase.auth.getUser()  [validates JWT against Supabase Auth]
    │  Redirects → /login if unauthenticated
    ▼
Route Handler
    │  requireAuth() / requireAuthFast()
    │  supabase.auth.getUser()  [second independent validation]
    ▼
Supabase DB query
    │  Row Level Security: auth.uid() = user_id
    │  Third layer — DB enforces ownership even if app code is wrong
    ▼
Response
```

Three layers: middleware, route handler, database RLS.

---

## Mobile Layout

Breakpoint: `max-width: 768px` in `src/app/globals.css`

```
Desktop (≥769px)               Mobile (≤768px)
┌──────┬──────────────────┐    ┌────────────────────┐
│ Side │                  │    │ Topbar (avatar)     │
│ bar  │  Main content    │    ├────────────────────┤
│ nav  │  (scrollable)    │    │ Month chips bar    │
│      │                  │    ├────────────────────┤
│      │                  │    │ Main content       │
│      │                  │    │ (scrollable)       │
│      │                  │    ├────────────────────┤
└──────┴──────────────────┘    │ Bottom tab nav     │
                               └────────────────────┘
                                         ⊕ FAB (add expense)
```

Key mobile-specific components:
- `MobileNav.tsx` — glass-effect bottom tab bar + More drawer
- `mobile-month-bar` (in AppShell) — scrollable month chips + year arrows
- FAB — floating action button replaces Quick Add topbar button
- Dashboard `grid-rings-row` — stacks to 1 column (rings above stat-bar)

---

## File Count Summary

| Area | Count |
|------|-------|
| API routes (route.ts files) | ~30 |
| React components | 20 |
| Lib utilities | ~8 |
| Supabase tables | 10 |
| Test files (Playwright E2E) | 1 spec |
| openspec docs | 5 specs + this file |
