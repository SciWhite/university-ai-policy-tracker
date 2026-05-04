# OpenClaw Multi-Agent Workflow

This document defines the six isolated OpenClaw agents used for automated university AI policy crawling, extraction, review, and reporting.

## Agents

### 📋 policy-manager

**Role:** Orchestration, scheduling, and failure triage.

- Generates run IDs and sets crawl parameters (target schools, max URLs, rate limits).
- Monitors crawl status, aggregates failures, and triggers retries.
- Creates `bot/crawl/*` branches; never pushes to `main`.
- Does **not** fetch web pages directly.
- Does **not** modify final policy data.

### 🗺️ crawl-designer

**Role:** Crawl plan generation.

- Produces per-university crawl plans with candidate URLs, search terms, source types, priorities, and risk notes.
- Does **not** execute browser or fetch operations.
- Does **not** call LLMs to draw final policy conclusions.
- Does **not** mark unverified pages as official policy sources.

### 🕷️ crawl-worker

**Role:** Web fetching and snapshot capture.

- Executes HTTP fetch, Playwright, opencli, and Firecrawl (fallback only).
- Priority order: HTTP → Playwright/opencli → Firecrawl.
- Saves normalized markdown, metadata JSON, content hash, HTTP status, and final URL.
- Does **not** write to `policy_versions` or final data tables.
- Does **not** bypass login walls, CAPTCHAs, paywalls, or `robots.txt` disallows.

### 🔬 policy-extractor

**Role:** Structured extraction from crawled content.

- Converts normalized text into extraction candidate JSON.
- Every candidate must cite: source URL, snapshot hash, and relevant text span.
- Uses `Not mentioned`, `No specific AI service named`, or `needs review` when uncertain.
- Does **not** make unsupported inferences.

### ✅ policy-reviewer

**Role:** Quality gate for extraction candidates.

- Checks that each conclusion is supported by the cited source.
- Assigns `confidence`, `review_state`, and `failure_reason`.
- May reject candidates but does **not** write directly to `main`.
- Proposes changes via bot branches and PRs.

### 📝 report-writer

**Role:** Report draft generation.

- Generates MDX report drafts from reviewed/proposed policy changes.
- Writes drafts to `content/reports/drafts/`.
- Does **not** publish final reports; awaits PR review and merge.

## Shared Constraints

| Constraint | All Agents |
|---|---|
| Write target | Bot branches only (`bot/*`, `chore/*`) |
| `main` protection | No direct push, no force push |
| Secrets | No token printing, no credential leakage |
| Rate limits | Respect per-host concurrency and delay |
| `robots.txt` | Always honored |
| Access controls | No login/paywall/CAPTCHA bypass |
| Final data | Requires human review or deterministic publish rules |

## Credential Isolation

Each agent receives only the minimum credentials it needs:

- **crawl-worker**: GitHub token (branch push only), optional Firecrawl key.
- **policy-extractor, policy-reviewer**: Read access to repo contents.
- **report-writer**: Write access to `content/reports/drafts/` on bot branches.
- **policy-manager**: GitHub token (branch creation), no web fetch credentials.
- **crawl-designer**: No credentials needed; outputs plans as JSON/Markdown.

Agents must never receive:

- Production database superuser credentials
- Vercel deployment tokens
- Broad API keys that modify public infrastructure
