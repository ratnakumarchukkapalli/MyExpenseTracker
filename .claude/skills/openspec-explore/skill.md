---
name: openspec-explore
description: >
  Enter explore mode for the MET Webapp (Next.js/Supabase). Load webapp specs and investigate
  problems before implementing. Use when debugging, understanding a feature, or investigating
  a mismatch. Trigger when user asks "why", "what's wrong", "how does X work" about the webapp.
---

Enter explore mode for the MET Webapp. Think deeply. Read the specs first, then the code.

**IMPORTANT: Explore mode is for thinking, not implementing.** Read files, search code, investigate — but do NOT write code. If the user asks to implement, exit explore mode first.

## First: Load webapp specs

Read the relevant spec(s) based on the question:

| Question type | Read first |
|---------------|-----------|
| Net worth / monthly summary | `openspec/specs/04-business-rules.md` |
| Data structure / schema | `openspec/specs/01-database-schema.md` |
| API behavior | `openspec/specs/02-api-routes.md` |
| Component/UI behavior | `openspec/specs/03-components.md` |
| Architecture overview | `openspec/specs/00-system-overview.md` |

Read only the spec(s) that apply — skip the rest.

## Then: Investigate the codebase

Use grep/read to verify behavior against the spec. Key files:
- `src/app/api/monthly-summary/[month]/[year]/route.ts` — carry-forward + auto-sync guard
- `src/components/Dashboard.tsx` — net worth calculation, snapshot rule
- `src/lib/auth-guard.ts` — requireAuth vs requireAuthFast
- `src/lib/monthly-totals.ts` — expense total recalc

## The Stance

- Curious, not prescriptive
- Read the spec before reading code — it's faster and cheaper
- Use model: haiku for pure codebase searches (grep, ls, find)
- Surface what you find; let the user decide how to proceed

## Common Investigations

**Net worth mismatch (webapp vs Electron app):**
1. Read `04-business-rules.md` — snapshot rule section
2. Check Dashboard.tsx `isCurrentMonth` guard
3. Verify Supabase `monthly_summary.savings_sip` / `savings_shares` match SQLite

**API cascade (viewing one month corrupts another):**
1. Read `02-api-routes.md` — monthly-summary GET section
2. Check `route.ts` auto-sync guard: `isCarryForward` condition
3. If real month data got overwritten, re-patch from SQLite values (see `04-business-rules.md` bulk sync pattern)

**Carry-forward row issues:**
1. Read `04-business-rules.md` — carry-forward section
2. Verify `salary=0 AND total_expenses=0` condition in route.ts
