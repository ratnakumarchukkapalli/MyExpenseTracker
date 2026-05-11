# ML Learning Plan Review — Industry-Validated Suggestions

**Context:** Senior DevOps Engineer → AI Engineer track. Built a production multi-agent AI Ops assistant (sole author, ~192 commits, Claude Opus + FastAPI + Streamlit + enterprise SSO M2M + 143 tools + NeMo Guardrails). Goal: architect-track + AI Engineer positioning by mid-2027.

**Project:** MyExpenseTracker (Next.js/TS) with openspec specs, beads issue tracking, and a 9-phase ML learning plan.

---

## 1. Reframe: AI Engineer, not ML Engineer

| Role | Focus |
|---|---|
| **ML Researcher** | Novel algorithms, papers, new architectures |
| **ML Engineer** | Training pipelines, feature stores, model lifecycle |
| **AI Engineer** | Building on foundation models: RAG, agents, evals, tool use, fine-tuning |

**You're already 80% an AI Engineer.** The multi-agent AI Ops assistant at work IS AI Engineering. "Senior DevOps → AI Engineer" is a shorter jump than "DevOps → ML Engineer" and reflects what you actually do.

References that codify this:
- Chip Huyen, *AI Engineering* (O'Reilly, 2025) — the discipline's textbook
- swyx "The Rise of the AI Engineer" essay (2023) — coined the identity
- AI Engineer Summit/Conference (2023–2025) — the field's annual gathering

---

## 2. Three industry-validated gaps in the 9-phase plan

### Gap 1: Evals are not a phase — they're a cross-cutting concern

**The biggest lesson from 2024–2025:** evals are the #1 differentiator between demo-ware and production AI. Hamel Husain (hamel.dev) and Eugene Yan (eugeneyan.com) are the canonical references.

Pattern: for every AI feature you ship, build an eval set first. The eval set defines "what does correct look like" and becomes your regression suite. Without it, you can't tell if a prompt change or model upgrade made things better or worse.

**Adjustment to plan:** Add an `evals/` directory and harness in Phase 0. Every subsequent phase contributes test cases.

Industry-standard eval tools:
- **Anthropic Inspect** — open source, rigorous
- **Promptfoo** — simple, YAML-driven, good for starting
- **LangSmith** — production-grade, paid
- **DeepEval (Confident AI)** — open source, growing

### Gap 2: Embeddings before RAG

Phase 6 (RAG) assumes embeddings are understood. Better to split: Phase 5.5 = embeddings, vector DBs, similarity search — then Phase 6 = retrieval-augmented generation.

Industry-standard stack:
- **pgvector** — Postgres extension, default if you already run Postgres
- **LanceDB** — embedded, file-based, fast growing
- **Embedding models:** `nomic-embed-text` (local, free), `voyage-3` (Voyage AI), `text-embedding-3-small` (OpenAI)

### Gap 3: Fine-tuning at Phase 8 may be overkill

2024–2025 industry consensus (Chip Huyen, Hamel Husain, Andrej Karpathy): **most production AI doesn't need fine-tuning.** The order of operations:

1. Prompt engineering
2. Few-shot examples in the prompt
3. RAG
4. Tool use / agents
5. Then *maybe* fine-tuning

Fine-tuning is for: domain-specific format/style, latency reduction, or proprietary patterns the base model can't learn from few-shot. For an expense tracker, RAG + prompt engineering will likely get there.

**Adjustment:** Keep Phase 8 for learning the technique — but frame it as "learn it, then learn when to skip it." On Mac, use **MLX-LM** not Unsloth (which is CUDA-only).

---

## 3. Mac-native tooling (Apple Silicon)

| Tool | What it does | Why it matters on Mac |
|---|---|---|
| **MLX** (Apple) | Apple's array framework with native Metal acceleration | 2–3× faster than CPU PyTorch on M-series |
| **Ollama** | Local LLM runtime (CLI + REST API) | Industry standard; one-line install; Metal-accelerated |
| **MLX-LM** | Fine-tuning + serving on MLX | Use for Phase 8 instead of Unsloth |
| **LM Studio** | GUI for local LLMs | Good for exploration; production teams prefer Ollama |

**For Phase 6 (RAG with local LLM):** Ollama + pgvector + Pydantic AI + Anthropic SDK fallback. Faster and simpler than LangChain. Install Ollama when you reach Phase 6.

---

## 4. The production AI stack (2025 standard)

| Concern | Standard choice | Notes |
|---|---|---|
| LLM SDK | **Anthropic SDK** or **OpenAI SDK** directly | LangChain losing ground to direct SDK use |
| Structured outputs | **Instructor** or **Pydantic AI** | Pydantic AI (2024) very well-designed |
| Agent patterns | **Anthropic "Building effective agents"** (Dec 2024) | Prompt chaining, routing, parallelization, orchestrator-workers |
| Tool integration | **MCP (Model Context Protocol)** | Anthropic Nov 2024; cross-vendor standard by 2025 |
| Evals | **Promptfoo** (simple) or **Anthropic Inspect** (rigorous) | |
| Observability | **LangFuse** (open source, self-hostable) or **Helicone** | Track tokens, cost, latency, eval scores |
| Vector DB | **pgvector** | Default if already using Postgres |
| Local LLM | **Ollama** | One-line install, REST API, Metal-accelerated |
| Fine-tuning on Mac | **MLX-LM** | Native; CUDA tools won't work |
| Prompt caching | Anthropic prompt caching API | 90% cost reduction on system prompts |

---

## 5. What gives the strongest architect-track signal

| Activity | Signal |
|---|---|
| Per-phase ADR / blog post: "I built X, here are the decisions and trade-offs" | **Very high** |
| Eval harness for every AI feature shipped | **Very high** |
| Public writeup of one production-grade phase (Phase 6 RAG, Phase 7 explainability) | **High** |
| Open-source contributions to tools you already use | **High** |
| Completing all 9 phases without writeups | **Medium** |

**The pattern:** architect candidates are differentiated by *visible decision-making at scale*. Code alone doesn't show it. Writing about decisions does. One blog post per phase explaining trade-offs > five phases completed silently.

---

## 6. Specific updates for MyExpenseTracker plan

1. **Add `evals/` directory and harness in Phase 0.** JSON test cases + a runner script.
2. **Per-phase ADR in `learning/decisions/`**: title, context, decision, alternatives, consequences.
3. **Phase 6 stack:** Ollama + pgvector + Pydantic AI + Anthropic SDK fallback.
4. **Phase 7 (explainability):** natural-language explanations via LLM ("you spent 23% more on dining this month, driven by 3 weekend trips").
5. **Phase 8 (fine-tuning):** use **MLX-LM** on Mac, fine-tune Phi-3 or Llama 3.2 1B on personal transaction categorization. Compare against base model with eval harness.
6. **Add `cost/` track:** log token usage and inference cost per AI feature. Build a small dashboard.

---

## 7. Resources, prioritized

1. **Anthropic "Building effective agents"** — free blog post, 30 min, defines the patterns
2. **Chip Huyen, *AI Engineering*** (O'Reilly, 2025) — the textbook
3. **Hamel Husain's blog** — hamel.dev, start with the evals posts
4. **Eugene Yan's blog** — eugeneyan.com, production patterns
5. **Simon Willison's blog** — simonwillison.net, practical LLM tooling, daily updates
6. **Andrej Karpathy "Neural Networks: Zero to Hero"** — YouTube, for Phase 5 neural nets
7. **Kleppmann *Designing Data-Intensive Applications*** — architect canon
8. **Jason Liu's writing** — jxnl.co, Instructor creator, structured outputs

Reference people to follow: **Chip Huyen, Hamel Husain, Eugene Yan, swyx, Karpathy, Simon Willison**

---

## 8. 12-month framing (architect + AI Engineer by mid-2027)

| Quarter | Focus | Deliverable |
|---|---|---|
| Q2 2026 | Phases 0–3 + eval harness | 2 blog posts, eval-driven AI feature live |
| Q3 2026 | Phases 4–6 (NN + RAG via Ollama + MLX) | 2 blog posts, local-LLM expense insight feature |
| Q4 2026 | Phases 7–8 (explainability + fine-tuning on MLX) | 2 blog posts, fine-tuned model with eval comparison |
| Q1 2027 | Visibility: speaking + open-source contributions | Talk submitted, 2 OSS PRs merged |

**The blog post per quarter is non-negotiable** — it's the visible signal that compounds.

---

## 9. Next work-side initiative

Introduce eval-driven development to the AI Ops assistant: Promptfoo + LLM-as-judge + Prometheus `llm.eval.score`. Mirror the same patterns in MyExpenseTracker Phase 0.
