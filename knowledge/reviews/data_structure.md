# Review Knowledge Index

## Purpose

This directory stores internal review reports that combine public release
status, staging status, ranking coverage, validator results, and
non-authoritative benchmark comparisons.

## Authority Boundary

Authority level: planning_note.

Review reports are planning artifacts. They can recommend validation, repair,
promotion review, or crawl targets. They cannot publish claims or override
review workflow.

## Current Files

None in Git. `pnpm knowledge:update` writes a dated
`<date>-public-vs-staging-vs-qs.md` note here when needed; the 2026-05-12 and
2026-07-26 notes were removed on 2026-11-22 (see `docs/HISTORY.md`).

## Refresh Inputs

- `knowledge/crawl-runs/current-public-release.md`
- `knowledge/crawl-runs/unpromoted-staging-runs.md`
- `knowledge/rankings/qs-2026-coverage.md`
- `knowledge/reference-sheets/plsc-edtechai-policy-v4-summary.md`
- validator output from current staging candidates

## Do Not Use For

- Publishing public data.
- Treating staging-only artifacts as current public release data.
- Treating reference sheets as official evidence.
