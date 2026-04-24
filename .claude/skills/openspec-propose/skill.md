---
name: openspec-propose
description: >
  Propose a new feature or change for the MET Webapp. Load specs, understand existing patterns,
  then draft an implementation plan. Use when user wants to add a feature or make a change.
  Trigger when user says "add X", "build X", "implement X" for the webapp.
---

Propose a change for the MET Webapp.

## Step 1: Load relevant specs

Read the specs that apply to the proposed change:
- `openspec/specs/00-system-overview.md` — for architecture questions
- `openspec/specs/01-database-schema.md` — if new tables/columns are needed
- `openspec/specs/02-api-routes.md` — if new/changed API routes
- `openspec/specs/03-components.md` — if new/changed UI components
- `openspec/specs/04-business-rules.md` — always read for any financial feature

## Step 2: Read existing similar code

Find the most similar existing feature and read it to understand the pattern:
- New expense field → read `src/app/api/expenses/route.ts`
- New monthly summary field → read `src/app/api/monthly-summary/[month]/[year]/route.ts`
- New Dashboard section → read relevant section of `src/components/Dashboard.tsx`

## Step 3: Draft the proposal

Write a concise plan covering:
1. **What changes**: files to add/edit
2. **Schema changes**: new Supabase columns/tables if needed
3. **API changes**: new or modified routes
4. **UI changes**: component edits
5. **Business rules**: any new rules to encode
6. **Gotchas**: anything that could trigger a cascade or break existing data

## Constraints (always apply)

- `requireAuth()` for mutations, `requireAuthFast()` for reads
- Background work goes in `after()`
- All POST bodies validated with Zod schema in `src/lib/schemas/`
- Never overwrite real monthly_summary data (salary>0 OR expenses>0) with auto-calculations
- Past months always use `savings_sip`/`savings_shares` snapshot, not live prices
- Amounts in full rupees

## Model guidance

- Use haiku for reading existing code / searching patterns
- Use Sonnet for writing the proposal and implementation plan
