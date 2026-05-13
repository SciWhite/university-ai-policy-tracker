# Knowledge And Review Infrastructure Plan

This document defines the local knowledge, review, and analysis-support
infrastructure for University AI Policy Tracker. It turns crawl outputs, public
release manifests, ranking targets, and non-authoritative reference sheets into
low-token retrieval assets and review workflows.

The goal is to help Codex, OpenClaw, and future agents answer operational
questions quickly without treating local summaries as policy evidence.

## 1. Positioning

This layer is not a new evidence source.

It should answer:

```text
What does the current public release include?
Which staging runs have not been promoted?
Which QS 2026 targets are public, staging-only, missing, or ambiguous?
Which runs are likely to fail validation?
Which data needs human review?
How does a non-authoritative spreadsheet differ from current public/staging data?
```

It must not answer as canonical truth:

```text
What is this university's policy?
Can this claim be published?
Can an Excel row become official evidence?
Can a local summary replace source-language evidence?
```

Canonical policy facts still require:

```text
official source URL
source language
source snapshot/hash
short original-language evidence
claim/evidence schema validation
review decision
public release promotion
```

## 2. Architecture

Use four layers.

```text
Canonical Layer
  -> Knowledge Snapshot Layer
  -> Local Analysis Cache Layer
  -> Product Surfaces
```

### 2.1 Canonical Layer

Authoritative project sources:

- `docs/data-contract.md`
- `docs/crawler-policy.md`
- `docs/openclaw-data-prs.md`
- `packages/shared/src/openclaw-artifacts.ts`
- `packages/shared/src/claims.ts`
- `packages/shared/src/analysis.ts`
- public release manifest and dataset artifacts
- validated OpenClaw staged artifacts
- official source snapshots and review decisions

The canonical layer is the only layer that can support public claims.

### 2.2 Knowledge Snapshot Layer

Local Markdown files under `knowledge/`.

Purpose:

- low-token repo orientation
- post-run QA
- staging/public/ranking coverage summaries
- agent handoff
- review planning

Knowledge files are retrieval summaries only. They are not canonical evidence.

### 2.3 Local Analysis Cache Layer

A local DuckDB or SQLite database generated from the canonical layer and
knowledge snapshots.

Suggested path:

```text
.local/uapt-review.duckdb
```

Purpose:

- fast joins across public release data, staging runs, rankings, and reference
  sheets
- repeatable local audits
- dashboard query sources
- review reports

This database must remain local/read-only relative to production. It does not
replace PostgreSQL or public JSON.

### 2.4 Product Surfaces

Mature queries can become public read-only surfaces:

- coverage gap dashboard
- source health dashboard
- review queue pages
- embeddable widgets
- read-only MCP tools
- entity search

These surfaces must preserve the same evidence, review, citation, and no-advice
boundaries as the rest of the site.

## 3. Authority Levels

Every generated knowledge file should declare one authority level.

```text
canonical_contract
derived_snapshot
non_authoritative_benchmark
planning_note
```

Definitions:

- `canonical_contract`: documents or schemas that define the controlling data
  contract.
- `derived_snapshot`: generated summary of canonical or staged data.
- `non_authoritative_benchmark`: external or manual reference used only for
  recall comparison and planning.
- `planning_note`: internal review memo or next-action list.

Knowledge files must never silently upgrade a source. If a file is generated
from staging data, it remains staging-derived until the run is promoted through
the public release workflow.

## 4. Standard File Header

All generated knowledge files should start with a compact metadata block:

```markdown
---
title: Current Public Release
authoritativeLevel: derived_snapshot
generatedAt: 2026-05-12T00:00:00-04:00
sourceFiles:
  - data/public-releases/current.json
  - data/releases/public-release-20260510-001/manifest.json
sourceCommands:
  - pnpm validate:dataset-release
  - pnpm audit:public-data
refreshCadence: after each public release promotion
canonicalBoundary: This file is a retrieval summary only and cannot create public claims.
---
```

Required fields:

- `title`
- `authoritativeLevel`
- `generatedAt`
- `sourceFiles`
- `sourceCommands`
- `refreshCadence`
- `canonicalBoundary`

For reference sheets, also include:

- `originalFilePath`
- `sourceFileName`
- `sheetNames`
- `selectedSheet`
- `rowCount`
- `columnCount`
- `sha256`
- `limitations`

## 5. P0: Knowledge Boundary And Markdown Snapshots

P0 combines the immediate `kb-retriever` setup with the first retrieval
snapshots.

### 5.1 P0A: Boundary Docs

Files:

```text
docs/agent-skills-usage.md
knowledge/data_structure.md
```

`docs/agent-skills-usage.md` must define:

- `kb-retriever` = local retrieval, post-run QA, coverage analysis
- `web-design-engineer` = reference UI and visual information architecture
- OpenClaw = crawling and staged artifacts
- validator = hard gate
- official source artifacts = evidence source

Required boundaries:

- reference sheets are non-authoritative
- knowledge files are not canonical evidence
- knowledge files cannot create public claims
- public claims require `sourceUrl`, `sourceLanguage`, `snapshotHash`,
  original-language evidence, confidence, and review state

`knowledge/data_structure.md` is the default entrypoint for `kb-retriever`.
Agents should start there before broad repo search.

Acceptance criteria:

- both files exist
- both files state the non-authoritative boundary
- both files point to controlling contract files
- `git diff --check` passes

### 5.2 P0B: Core Knowledge Snapshots

Directories:

```text
knowledge/crawl-runs/
knowledge/rankings/
```

Files:

```text
knowledge/crawl-runs/data_structure.md
knowledge/rankings/data_structure.md
knowledge/crawl-runs/current-public-release.md
knowledge/crawl-runs/unpromoted-staging-runs.md
knowledge/rankings/qs-2026-coverage.md
```

#### current-public-release.md

Purpose: let agents quickly understand what is publicly promoted.

Sources:

```text
data/public-releases/current.json
data/releases/*
apps/web/lib/staged-public-data.ts
pnpm validate:dataset-release
pnpm audit:public-data
```

Suggested sections:

- generated metadata
- included release artifacts
- included staged artifact directories, if applicable
- university count
- claim count
- evidence count
- source attribution count
- language distribution
- review state distribution
- high-claim records
- ranking coverage snapshot, if easy
- caveats

Boundary text:

```text
This file is a retrieval summary only. The public release manifest remains
authoritative for what is promoted. Official source evidence remains in public
JSON, staged artifacts, and source snapshots.
```

#### unpromoted-staging-runs.md

Purpose: show which staging runs are not public and why they should not be used
as canonical data.

Sources:

```text
staging/uapt-runs/*
data/public-releases/current.json
pnpm validate:openclaw-artifacts
```

Suggested table columns:

- run directory
- JSON artifact count
- detected universities
- claim count
- evidence count
- source count
- review states
- validator status
- likely reason not promoted
- recommended next action

Possible reasons:

- new run awaiting review
- validator failing
- missing report draft
- missing review decision
- partial run
- duplicate or superseded
- archived
- unknown, needs inspection

Boundary text:

```text
Unpromoted staging runs cannot enter public pages unless they are added to the
public release manifest and pass repository validators.
```

#### qs-2026-coverage.md

Purpose: let agents inspect QS 2026 coverage without mixing ranking years or
providers.

Sources:

```text
data/rankings/*qs*2026*
docs/reference/qs-2026-top-100.md
data/public-releases/current.json
staging/uapt-runs/*
apps/web/lib/reference-pages.ts
```

Status values:

```text
public
staging_unpromoted
missing
ambiguous_slug
no_policy_found
inaccessible
needs_review
```

Suggested table columns:

- QS rank
- university name
- country/region
- canonical slug
- public release status
- staging status
- claim count
- source count
- last checked
- notes

Required caveat:

```text
QS 2026 coverage must not be merged with THE 2026, ARWU 2025, U.S. News
2025-2026, or CWTS Leiden 2025 ranking semantics.
```

Acceptance criteria:

- all three Markdown snapshots exist
- each file has metadata header
- each file lists source files and generation commands
- each file includes a non-authoritative or derived-snapshot note
- no raw source page text, raw PDF content, screenshots, or long evidence dumps
- no Excel row is treated as evidence

### 5.3 P0C: Reference Sheet Conversion

Directory:

```text
knowledge/reference-sheets/
```

Files:

```text
knowledge/reference-sheets/data_structure.md
knowledge/reference-sheets/plsc-edtechai-policy-v4-summary.md
knowledge/reference-sheets/plsc-edtechai-policy-v4-columns.md
```

Optional later:

```text
knowledge/reference-sheets/plsc-edtechai-policy-v4-normalized.csv
```

Required label:

```text
Status: non-authoritative benchmark only
```

Required explanation:

```text
This file is for recall comparison and review planning only. It must not be
used as official source evidence, public source attribution, or canonical claim
support.
```

Allowed uses:

- detect possible missing schools
- detect source discovery gaps
- compare manual categories with agent categories
- guide crawl-designer prompts

Forbidden uses:

- create a claim directly
- add a source URL directly to public JSON
- list a spreadsheet row as an official source
- cite the spreadsheet on public policy pages

Acceptance criteria:

- original file path is recorded
- sheet names are recorded
- selected sheet is recorded
- row and column counts are recorded
- checksum is recorded
- conversion date is recorded
- non-authoritative benchmark boundary is visible
- nothing is added to public release manifests

### 5.4 P0D: First Review Report

Directory:

```text
knowledge/reviews/
```

File:

```text
knowledge/reviews/2026-05-12-public-vs-staging-vs-qs.md
```

Purpose: turn current data state into action priorities.

Suggested sections:

- executive summary
- current public release
- staging not promoted
- QS 2026 coverage
- reference sheet comparison, after P0C
- data quality risks
- recommended next actions

The report should answer:

- what should be fixed next
- what should be crawled next
- what can be promoted after validation
- what needs manual review
- what should remain non-public

Acceptance criteria:

- every recommendation points to a file, run, or exact data source
- staging-only data is not described as public
- Excel/reference sheet data is not described as truth
- no official source long text is copied into the report

## 6. P1: DuckDB Or SQLite Local Review Cache

After the Markdown format is stable, generate a local analysis database.

Suggested path:

```text
.local/uapt-review.duckdb
```

Alternative:

```text
.local/uapt-review.sqlite
```

DuckDB is preferred for local analytical joins over JSONL/CSV/Parquet. SQLite
is acceptable if the team wants maximum portability.

### 6.1 Tables

Suggested tables:

```text
public_universities
public_claims
public_sources
public_evidence
public_changes
analysis_profiles
staging_runs
staging_artifact_counts
staging_validation_results
ranking_qs_2026
reference_sheet_rows
entity_aliases
coverage_gaps
source_health_checks
```

### 6.2 Queries

Must support:

```sql
-- QS Top 100 missing from public release
select *
from ranking_qs_2026
where public_status = 'missing'
order by qs_rank;

-- staging runs with claims but missing review decisions
select *
from staging_runs
where claim_count > 0 and review_decision_count = 0;

-- public records with low source coverage
select *
from public_universities
where official_source_count < 2
order by qs_rank nulls last;

-- non-English evidence distribution
select source_language, count(*)
from public_evidence
group by source_language;
```

### 6.3 Script

Future script:

```text
scripts/build-review-cache.ts
```

Future command:

```bash
pnpm build:review-cache
```

Implemented command:

```bash
pnpm build:review-cache
```

Implemented cache path:

```text
.local/uapt-review.sqlite
```

The current implementation uses the local `sqlite3` CLI instead of adding a
native Node dependency. It rebuilds the cache from scratch and keeps the
database under `.local/`, which is excluded from Git.

Acceptance criteria:

- cache is generated locally and excluded from Git
- cache generation is deterministic from checked-in data and staging files
- cache cannot write production DB
- generated row counts match Markdown snapshots
- query examples are documented

Implemented tables:

```text
cache_metadata
public_universities
public_claims
public_evidence
public_sources
public_changes
analysis_profiles
staging_runs
staging_artifact_counts
staging_validation_results
ranking_qs_2026
reference_sheet_rows
entity_aliases
coverage_gaps
source_health_checks
```

Important boundary:

```text
The review cache is a local analysis artifact. It is not a production database,
not a public API source, and not canonical evidence. It stores public metadata,
counts, hashes, and planning fields; it does not promote staging runs or create
claims.
```

Useful local checks:

```bash
sqlite3 .local/uapt-review.sqlite \
  "select public_status, count(*) from ranking_qs_2026 group by public_status;"

sqlite3 .local/uapt-review.sqlite \
  "select directory, validation_status, issue_count from staging_runs where promoted = 0 order by validation_status, directory;"

sqlite3 .local/uapt-review.sqlite \
  "select entity_slug, official_source_count from public_universities where official_source_count < 2 order by entity_slug;"

sqlite3 .local/uapt-review.sqlite \
  "select source_language, count(*) from public_evidence group by source_language order by count(*) desc;"
```

## 7. P2: Coverage Gap And Source Health Dashboards

Productize mature review queries into read-only public or internal reference
pages.

Candidate routes:

```text
/coverage
/coverage/qs-2026
/source-health
/review/queue
```

Implemented public routes:

```text
/coverage
/coverage/qs-2026
/source-health
/review/queue
```

Implemented read-only JSON endpoints:

```text
/api/public/v1/coverage/qs-2026.json
/api/public/v1/source-health.json
/api/public/v1/review/queue.json
```

### 7.1 Coverage Gap Dashboard

Purpose: show collection coverage, not policy quality.

Good copy:

```text
QS 2026 tracking coverage
Public source-backed records
Staging-only records awaiting validation/review
Missing or inaccessible targets
```

Bad copy:

```text
Best university AI policies
Top AI policy schools
Policy quality ranking
```

Required fields:

- ranking source and year
- public/staging/missing status
- claim count
- source count
- review state
- last checked
- recommended next action

### 7.2 Source Health Dashboard

Purpose: show source URL freshness and fetch status.

Possible statuses:

```text
ok
redirected
changed_hash
not_found
forbidden
robots_blocked
login_wall
paywall
captcha_or_waf
unknown_error
```

Rules:

- never bypass robots, login walls, paywalls, CAPTCHA, or access controls
- do not publish raw source text
- use source health to plan recrawls and repairs

### 7.3 Review Queue Page

Purpose: public or internal transparency about what needs review.

Possible sections:

- source discovery review
- crawl failure review
- claim/evidence review
- analysis profile review
- translation review
- institution correction review
- course submission review

Acceptance criteria:

- pages are server-rendered or static
- pages use versioned public/read-only data where public
- pages do not imply staging data is public
- pages preserve no-advice boundary
- pages link back to methodology, citation, and review workflow

## 8. P3: Read-Only MCP And Embeddable Widgets

Use mature public APIs and knowledge-derived metadata to support agents and
external websites.

Implemented P3 endpoints and surfaces:

```text
/mcp
/widgets
/widgets/embed.js
/api/public/v1/mcp/manifest.json
/api/public/v1/mcp/tool-catalog.json
/api/public/v1/citation.json
/api/public/v1/claims/{slug}.json
/api/public/v1/widgets/index.json
/api/public/v1/widgets/university-status/{slug}.json
/api/public/v1/widgets/recent-changes.json
/api/public/v1/widgets/policy-coverage/{slug}.json
/api/public/v1/widgets/source-freshness/{slug}.json
/api/public/v1/widgets/review-state/{slug}.json
```

### 8.1 Read-Only MCP

Candidate MCP tools:

```text
search_universities
get_university_policy_record
get_policy_claims
get_analysis_profile
get_qs_coverage_gap
get_recent_changes
get_source_health
get_citation
```

Hard prohibitions:

```text
create_claim
publish_record
promote_staging
write_db
operate_openclaw
deploy
push_main
```

MCP outputs must include:

- canonical URL
- public JSON URL
- review state
- confidence, where relevant
- source URL
- source language
- source rights caveat
- no-advice caveat

### 8.2 Embeddable Widgets

Candidate widgets:

- university status badge
- policy coverage badge
- recent changes widget
- source freshness badge
- review-state badge

Widget text must avoid:

- policy quality ranking
- official endorsement
- legal advice
- academic integrity advice

Acceptance criteria:

- widgets are read-only
- widgets cite canonical page and public JSON
- widgets show review state or source-backed wording
- widgets do not expose staging-only data as public

## 9. P4: Entity Resolution And Search

As coverage grows, entity resolution becomes the maintenance layer.

### 9.1 Entity Resolution

Problems to solve:

- QS name vs official university name
- English name vs local-language name
- abbreviation aliases
- domain aliases
- campus/system ambiguity
- merged or renamed institutions
- ranking-provider-specific names

Future objects:

```text
canonical_entities
entity_aliases
ranking_entity_matches
source_domain_matches
reference_sheet_matches
```

Match records should include:

- source system
- source label
- canonical slug
- match confidence
- review state
- match reason
- last reviewed

Reference sheet matches remain non-authoritative unless independently confirmed
through official source evidence.

### 9.2 Search

Start with Pagefind for static site search.

Searchable content:

- universities
- official source titles
- claim summaries
- analysis dimensions
- changes
- reports
- methodology/citation docs

Later candidates:

- Typesense
- Meilisearch
- Postgres full-text search

Do not index:

- raw source snapshots
- raw PDFs
- private files
- unpromoted staging evidence as public facts
- non-authoritative spreadsheet rows as policy evidence

Acceptance criteria:

- search result snippets preserve review state and source-backed wording
- search does not surface raw unpublished artifacts as public claims
- entity aliases improve recall without creating new facts

## 10. Automation Roadmap

Start manual, then script after file formats stabilize.

### 10.1 Manual First Pass

Codex can generate the first snapshot set by:

```text
reading public release manifests
scanning staging/uapt-runs
running validators
reading QS reference files
converting Excel reference sheets with checksum
writing Markdown summaries
```

### 10.2 Scripted Knowledge Index

Future script:

```text
scripts/build-knowledge-index.ts
```

Future command:

```bash
pnpm build:knowledge-index
```

Generated outputs:

```text
knowledge/crawl-runs/current-public-release.md
knowledge/crawl-runs/unpromoted-staging-runs.md
knowledge/rankings/qs-2026-coverage.md
knowledge/reviews/YYYY-MM-DD-public-vs-staging-vs-qs.md
```

### 10.3 Scripted Reference Sheet Conversion

Future script:

```text
scripts/convert-reference-sheets.ts
```

Requirements:

- read Excel with pandas or a Node Excel parser
- record workbook checksum
- list sheets and columns
- write Markdown summaries
- optionally write normalized CSV
- label output `non_authoritative_benchmark`

### 10.4 Scripted Review Cache

Future script:

```text
scripts/build-review-cache.ts
```

Requirements:

- load public release artifacts
- load staging run metadata
- load ranking references
- load reference sheet summaries or normalized rows
- produce local DuckDB/SQLite file
- write row-count summary

## 11. Recommended Execution Order

```text
P0A: commit skill boundary docs and root knowledge index
P0B: generate crawl-run and QS markdown snapshots
P0C: convert Excel reference sheet summaries
P0D: generate first public vs staging vs QS review report
P1: build local DuckDB/SQLite review cache
P2: expose coverage gap and source health dashboards
P3: extend read-only MCP and embeddable widgets
P4: add entity resolution and search
```

## 12. Success Metrics

Operational metrics:

- time to answer current public coverage questions
- time to identify unpromoted staging runs
- number of validator failures caught before PR
- number of QS missing targets identified per cycle
- number of stale knowledge snapshots detected

Data quality metrics:

- public release row counts match generated summaries
- staging run status matches validator output
- reference sheet rows never appear as public evidence
- non-English source language fields remain visible
- review state remains distinct from confidence

Distribution metrics:

- coverage dashboard impressions
- source health page usage
- MCP read-only requests
- widget usage
- citation/API links from external users

## 13. Non-Goals

This plan does not implement:

- a login SaaS backend
- production DB writes
- OpenClaw deployment changes
- automatic promotion from staging to public
- legal advice or academic integrity advice
- canonical claims from spreadsheets
- raw source text publication

## 14. Immediate Next Prompt

Use this prompt for the next implementation thread:

```text
Work in /Users/newvolume/Documents/university-ai-policy-tracker.

Task: implement P0A-P0B of docs/knowledge-review-infrastructure-plan.md.

Do not connect OpenClaw, SSH, deploy, touch production DB, or modify unrelated
staging artifacts. Do not treat knowledge files as canonical evidence.

Start by checking:
- git status --short --branch
- docs/knowledge-review-infrastructure-plan.md
- docs/agent-skills-usage.md
- knowledge/data_structure.md
- data/public-releases/current.json, if present
- data/releases or equivalent public release artifacts
- staging/uapt-runs/ directory names only at first
- docs/reference/qs-2026-top-100.md

Implement:
- ensure knowledge/crawl-runs/data_structure.md exists
- ensure knowledge/rankings/data_structure.md exists
- generate knowledge/crawl-runs/current-public-release.md
- generate knowledge/crawl-runs/unpromoted-staging-runs.md
- generate knowledge/rankings/qs-2026-coverage.md

Each generated file must include metadata header, source files, source commands,
authority level, and explicit non-canonical boundary.

Run relevant validators if available:
- pnpm validate:dataset-release
- pnpm audit:public-data
- pnpm validate:openclaw-artifacts only where scoped and safe
- git diff --check

Do not commit unless asked.
```
