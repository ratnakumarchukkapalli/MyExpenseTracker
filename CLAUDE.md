@AGENTS.md

## Career context
See [learning/career/retrospective.md](learning/career/retrospective.md) for my TR work background and [learning/career/ml-plan-review.md](learning/career/ml-plan-review.md) for the industry-validated review of the 9-phase plan.

## Verification — Task Not Done Until
- `npm run build` passes (Next.js build, no errors)
- `npx tsc --noEmit` passes (no TypeScript errors)
- If UI changed: visually confirm in browser before reporting done

## AI/ML Feature Philosophy — Non-Negotiable
Every AI/ML feature must satisfy all three:
1. **Production-ready** — auth-gated, secure, deployable on Vercel/Railway
2. **Learning-oriented** — explain the ML concept, algorithm, and tradeoffs while building. If Ratna can't explain what it does and why, we haven't finished.
3. **Interview/career-ready** — Ratna must be able to walk an interviewer through: what was built, what problem it solves, what model/algorithm was used and why, and what result it achieved. Every feature is a portfolio piece.

If a feature doesn't serve all three goals, rethink it before building.

## Security — Every Feature Must Pass This Before Done
- All API routes protected with `requireAuthFast` (no unprotected endpoints)
- API keys in `.env.local` + Vercel vault only — never hardcoded or logged
- All user input validated/sanitized at the API boundary
- No sensitive data (keys, user PII) in client-side code or browser-visible responses
- Any route calling a paid external API (Anthropic, Yahoo Finance) must be auth-gated


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
