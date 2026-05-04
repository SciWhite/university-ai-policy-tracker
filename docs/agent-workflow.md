# Agent Workflow

OpenClaw can orchestrate crawling and review agents, but it should write only staged data using limited credentials.

## Agent Roles

### policy-manager

Owns crawl schedule, prioritization, queue health, and failed-job triage.

### crawl-designer

Finds candidate official URLs, designs per-university crawl plans, and classifies likely source types before crawling.

### crawl-worker

Executes HTTP fetch, Playwright, opencli, and Firecrawl tasks. It stores artifacts and normalized snapshots but does not publish final policy conclusions.

### policy-extractor

Converts normalized text into structured extraction candidates with taxonomy labels and source evidence.

### policy-reviewer

Checks whether extraction overstates the source, assigns confidence, and marks ambiguous records as `needs_review`.

### report-writer

Generates weekly or monthly MDX reports from reviewed policy changes.

## Publish Rule

Agents may write staged records such as crawl runs, snapshots, diffs, and extraction candidates. Final public policy records should require human review, reviewer approval, or deterministic publish rules.

## Credential Rule

OpenClaw should receive only limited ingestion credentials. It should not receive production database superuser credentials, Vercel deployment credentials, or broad API keys that can modify public infrastructure.
