# University AI Policy Tracker

An open, evidence-backed database of university AI policy records.

The public site is designed as reference infrastructure, not a login-only SaaS:

- source-backed claims tied to official university URLs
- original-language evidence snippets
- visible confidence and review state
- versioned public JSON under `/api/public/v1/...`
- change and freshness pages
- citation-ready university records

Live site: <https://eduaipolicy.org>

## Public Surfaces

Core trust pages:

- Methodology: <https://eduaipolicy.org/methodology>
- Citation: <https://eduaipolicy.org/citation>
- Datasets: <https://eduaipolicy.org/datasets>
- Changes: <https://eduaipolicy.org/changes>

Versioned public JSON:

- API index: <https://eduaipolicy.org/api/public/v1/index.json>
- Universities list: <https://eduaipolicy.org/api/public/v1/universities.json>
- Recent changes: <https://eduaipolicy.org/api/public/v1/recent-changes.json>
- Per-university records: `https://eduaipolicy.org/api/public/v1/universities/{slug}.json`
- Dataset release manifest: <https://eduaipolicy.org/api/public/v1/datasets/latest.json>
- Bulk downloads:
  - <https://eduaipolicy.org/api/public/v1/datasets/universities.jsonl>
  - <https://eduaipolicy.org/api/public/v1/datasets/claims.jsonl>
  - <https://eduaipolicy.org/api/public/v1/datasets/sources.jsonl>
  - <https://eduaipolicy.org/api/public/v1/datasets/changes.jsonl>
  - <https://eduaipolicy.org/api/public/v1/datasets/checksums.txt>
  - <https://eduaipolicy.org/api/public/v1/datasets/data-dictionary.md>

## Data Model Principles

This project separates four layers:

1. Evidence layer: source snapshots, source URLs, source language, hashes, evidence snippets, and claim extraction.
2. Reference layer: crawlable university pages, claim/evidence cards, citation blocks, and change logs.
3. Distribution layer: public JSON, sitemap, `llms.txt`, dataset documentation, and repository trust assets.
4. Contribution and review layer: staged OpenClaw artifacts, pull requests, review states, and institution correction workflows.

Canonical facts and localized display are separate. Original-language evidence is the canonical evidence record. Translations and display summaries may help readers, but they must not replace source evidence.

Confidence and review state are separate:

- `confidence`: machine confidence in an extracted or normalized claim.
- `reviewState`: workflow status such as `machine_candidate`, `agent_reviewed`, `human_reviewed`, `needs_review`, or `rejected`.

This tracker is not legal advice, not academic integrity advice, and not an official university statement unless the linked source is the university's own official page.

## Repository Layout

- `apps/web`: Next.js public site and public JSON route handlers.
- `apps/api`: Node/Nest API surface for server-side reads and ingestion-adjacent work.
- `apps/worker`: worker package placeholder for later scheduled jobs.
- `packages/shared`: shared schemas, public contract types, seed data, and OpenClaw artifact contracts.
- `packages/db`: Prisma schema, migrations, and database helpers.
- `packages/crawler-core`: crawler and diff utilities.
- `data/public-releases`: curated release manifests for public staged data.
- `data/rankings`: university ranking source metadata used by the public index.
- `staging/uapt-runs`: staged OpenClaw or curated artifact directories.
- `docs`: architecture, crawler policy, data contract, and roadmap documents.

## OpenClaw Boundary

OpenClaw may help with crawl planning, source discovery, snapshot generation, claim extraction, evidence binding, review assistance, report writing, and PR generation.

OpenClaw must not:

- write the production database directly
- publish canonical claims without review
- push `main`
- deploy the public website
- bypass robots.txt, login walls, paywalls, or access controls
- mark its own output as `human_reviewed`

See `docs/openclaw-data-prs.md` and `docs/agent-workflow.md`.

## Local Development

Requirements:

- Node.js 20+
- pnpm 10

Install and validate:

```bash
pnpm install
pnpm check
pnpm validate:dataset-release
pnpm --filter @uapt/web build
git diff --check
```

Run the web app:

```bash
pnpm dev:web
```

## Citation

Use the canonical page and versioned JSON together. Retain official source URLs, source language, snapshot hash, review state, confidence, and original evidence snippets when reusing claim-level data.

Machine-readable citation metadata is in `CITATION.cff`.

## License And Source Rights

Tracker metadata is intended for CC BY 4.0 reuse with attribution.

Official source documents, page text, PDFs, screenshots, and other source materials retain their original rights and terms. The tracker records URLs, short evidence snippets, source metadata, and hashes for citation and verification.
