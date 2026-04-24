---
name: openspec-apply-change
description: >
  Apply an approved change to the MET Webapp. Load specs, implement minimally following
  existing patterns. Use when the user has approved a plan and wants implementation to start.
---

Implement an approved change for the MET Webapp.

## Before writing any code

1. Read `openspec/specs/04-business-rules.md` — always, for any financial feature
2. Read the spec file(s) relevant to what you're changing
3. Read the existing file you'll edit — grep for the function/section first to get the line range

## Implementation rules

- Follow existing patterns in the file (spacing, imports, error handling style)
- `requireAuth()` for mutations, `requireAuthFast()` for reads
- Validate POST bodies with Zod — add schema to `src/lib/schemas/` if new
- Background work: use `after()` from `next/server`
- Never delete from `monthly_summary` — update in place
- Amounts: full rupees, never lakhs
- After any `src/` change: verify with `npm run build` (no errors)

## Do NOT

- Use live `current_nav × units` for past month portfolio values
- Auto-sync `remaining_amount` for months with salary/expense data
- Guess financial values — query Supabase to verify
- Add features beyond what was approved

## After implementation

Summarize: which files changed, what was added/modified, how to verify.
If DB schema changed: note the migration SQL needed in Supabase dashboard.
