# Phase 6 — RAG + Local LLM ("Ask your finances")

> Traditional ML (Phases 0-5) fit curves and scored numbers.
> RAG is different: it retrieves the *right pieces of your own data*, then
> hands them to an LLM to reason over in plain English.

Fast-tracked ahead of Phases 2-5 (see [../../PLAN.md](../../PLAN.md) — those
phases are unrelated to RAG mechanics; only Phase 1's dot-product math carries
forward here).

---

## The big idea, corrected

The original one-liner ("embed the question, embed every expense, cosine
top-10, ask Gemma") is a well-known RAG anti-pattern for a question like
*"how much did I spend on Swiggy in Q1?"* — that's a `SUM()`, and
top-10-by-similarity will silently drop matching rows past #10, so the LLM
confidently gives a wrong total.

Production RAG over structured data routes by query shape instead:

```
User question
     │
     ▼
Query router: aggregation/numeric?  ──yes──▶  text-to-SQL against Supabase
     │
     no (semantic/fuzzy)
     ▼
Hybrid retrieval (pgvector cosine + Postgres full-text, fused)
     ▼
[optional] rerank top candidates
     ▼
Gemma 4 (LM Studio, local) — answer grounded in retrieved rows
     ▼
Plain-English answer
```

## Corpus, corrected

`expenses.note` doesn't actually exist as a column — it's declared in the
Zod validation schema but never persisted. The real free-text corpus is
`expenses.description` (required, ≤500 chars) plus `tag` (optional trip tag).
That's what gets embedded for the semantic-search half of the router.

## Infra — what runs where

Confirmed available: **LM Studio** (local, embeddings + generation),
**Supabase** (Postgres + pgvector, free tier), **Vercel** (Next.js hosting).
No Railway.

- **Local dev** (`localhost:3000`): Next.js API proxy → `ml-service`
  (FastAPI, `localhost:8001`) → LM Studio (`localhost:1234`). Full chain
  works because everything is on your machine.
- **Deployed on Vercel**: the proxy route calls `localhost:8001`, which
  means nothing on Vercel's servers — there's no ml-service reachable from
  the cloud, on purpose (no Railway, no paid inference). The route detects
  this (connection failure / timeout) and degrades gracefully — the chat
  widget shows "AI features run locally" instead of erroring. Matches this
  project's stated policy: free-tier or local-only AI features, always.

## Pipeline steps (bd: `MyExpenseTracker-7vl`, children `.1`–`.8`)

Each step gets its own file in this folder once we build it — concept
first, then the code, one step at a time.

| # | bd issue | Step | Status |
|---|---|---|---|
| 1 | `.1` | pgvector migration (embedding column + HNSW index) | Concept done, migration drafted (`scripts/022_rag_pgvector.sql`), not yet applied |
| 2 | `.2` | Embedding pipeline (LM Studio, write-time + backfill) | Not started |
| 3 | `.3` | Hybrid retrieval (pgvector cosine + full-text, RRF) | Not started |
| 4 | `.4` | Query router (SQL vs vector) | Not started |
| 5 | `.5` | `/ask` endpoint (grounded generation) | Not started |
| 6 | `.6` | RAGAS eval harness | Not started |
| 7 | `.7` | LangFuse tracing | Not started |
| 8 | `.8` | Chat widget UI | Not started |

## Done When

- [ ] `/ask` endpoint accepts a natural-language query, routes it correctly, returns a grounded answer
- [ ] Aggregation questions never go through vector retrieval
- [ ] Expense rows are embedded and indexed (pgvector + HNSW)
- [ ] Retrieval is hybrid (semantic + lexical), not vector-only
- [ ] RAGAS scores exist for a hand-labeled query set
- [ ] LangFuse traces retrieval + generation end to end
- [ ] Feature degrades gracefully when ml-service/LM Studio aren't reachable (Vercel)
- [ ] You can explain every stage above without notes
