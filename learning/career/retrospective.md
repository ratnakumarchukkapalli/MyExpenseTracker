# Technical Contributions Retrospective — Public Version

**Author:** Ratna Kumar Chukkapalli
**Role:** Senior DevOps Engineer
**Tenure when written:** ~1.5 years on current platform
**Date:** 2026-05-11
**Purpose:** Career context for architect-track conversations. Safe for personal Claude, LinkedIn, resume drafting, and external interviews. Internal identifiers stripped; technical substance preserved.

---

## 1. What I've built — at a glance, by depth of ownership

| Item | My commits / Total | Depth |
|---|---|---|
| Multi-agent AI Ops platform (Python/FastAPI + Claude Opus) | **192 / 192 (100%)** | Sole author, initial commit forward |
| K8s operations REST API (Python/FastAPI) | **39 / 53 (74%)** | Initial commit + end-to-end |
| Cloud resource monitoring API + Teams reporting (Python/FastAPI) | **7 / 9 (78%)** | Initial commit + end-to-end |
| Internal DevOps React dashboard | **64 / 150 (43%)** | Major contributor; joined after initial scaffold |
| AWS CDK platform for Windows CI runner provisioning | **19 / 39 (49%)** | Major contributor; replaced Lambda with CodeBuild, added test infrastructure |
| Async DynamoDB deployment catalog (Python/FastAPI) | **14 / 78 (18%)** | Targeted features |
| PostgreSQL diagnostics API (Python/FastAPI) | **5 / 21 (24%)** | Small fixes (test infrastructure, base image) |
| Large GitOps Helm charts monorepo (~9.5K commits total) | **1,134 / 9,501 (12%)** | Heavy operator + contributor; did not author standards |
| Reusable GitHub Actions workflows monorepo | **44 / 548 (8%)** | User + minor contributor |
| 18 documented production incidents with runbooks | n/a | Personal investigation log |
| 4 investigation/audit agents (codified playbooks) | n/a | Personal meta-tooling |

The platform I operate on: 40+ .NET 8 microservices, ~120 Helm charts across non-prod + prod, 8 environments on AWS EKS (with on-prem Outposts variant), Istio mTLS, Argo Rollouts canary, Crunchy Postgres operator with Patroni HA, RabbitMQ operator, ArgoCD GitOps, 18 PostgreSQL clusters with logical replication into an analytics warehouse.

---

## 2. The biggest bet — a multi-agent AI Ops platform

### What it is

A production-grade, multi-tenant AI operations assistant. ~144K LoC across 149 Python files, 42 test suites with 11K LoC of tests, 143 tool functions, FastAPI + Streamlit, deployed via its own Helm chart to the same Kubernetes cluster it monitors. Built on Anthropic's Claude Opus model accessed through our enterprise SSO M2M authentication path (not the consumer API, not a proxy).

### What problem it solves

Engineers were context-switching across `kubectl`, observability dashboards, Postgres `psql` sessions, message-queue UIs, and HA-cluster health endpoints during every incident. Each tool was a separate skill ramp and a separate set of credentials. The first 90 seconds of every page were spent assembling the same set of commands. The assistant owns the "what should I check first" layer and produces investigation output with citations to the source tool runs.

### Architectural decisions I made and what I rejected

**Three specialized agents, not one mega-agent.** I split the system into an Observability agent (logs, traces, metrics, RED correlation), a Cluster/Infra agent (pods, events, HPA, rollouts, plus eight subsystem modules — Postgres, message queues, search, certificates, secret-compare, infra-drift), and a TLS Certificates agent. Reason: tool ambiguity is the #1 failure mode in single-agent designs. With 143 tools in one namespace, the model picks the wrong one frequently; with three scoped agents, each agent's prompt and tool set stay focused.

I considered LangGraph and CrewAI as orchestration frameworks. Both were over-engineered for this use case (graph routing, role-playing) and would have locked me into their abstractions. I built a minimal orchestrator (~530 lines) instead. It's two-stage:

1. **Explicit routing** — `@observability`, `@cluster`, `@cert` mentions override everything.
2. **Weighted keyword scoring** — Infra keywords carry weight 2.5; cert keywords carry 2.0; observability generic keywords carry 1.5. Winner-take-all. This skew exists because a phrase like "postgres health" is unambiguously an infra question even though "health" alone reads as observability.

**Opus as the default, not Sonnet.** I chose accuracy over cost. Technical users running root-cause analyses need correct tool selection on the first try; a 3× cost premium versus Sonnet is recovered the moment a wrong tool selection wastes a 30-minute investigation. The model selector still drops to Sonnet for simple "list/show/get" queries and to Haiku for greetings, but the bias is toward quality.

**Enterprise SSO M2M auth, not static API keys.** Most internal AI tooling at large companies uses a LiteLLM-style proxy with a shared service token. I rejected that path because (a) the proxy adds latency and a SPOF, (b) shared tokens don't carry user identity for audit, and (c) tokens still need daily rotation. Instead, the assistant uses enterprise M2M client credentials — Common Token API — real Anthropic API key with `expires_on` field. The wrapper caches the bearer token, refreshes transparently on expiry, and falls back to a static dev token for local development. Result: no daily human rotation, continuous service-account refresh, direct Anthropic API access without a proxy hop.

**JWT RS256, pre-algorithm-checked.** The auth path explicitly rejects HS256/none *before* signature verification — a defense against the classic algorithm-confusion attack. JWKS keys cached, 120 s clock skew, identity claims extracted.

**SSE streaming with a 15-second heartbeat.** `/v1/chat/stream` yields typed events (`status`, `tool`, `delta`, `error`, `done`). The heartbeat keeps TCP alive during long backend scans; without it, the corporate proxy reaps the connection after 30 s and the user thinks the bot hung. Stream aborts after 120 s of silence. Each event is a single yield to avoid TCP fragmentation. I considered WebSockets and rejected them — SSE is HTTP, traverses the service mesh without special config, and is trivially compatible with Streamlit.

**Context truncation at 80% of the 200K window, not 90%.** Tested at production scale (50-turn conversations + 80K of tool output), 90% was hitting the boundary error too often. 20% safety margin is the right cushion.

**NeMo Guardrails for prompt injection with a regex fallback.** If NeMo is available, it runs. If not, regex masks cloud access keys, version-control tokens, PEM blocks, and bearer tokens before logs are written. Defense in depth, not the primary control — the primary control is JWT auth + scoped tool sets.

### Why this is differentiated

Most engineers building internal AI tools wrap an LLM around `kubectl` or an observability API and call it done. This one has:

- **Domain-aware routing** with weighted keyword scoring, not a single agent
- **143 functional tools** organized into 10 modules, not a thin tool layer
- **Native enterprise auth** (M2M — Common Token API), not a shared proxy
- **Production deployment** on the same cluster it monitors, with its own Helm chart, mesh mTLS, JWT auth, rate limiting, RFC 9457 error format, OpenTelemetry spans, Prometheus metrics
- **42 test suites and 11K LoC of tests** — most internal AI tools have none

---

## 3. Two FastAPI services I built end-to-end

### K8s operations API (74% commits, initial commit mine)

FastAPI on port 8000, JWT RS256 + API key fallback, kubernetes-python client with `load_incluster_config()` + `load_kube_config()` fallback for local dev. Handles pod restart, service status, uptime, and secrets CRUD. 267 tests across 17 files — the most rigorously tested service I've built.

Non-obvious decision: **secrets PATCH auto-backs-up to a key-value store before writing.** Cloud Secret Manager versioning is fine for recovery but useless for "who changed it and when." I wanted the "who" without paying for audit-log data events on every secret.

### Cloud resource monitoring + Teams reporting (78% commits, initial commit mine)

Monitors block storage utilization + orphan detection, standalone compute instances, and Kubernetes pod request-vs-actual efficiency. Daily CronJob posts an Adaptive Card to Teams with trend indicators. History persisted in a PersistentVolume so trends survive pod restarts.

Non-obvious decision: **No auth on the service itself.** Service mesh AuthorizationPolicy restricts to the ingress gateway service account, and the only consumer is the internal portal. Adding API keys would be ceremony for no security gain.

---

## 4. GitOps platform I operate at scale

I operate and contribute to a 9,500-commit GitOps monorepo (12% authorship). I did **not** author the chart layout, sync wave ordering, or the security/Istio standards — those were established before my time. What I did was learn the platform deeply and contribute specific operational patterns.

### Sync wave ordering I uphold

```
-1 DB migrations → 0 ExternalSecrets → 1 Service → 2 DR+AuthPolicy → 3 VirtualService → 4 Rollout → 5 HPA
```

### Operational lessons I contributed back

- **PreSync hooks cannot depend on resources synced in the regular phase.** A PreSync Job that reads from an ExternalSecret-managed Secret deadlocks in `CreateContainerConfigError`. Fix: PostSync, not PreSync.
- **Config drift across environments is a latent incident.** A host reboot exposed `max_wal_size` drifted between environments (256 MB in one, 1–2 GB in others), which kept a standby stuck for 48 hours. Rule: Postgres param changes touch all environment values files in the same PR.

---

## 5. Operational depth — 18 incidents I investigated

Representative patterns internalized:

| Pattern | The lesson |
|---|---|
| 502 with ~92ms EOF on HTTPS/2 | TLS cipher mismatch — DHE is banned for HTTP/2 per RFC 7540 §9.2.2. `curl` hides this. |
| Logical replication slot lost after failover | Slots don't carry over from primary to replica unless propagated. |
| `wal_status=lost` on replication slot | Agent was offline long enough for WAL to exceed `max_slot_wal_keep_size`. |
| Orleans grain timeout (distributed actors) | Cross-namespace pressure: unrelated app held 93 idle JDBC connections, exhausting memory. |
| Mesh AuthorizationPolicy silently blocking | mTLS + RBAC fail without obvious errors. Suspect them first. |
| Distributed-actor membership flood (Orleans 3.4.3 bug) | `SELECT DISTINCT` before any DELETE on membership tables. |

### Cross-cutting investigation discipline

- **Verify before claiming** — lead with the verification command, not the theory.
- **Stop and reset when the story shifts** — if evidence contradicts the theory, restart cleanly.
- **End-to-end before concluding** — trace every layer (app → env var → proxy → DNS → endpoints → cloud service).

---

## 6. What I'd do differently

1. Helm-manage everything from day one (replication agents, browser grids sat outside Helm, caused incidents).
2. Flag library EOL on day one, not in year two.
3. Build the audit agents BEFORE the AI Ops assistant, not alongside.
4. Add a SQL allowlist on the diagnostics API early.
5. Use Postgres-backed memory on the AI assistant from v1 (in-memory means session loss on pod restart).
6. Document operational decisions inline as ADRs, not in private notes.
7. Keep "Claude proposed this" vs "I decided this" boundary explicit when working with AI tools.

---

## 7. Career thesis

**Breadth:** Kubernetes, PostgreSQL, distributed actors, message queues, AWS (EKS Outposts, EBS, EC2, Secrets Manager, CDN, WAF, DynamoDB, CDK), networking (RFC 7540 cipher constraints, NO_PROXY, VPC endpoints), observability.

**Depth in two areas:** The AI Ops assistant (three-agent orchestrator, 143 tools, enterprise M2M auth, SSE streaming, JWT pre-algorithm validation, NeMo Guardrails) — sole author. PostgreSQL operational layer (config-drift forensics, noisy-neighbor connection-pool pressure, on-prem backup-tool architectural gaps).

**Solutions-architect mindset:** Challenge tech choices with cost/complexity reasoning. Examples: rejecting shared LLM proxy in favor of M2M (latency + SPOF + identity); rejecting wider Reloader rollout; replacing Lambda with CodeBuild for timeout/cold-start constraints.

**Productizing internal tools:** The two FastAPI services + the AI Ops assistant are *products*, not scripts. JWT RS256, RFC 9457 errors, OpenTelemetry, Prometheus, 267 tests in one service alone, Helm charts, mesh policies, Teams Adaptive Card delivery. Pattern: treat your engineering team as your customer.
