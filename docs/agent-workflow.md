# Agent Workflow

OpenClaw can orchestrate crawling and review agents, but it should write only staged data using limited credentials. It must not deploy the public website, write the production database directly, or push `main`.

## Agent Roles

### policy-manager

Owns crawl schedule, prioritization, queue health, and failed-job triage.

### crawl-designer

Finds candidate official URLs, designs per-university crawl plans, and classifies likely source types before crawling.

### crawl-worker

Executes HTTP fetch, Playwright, opencli, and Firecrawl tasks. It stores artifacts and normalized snapshots but does not publish final policy conclusions.

### policy-extractor

Converts normalized text into structured extraction candidates with taxonomy labels and source evidence. For GEO-ready output, it should also prepare claim/evidence/citation candidates that can validate against the public data contract.

### policy-reviewer

Checks whether extraction overstates the source, assigns confidence, and marks ambiguous records as `needs_review`.

### report-writer

Generates weekly or monthly MDX reports from reviewed policy changes.

## Publish Rule

Agents may write staged records such as crawl runs, snapshots, diffs, extraction candidates, claim evidence, and source attributions. Final public policy claims should require human review, reviewer approval, or deterministic publish rules.

## Staged Ingestion Flow

The internal ingestion API is intentionally staged:

1. `POST /internal/ingest/crawl-run` records the attempted fetch, target URL, fetch mode, status, robots decision, and failure metadata.
2. `POST /internal/ingest/source-snapshot` stores normalized source text and a content hash for a known university/source.
3. `POST /internal/ingest/extraction-candidate` stores machine or agent extraction output linked to a source snapshot.
4. Future claim/evidence ingestion should validate policy claims, claim evidence, and source attribution before anything becomes public JSON.

These endpoints require an `INGESTION_TOKEN` supplied as either `Authorization: Bearer <token>` or `x-ingestion-token`. The token is a placeholder for local/internal use in this phase; no OpenClaw credentials are connected yet.

OpenClaw or any future agent runner should write only through staged records or GitHub pull requests. It should not write reviewed public policy versions or public claims directly.

## Credential Rule

OpenClaw should receive only limited ingestion credentials. It should not receive production database superuser credentials, Vercel deployment credentials, or broad API keys that can modify public infrastructure.

## Public Contract Rule

Public claims require source URL, source snapshot hash, and a short evidence snippet. `confidence` remains machine confidence, while `reviewState` remains workflow status. Student-facing and course-level features should reuse this same claim/evidence model instead of introducing unsupported public comments.

## Data PR Validation

OpenClaw data PRs must validate before review:

```bash
pnpm validate:openclaw-artifacts path/to/staging-directory
```

Expected staged artifact types are `crawl_plan`, `source_snapshot`, `claim_candidate`, `evidence_candidate`, `review_decision`, and `report_draft`. OpenClaw must not mark its own output as `human_reviewed` and must not set candidate claims as canonical/public facts.

Reviewers should use `docs/openclaw-data-prs.md` as the checklist for data PRs.
