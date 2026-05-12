# Ranking Knowledge Index

## Purpose

This directory tracks collection coverage against ranking targets. Ranking
files are targeting and coverage tools only; they are not policy evidence.

## Authority Boundary

Authority level: derived_snapshot.

Ranking rows can identify high-value crawl targets and coverage gaps. They
cannot prove policy content, source availability, or institutional positions on
AI use.

## Current Ranking Boundary

- QS World University Rankings 2026 is tracked separately from all other
  ranking systems.
- Do not merge QS 2026 rows with THE 2026, ARWU 2025, U.S. News 2025-2026, or
  CWTS Leiden 2025 rows.
- If a page or report combines ranking systems later, each row must preserve
  `rankingSystem`, `rankingYear`, `rankSemantics`, and source file.

## Files

- `qs-2026-coverage.md` - current public/staging/missing coverage for the QS
  2026 top 100 source file.

## Refresh Inputs

- `data/rankings/qs-world-university-rankings-2026-top-100.json`
- `data/rankings/qs-world-university-rankings-2026-top-1000.json`
- `data/public-releases/current.json`
- `staging/uapt-runs/*`
- `apps/web/lib/university-index-records.ts`

## Do Not Use For

- Public policy claims.
- Evidence snippets.
- Review-state changes.
- Source rights or citation decisions.
