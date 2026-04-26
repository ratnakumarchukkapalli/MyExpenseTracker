# MET Webapp — System Overview

## What This App Is
MET Webapp is a cloud-hosted personal finance tracker built as a Next.js App Router application. It mirrors the Electron app (MET Desktop) with data stored in Supabase and deployed on Vercel. Single user (venkataratna.ch@gmail.com).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (cookie-based sessions) |
| Hosting | Vercel |
| Styling | CSS Modules + custom CSS variables |
| Language | TypeScript |

## Architecture

```
Browser (React Server + Client Components)
  │
  ├─ src/app/page.tsx          → root redirect to /dashboard
  ├─ src/app/dashboard/        → main dashboard layout
  ├─ src/components/           → React components
  │    ├─ Dashboard.tsx         (~1200 lines) — homepage
  │    ├─ SIPTracker.tsx        — mutual fund portfolio
  │    ├─ StockTracker.tsx      — stock holdings
  │    ├─ ExpenseList.tsx       — expense log
  │    └─ ...other components
  │
  ├─ src/app/api/              → Next.js Route Handlers (server-side)
  │    ├─ bootstrap/            ← primary data loader (8 parallel queries, 1 RTT)
  │    ├─ expenses/
  │    ├─ monthly-summary/[month]/[year]/
  │    ├─ wealth/total/
  │    ├─ sip/funds/
  │    ├─ stocks/[id]/
  │    └─ ...other routes
  │
  └─ src/lib/                  → shared utilities
       ├─ auth-guard.ts         → requireAuth / requireAuthFast
       ├─ supabase/             → Supabase client (server + browser)
       ├─ schemas/              → Zod validation schemas
       └─ ml/                   → client-side ML utilities
```

## Auth Flow
- Supabase cookie-based sessions (SSR-compatible)
- Both `requireAuth()` and `requireAuthFast()` call `supabase.auth.getUser()` (validates JWT against Supabase Auth server). Never use `getSession()` server-side — it reads unverified cookies.
- Middleware also validates every request via `getUser()` and redirects unauthenticated users before route handlers run.
- Both return `{ user, supabase, error }` — return `error` immediately if truthy
- Located at `src/lib/auth-guard.ts`

## Key Patterns

### Route Handler Pattern
```typescript
// src/app/api/something/route.ts
import { requireAuthFast } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;
  // ... query supabase
  return Response.json(data);
}
```

### Background Tasks (`after()`)
```typescript
import { after } from "next/server";
// Runs after response is sent — don't block on non-critical writes
after(async () => {
  await supabase.from("table").insert(row);
});
```

### Zod Validation
All POST/PUT body validation uses Zod schemas from `src/lib/schemas/`.

## Data Source of Truth
**SQLite (Electron app) is the authoritative source.** Supabase must mirror SQLite values exactly. Never trust Supabase data over SQLite without verification.

## Project Location
`/Users/ratnakumarchukkapalli/MyExpenseTracker/`
