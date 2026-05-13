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

## Current Status

The project is now a public beta of an evidence-backed policy database, not
just a link directory. It includes crawlable university reference pages,
versioned public JSON, source-backed claim records, policy analysis pages,
coverage dashboards, review workflow surfaces, feeds, widgets, and MCP-oriented
metadata for agent integrations.

Current public release:

- Release: `public-release-20260513-001`
- Universities: 74
- Claims: 668
- Evidence records: 681
- Official source attributions: 385
- Entity review states: 73 `agent_reviewed`, 1 `needs_review`
- Claim review states: 651 `agent_reviewed`, 17 `needs_review`
- Source languages represented: English, Chinese, French, Korean, Japanese,
  German, Swedish, Traditional Chinese, and English New Zealand

The public release has no current audit issues from `pnpm audit:public-data`.
The data is source-backed and review-labeled, but it is not legal advice,
academic integrity advice, or an official university statement unless the
linked source is the university's own official page.

## Implemented Capabilities

Public reference site:

- GitHub-style public evidence database interface
- SSR/SSG-friendly university detail pages
- claim/evidence cards with review state, confidence, source URL, source
  language, and original-language evidence
- citation copy actions and citation guidance
- dark mode tokens and initial i18n scaffolding
- homepage, university index, methodology, citation, datasets, changes,
  reports, contribution, review, API reference, widgets, and MCP pages

Policy analysis layer:

- policy analysis contract and validator
- static analysis builder over public claim/evidence records
- analysis index and theme pages
- per-university analysis JSON
- coverage score metadata
- page-quality and review workflow surfaces
- explicit boundary that analysis summaries are not final policy conclusions

Data distribution:

- versioned public API under `/api/public/v1/...`
- JSONL dataset downloads
- dataset release manifest and checksums
- public search index and entity index
- RSS/Atom feeds for changes and reports
- `sitemap.xml`, `robots.txt`, and `llms.txt`
- Dataset JSON-LD and citation metadata

Developer and agent surfaces:

- read-only MCP manifest and tool catalog
- embeddable widget JSON endpoints
- widget embed script
- OpenClaw staged artifact contract
- dataset release validator
- public contract validator
- OpenClaw artifact validator
- local review cache and knowledge-review indexes

Review and coverage operations:

- QS 2026 coverage dashboard
- source health dashboard
- review queue page and JSON
- staging-vs-public release knowledge summaries
- contribution intake surfaces for missing policy URLs, policy changes,
  course policy reports, and institution corrections

## Public Surfaces

Core trust pages:

- Methodology: <https://eduaipolicy.org/methodology>
- Citation: <https://eduaipolicy.org/citation>
- Datasets: <https://eduaipolicy.org/datasets>
- Changes: <https://eduaipolicy.org/changes>
- Search: <https://eduaipolicy.org/search>
- Analysis: <https://eduaipolicy.org/analysis>
- Coverage: <https://eduaipolicy.org/coverage>
- Source health: <https://eduaipolicy.org/source-health>
- Contribute: <https://eduaipolicy.org/contribute>
- Review workflow: <https://eduaipolicy.org/review>
- Widgets: <https://eduaipolicy.org/widgets>
- MCP alpha: <https://eduaipolicy.org/mcp>

Versioned public JSON:

- API index: <https://eduaipolicy.org/api/public/v1/index.json>
- Universities list: <https://eduaipolicy.org/api/public/v1/universities.json>
- Recent changes: <https://eduaipolicy.org/api/public/v1/recent-changes.json>
- Per-university records: `https://eduaipolicy.org/api/public/v1/universities/{slug}.json`
- Per-university claims: `https://eduaipolicy.org/api/public/v1/claims/{slug}.json`
- Search API: <https://eduaipolicy.org/api/public/v1/search.json?q=MIT>
- Search index: <https://eduaipolicy.org/api/public/v1/search/index.json>
- Entity index: <https://eduaipolicy.org/api/public/v1/entities/index.json>
- Analysis index: <https://eduaipolicy.org/api/public/v1/analysis/index.json>
- QS coverage: <https://eduaipolicy.org/api/public/v1/coverage/qs-2026.json>
- Source health: <https://eduaipolicy.org/api/public/v1/source-health.json>
- Review queue: <https://eduaipolicy.org/api/public/v1/review/queue.json>
- Dataset release manifest: <https://eduaipolicy.org/api/public/v1/datasets/latest.json>
- Reports index: <https://eduaipolicy.org/api/public/v1/reports/index.json>
- Reports outreach package: <https://eduaipolicy.org/api/public/v1/reports/outreach.json>
- May 2026 report chart data: <https://eduaipolicy.org/api/public/v1/reports/2026-05/chart-data.json>
- Contribution index: <https://eduaipolicy.org/api/public/v1/contributions/index.json>
- Contribution review policy: <https://eduaipolicy.org/api/public/v1/contributions/review-policy.json>
- MCP manifest: <https://eduaipolicy.org/api/public/v1/mcp/manifest.json>
- MCP tool catalog: <https://eduaipolicy.org/api/public/v1/mcp/tool-catalog.json>
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

Public contribution paths create review tasks through GitHub issue templates.
They do not directly publish canonical facts or write the production database.

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
- `docs/dataset-release-process.md`: dataset release checklist, artifact
  rules, GitHub release notes, and Zenodo archive plan.
- `docs/report-distribution-playbook.md`: report, feed, outreach, and media
  distribution rules.
- `knowledge`: local retrieval summaries for public release, staging runs,
  ranking coverage, reference sheets, and review planning. These files are
  internal planning aids, not canonical evidence.
- `scripts`: validators, audits, smoke tests, conversion tools, and local
  review-cache builders.

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

## Verification

The main local quality gate is:

```bash
pnpm check
```

It runs database client generation, public API contract validation, analysis
contract validation, policy analysis audit, analysis page smoke checks, entity
search smoke checks, OpenClaw artifact validation, dataset release validation,
public data audit, typecheck, and lint.

Recent production verification covered:

- `https://eduaipolicy.org`
- `/coverage`
- `/coverage/qs-2026`
- `/search?q=MIT`
- `/api/public/v1/search.json?q=MIT`
- `/api/public/v1/search.json?q=ANU`
- `/api/public/v1/search/index.json`
- `/api/public/v1/entities/index.json`
- `/api/public/v1/universities.json`
- `/api/public/v1/claims/anu.json`
- widget endpoints for review state, source freshness, and policy coverage
- `/sitemap.xml`, `/llms.txt`, and `/robots.txt`

Browser checks verified that the search and coverage pages render without
horizontal overflow and without current console errors or warnings.

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
