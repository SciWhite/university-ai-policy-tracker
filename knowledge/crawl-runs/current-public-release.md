---
title: Current Public Release
authoritativeLevel: derived_snapshot
generatedAt: 2026-07-26T19:43:21.780Z
sourceFiles:
  - data/public-releases/current.json
  - data/entity-aliases.json
  - data/rankings/ranking-index.json
  - apps/web/lib/staged-public-data.ts
sourceCommands:
  - pnpm knowledge:update
refreshCadence: after each public release promotion
canonicalBoundary: This file is a retrieval summary only and cannot create public claims.
---
# Current Public Release

This snapshot summarizes the current public release manifest and the staged
public merge. It is for retrieval and planning only. The public release
manifest and generated public JSON remain authoritative for what is promoted.

## Release Manifest

- Release ID: `public-release-20260727-015`
- Published at: `2026-07-27T06:10:00.000Z`
- Promoted artifact directories: 810

## Public Dataset Summary

| Metric | Value |
| --- | ---: |
| Public universities | 828 |
| Public claims | 5465 |
| Evidence records | 5730 |
| Official source attributions | 3193 |
| Public recent-change records | 473 |

Duplicate university identities are merged through `data/entity-aliases.json`
before counting.

## Review State Summary

| Scope | State | Count |
| --- | --- | ---: |
| Entity | `agent_reviewed` | 827 |
| Entity | `needs_review` | 1 |
| Claim | `agent_reviewed` | 5461 |
| Claim | `needs_review` | 4 |

Review state is not the same as confidence. This snapshot does not change any
review state.

## Source Language Distribution (top 12)

Original-language evidence remains canonical. 61 language
tags appear across the evidence set.

| Source language | Evidence count |
| --- | ---: |
| `en` | 3572 |
| `de` | 274 |
| `fr` | 174 |
| `es` | 155 |
| `zh-CN` | 138 |
| `en-US` | 131 |
| `ja` | 130 |
| `it` | 117 |
| `ko` | 107 |
| `en-GB` | 96 |
| `zh` | 90 |
| `zh-Hant` | 63 |

## Ranking Coverage In Public Dataset

This table reports ranking metadata coverage for the 828
public universities. It does not imply that all rows in the ranking sources are
covered.

| Ranking source | Public coverage | Source rows | Source status |
| --- | ---: | ---: | --- |
| qs 2026 | 816/828 | 857/1000 | partial |
| the 2026 | 473/828 | 1000/1000 | complete |
| arwu 2025 | 429/828 | 1000/1000 | complete |
| usnews 2025-2026 | 476/828 | 1000/1000 | complete |
| cwts 2025 | 319/828 | 1000/1000 | complete |
