# University AI Policy Tracker Knowledge Index

## Purpose

This directory is a local retrieval index for Codex and other agents. It helps agents find project knowledge without loading large docs, spreadsheets, PDFs, crawl outputs, or run summaries into context.

The knowledge directory is not a source of canonical policy truth. Public claims must still be backed by official source URLs, source snapshots, original-language evidence snippets, confidence, and review state.

## Retrieval Rules

- Start here before searching the whole repository.
- Prefer the most specific indexed subdirectory before broad search.
- Use `rg` or bounded window reads instead of loading entire large files.
- Treat local reference material as non-authoritative unless it points to an official source URL that has been fetched and validated through the normal artifact chain.
- Never replace original source evidence with a local summary or translation.

## Current Repository Sources

These project files define the current data and review contract:

- `docs/data-contract.md` - public claim/evidence/citation contract.
- `docs/crawler-policy.md` - crawler behavior, access boundaries, and artifact expectations.
- `docs/exposure-distribution-architecture.md` - distribution, SEO/GEO, dataset, API, and contribution roadmap.
- `docs/openclaw-data-prs.md` - staged artifact PR workflow.
- `packages/shared/src/openclaw-artifacts.ts` - validator schema for OpenClaw staged artifacts.
- `packages/shared/src/claims.ts` - public API and claim/evidence schemas.
- `packages/shared/src/taxonomy.ts` - product taxonomy values.

## Knowledge Areas

Each subdirectory should include its own `data_structure.md`. Files in this
tree are retrieval summaries only unless a file explicitly points back to a
controlling contract document.

### `rankings/`

Purpose: ranking lists and collection targets.

Current files:

- `data_structure.md` - ranking-source boundaries and retrieval rules.
- `qs-2026-coverage.md` - current public/staging/missing coverage for QS
  World University Rankings 2026 targets.

Future files:

- `the-2026.md` - Times Higher Education target list when used.
- `arwu-2025.md` - ARWU target list when used.
- `usnews-2025-2026.md` - US News target list when used.

Use for:

- identifying which ranking targets are missing;
- grouping crawl batches;
- comparing site coverage against target lists.

Do not use for:

- policy claims or evidence.

### `reference-sheets/`

Purpose: human-created spreadsheets and benchmark references converted into retrieval-friendly Markdown or text.

Current files:

- `data_structure.md`
- `plsc-edtechai-policy-v4-summary.md`
- `plsc-edtechai-policy-v4-columns.md`

Use for:

- post-run recall analysis;
- possible missing-source hints;
- quality-control questions.

Do not use for:

- official evidence;
- canonical claims;
- direct source copying.

### `crawl-runs/`

Purpose: concise summaries of OpenClaw crawl runs and validation outcomes.

Current files:

- `data_structure.md`
- `current-public-release.md`
- `unpromoted-staging-runs.md`

Future files:

- `run-history.md`
- `failed-runs.md`
- `repair-candidates.md`

Use for:

- tracking which universities were crawled;
- identifying repair batches;
- reviewing validator failures and recurring artifact issues.

Do not use for:

- replacing artifact validation;
- publishing unreviewed crawl conclusions.

### `methodology/`

Purpose: retrieval copies or summaries of methodology, citation, and data-contract decisions.

Expected files:

- `claim-evidence-model.md`
- `multilingual-evidence.md`
- `citation-policy.md`
- `review-state-policy.md`

Use for:

- keeping future agent answers consistent with the project contract;
- explaining data quality and review boundaries.

### `competitors/`

Purpose: notes on comparable sites, datasets, and public positioning.

Expected files:

- `trinka.md`
- `scribbr.md`
- `gradpilot.md`
- `academic-datasets.md`

Use for:

- SEO/GEO positioning;
- feature comparison;
- outreach and citation strategy.

Do not use for:

- university policy evidence unless the competitor links to an official source and that source is independently fetched.

### `review-briefs/`

Purpose: human-readable briefs produced after validated runs.

Expected files:

- `YYYY-MM-DD-run-id.md`
- `source-gap-analysis.md`
- `multilingual-coverage.md`

Use for:

- deciding what to merge;
- prioritizing manual review;
- planning the next crawl batch.

### `reviews/`

Purpose: cross-source review reports generated from public release manifests,
staging runs, ranking coverage, and non-authoritative reference sheets.

Current files:

- `data_structure.md`
- `2026-05-12-public-vs-staging-vs-qs.md`

Use for:

- deciding the next crawl batch;
- deciding which validated staging runs are ready for review/promotion;
- identifying validator failures and review-state gaps.

Do not use for:

- publishing claims;
- replacing artifact validation;
- replacing human or institution review.

## Current Status

This index is the starting point. It intentionally does not include raw crawl content, normalized text snapshots, PDFs, screenshots, or browser traces. Those artifacts should stay in staging, ignored directories, object storage, or OpenClaw-controlled storage according to the crawler policy.

## Local Review Cache

The local review cache is generated by:

```bash
pnpm build:review-cache
```

Output:

```text
.local/uapt-review.sqlite
```

The cache is excluded from Git. It is a low-token local analysis database for
joins across public release data, staging runs, QS coverage, analysis profiles,
and non-authoritative reference-sheet summaries. It is not a production
database and cannot publish claims.
