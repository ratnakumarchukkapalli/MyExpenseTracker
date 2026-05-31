# X + LinkedIn Posting Backlog

Personal posting strategy for the build-in-public + AI Engineer career arc. Source material lives in [retrospective.md](retrospective.md) (ideas 1-37) and [ml-plan-review.md](ml-plan-review.md) (ideas 38-42).

Workflow: in any Claude Code session, type `/posts` to load the strategy skill. Status tracking and draft state live in `~/.claude/projects/-Users-ratnakumarchukkapalli-MyExpenseTracker/memory/posting-strategy.md` (auto-loaded by the skill).

## Cadence
- **X:** 1/day, 5-6 days/week. 3-7 tweet threads.
- **LinkedIn:** 2/week (Tue + Fri). 200-400 word narrative.
- **Blog (Medium/Hashnode):** 1/month. Synthesis of 3-5 X threads.
- **Posting time:** 7-10 PM IST.

## Voice rules
- Specific numbers, contrarian angle, real production credibility
- No emojis, no fluff, no exclamation marks
- Purpose framework — pick one per post:
  - **A** — Showcase the build (recruiter signal only)
  - **B** — Architectural judgment (Staff+ signal)
  - **C** — Teach when NOT to do X (gets shared, builds following)
- Sweet spot: **B + C combined**

## Confidentiality (mandatory before any post)
All posts referencing TR systems must scrub:
- LoC counts, tool counts, agent counts → "production-scale", "several"
- Config values (weight numbers, thresholds, TTLs) → omit
- Literal routing syntax (`@datadog`, `@k8s`) → "explicit user intent prefixes"
- Infra fingerprints (Datadog, EKS, Postgres+RabbitMQ in cluster) → generic terms
- Employer name → "on a recent project"

Preserve: architectural reasoning, decision-making process, generic CS lessons, Staff+ signal lines.

---

## ★ Top 7 — strongest engagement, post these first

| # | Idea | Risk | Status |
|---|---|---|---|
| 1 | Why I rejected LangGraph and CrewAI | Med | ✅ POSTED 2026-05-17 (X + LinkedIn) |
| 2 | JWT RS256 with pre-algorithm validation — alg-confusion attack defense | Low | backlog |
| 3 | Enterprise M2M auth vs shared LLM proxy — SPOF, latency, identity audit | **High** | backlog |
| 4 | SSE with 15-second heartbeats, not WebSockets — surviving corporate proxies | Low | backlog |
| 5 | Opus as default, not Sonnet — cost recovered in one avoided wrong tool selection | **High** | backlog |
| 6 | Context truncation at 80%, not 90% — lessons at production scale | Med | backlog |
| 7 | Senior DevOps → AI Engineer, not ML Engineer — identity reframe | **Low** | next up |

## Architecture decisions (8-17)

| # | Idea | Risk |
|---|---|---|
| 8 | Three specialized agents, not one mega-agent — tool ambiguity at scale | High |
| 9 | Weighted keyword scoring (infra/cert/observability weights) | High |
| 10 | NeMo Guardrails + regex fallback — defense in depth for prompt injection | Med |
| 11 | Secrets PATCH auto-backs-up to KV store — "who changed it" without audit events | High |
| 12 | No auth on internal monitoring — mesh AuthorizationPolicy is enough | Med |
| 13 | 60-second TTL on connectivity health probes — preventing probe timeouts | Med |
| 14 | Replacing Lambda with CodeBuild for 120-min provisioning | Low |
| 15 | Why I rejected expanding Stakater Reloader — operational surface area cost | Low |
| 16 | Three-stage SonarQube tab rewrite — removing an integration entirely | Med |
| 17 | Two VirtualServices per service (public + private) — WAF posture by audience | Med |

## Operational incidents (18-27) — story-driven, strong on LinkedIn

| # | Idea | Risk |
|---|---|---|
| 18 | 502 with 92ms EOF — TLS cipher mismatch on HTTP/2 (DHE banned by RFC 7540) | Low |
| 19 | Logical replication slot lost after failover | Low |
| 20 | wal_status=lost — when WAL exceeds max_slot_wal_keep_size | Low |
| 21 | Orleans grain timeout that wasn't Orleans — cross-namespace JDBC exhaustion | Low |
| 22 | Mesh AuthorizationPolicy silently blocking | Low |
| 23 | Orleans 3.4.3 membership flood — SELECT DISTINCT before any DELETE | Low |
| 24 | All-file 403s from a CDN — check WAF IP sets first | Low |
| 25 | Exit 139 + message-queue timeout — DI constructor Task.Wait() is brittle | Low |
| 26 | PreSync vs PostSync deadlock — ExternalSecrets sync timing in ArgoCD | Low |
| 27 | Config drift — max_wal_size mismatch kept standby stuck 48 hours | Low |

Note: incidents are safe at low risk *only if* anonymized — no employer name, no internal system names, no team-identifying details.

## Discipline / lessons / opinion (28-37)

| # | Idea | Risk |
|---|---|---|
| 28 | Verify before claiming — lead with the command, not the theory | None |
| 29 | Stop and reset when the story shifts — restart investigations cleanly | None |
| 30 | End-to-end before concluding — trace every layer in infra/network problems | None |
| 31 | Manually-managed services are the failure surface | None |
| 32 | Audit agents before the AI assistant, not alongside | Low |
| 33 | Document operational decisions inline as ADRs, not in private notes | None |
| 34 | Flag library EOL on day one, not in year two | None |
| 35 | Postgres-backed memory on AI agents from v1 | Low |
| 36 | SQL allowlist on diagnostics APIs — cheap defense | None |
| 37 | Standardize frontend outputPath upfront | None |

## Career, AI Engineer, ML (38-42) — easiest to ship

| # | Idea | Risk |
|---|---|---|
| 38 | Evals are not a phase — they're a cross-cutting concern from day one | None |
| 39 | Most production AI doesn't need fine-tuning — order of operations | None |
| 40 | The Mac AI stack — Ollama + MLX + pgvector + Pydantic AI vs LangChain default | None |
| 41 | ADR per phase + blog post per quarter — the architect-track discipline | None |
| 42 | AI Engineer ≠ ML Engineer ≠ ML Researcher — the role distinction | None |

## Future ideas (added after 42)

| # | Idea | Risk |
|---|---|---|
| 43 | When I'd revisit CrewAI — multi-domain correlation (K8s ↔ Datadog) requires it, routing doesn't | Med |

---

## Risk legend

- **None** — generic CS principles, career narrative, opinion. Always safe.
- **Low** — references operational categories or generic patterns. Safe with light anonymization.
- **Medium** — references TR-style architecture patterns. Needs careful scrubbing of specifics.
- **High** — references TR-specific systems (AI ops assistant, internal auth, internal model selector). Heavy scrubbing required; assume colleagues will recognize the system.

## How to add ideas

Append to the relevant category section. If unsure where it fits, append to "Future ideas." Then mirror the addition in `~/.claude/projects/-Users-ratnakumarchukkapalli-MyExpenseTracker/memory/posting-strategy.md` so the `/posts` skill picks it up.
