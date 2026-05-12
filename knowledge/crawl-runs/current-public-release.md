---
title: Current Public Release
authoritativeLevel: derived_snapshot
generatedAt: 2026-05-12T10:00:33-04:00
sourceFiles:
  - data/public-releases/current.json
  - data/rankings/qs-world-university-rankings-2026-top-1000.json
  - apps/web/lib/staged-public-data.ts
sourceCommands:
  - pnpm validate:dataset-release
  - pnpm audit:public-data
  - pnpm audit:public-data -- --details
refreshCadence: after each public release promotion
canonicalBoundary: This file is a retrieval summary only and cannot create public claims.
---

# Current Public Release

This snapshot summarizes the current public release manifest and public data
audit. It is for retrieval and planning only. The public release manifest and
generated public JSON remain authoritative for what is promoted.

## Release Manifest

- Release ID: `public-release-20260510-001`
- Published at: `2026-05-10T00:00:00.000Z`
- Promoted artifact directories: 31
- Public release validation: passed
- Public data audit: passed

## Public Dataset Summary

| Metric | Value |
| --- | ---: |
| Public universities | 50 |
| Public claims | 500 |
| Evidence records | 512 |
| Official source attributions | 282 |
| Public recent-change records | 50 |
| Missing QS rank aliases | 0 |
| Missing region/country | 0 |

## Review State Summary

| Scope | State | Count |
| --- | --- | ---: |
| Entity | `agent_reviewed` | 49 |
| Entity | `needs_review` | 1 |
| Claim | `agent_reviewed` | 483 |
| Claim | `needs_review` | 17 |

Review state is not the same as confidence. This snapshot does not change any
review state and does not promote machine-reviewed claims to human-reviewed
claims.

## Source Language Distribution

Original-language evidence remains canonical.

| Source language | Evidence count |
| --- | ---: |
| `en` | 450 |
| `zh` | 23 |
| `ko` | 16 |
| `ja` | 11 |
| `fr` | 7 |
| `de` | 5 |

## Ranking Coverage In Public Dataset

This table reports ranking metadata coverage for the 50 public universities.
It does not imply that all rows in the ranking sources are covered.

| Ranking source | Public coverage | Source rows | Source status |
| --- | ---: | ---: | --- |
| QS 2026 | 50/50 | 857/1000 | partial |
| THE 2026 | 45/50 | 1000/1000 | complete |
| ARWU 2025 | 46/50 | 1000/1000 | complete |
| U.S. News 2025-2026 | 41/50 | 1000/1000 | complete |
| CWTS Leiden 2025 | 35/50 | 1000/1000 | complete |

## Largest Public Records By Claim Count

| Public slug | Claims |
| --- | ---: |
| `anu` | 29 |
| `unsw-sydney` | 29 |
| `cornell-university` | 26 |
| `u-tokyo` | 22 |
| `university-of-california-berkeley` | 22 |
| `university-of-pennsylvania` | 19 |
| `university-of-melbourne` | 18 |
| `columbia` | 16 |

## Promoted Artifact Directories

The following directories are listed in `data/public-releases/current.json`.
They are promoted inputs to the public release. Counts here are retrieval
summaries and do not replace validator output.

| Directory | Detected slugs | Claims | Evidence | Sources | Languages |
| --- | --- | ---: | ---: | ---: | --- |
| `staging/uapt-runs/uapt-cuhk-20260510` | `cuhk` | 12 | 12 | 7 | `en` |
| `staging/uapt-runs/uapt-delft-university-of-technology-20260511` | `delft-university-of-technology` | 1 | 1 | 1 | `en` |
| `staging/uapt-runs/uapt-edinburgh-20260510` | `edinburgh` | 8 | 8 | 6 | `en` |
| `staging/uapt-runs/uapt-epfl-20260510` | `epfl` | 5 | 5 | 6 | `en`, `fr` |
| `staging/uapt-runs/uapt-fudan-university-20260511` | `fudan-university` | 1 | 1 | 3 | `zh` |
| `staging/uapt-runs/uapt-hkust-20260510` | `hkust` | 5 | 5 | 9 | `en` |
| `staging/uapt-runs/uapt-institut-polytechnique-de-paris-20260510` | `institut-polytechnique-de-paris` | 4 | 4 | 5 | `en`, `fr` |
| `staging/uapt-runs/uapt-kcl-20260510` | `kcl` | 12 | 12 | 6 | `en` |
| `staging/uapt-runs/uapt-manchester-20260510` | `manchester` | 12 | 12 | 6 | `en` |
| `staging/uapt-runs/uapt-mcgill-university-20260510` | `mcgill-university` | 5 | 5 | 7 | `en` |
| `staging/uapt-runs/uapt-monash-20260510` | `monash` | 9 | 9 | 10 | `en` |
| `staging/uapt-runs/uapt-northwestern-20260510` | `northwestern-university` | 6 | 6 | 17 | `en` |
| `staging/uapt-runs/uapt-princeton-university-20260510` | `princeton-university` | 8 | 8 | 8 | `en` |
| `staging/uapt-runs/uapt-qs14-20-20260506` | `cornell-university`, `peking-university`, `tsinghua-university`, `university-of-california-berkeley`, `university-of-melbourne`, `university-of-pennsylvania`, `unsw-sydney` | 130 | 130 | 34 | `en`, `zh` |
| `staging/uapt-runs/uapt-qs26-30-20260509` | `anu`, `columbia`, `jhu`, `snu`, `u-tokyo` | 90 | 90 | 60 | `en`, `ja`, `ko` |
| `staging/uapt-runs/uapt-repair-qs-top-policy-seeds-20260506` | `harvard-university`, `imperial-college-london`, `massachusetts-institute-of-technology`, `nanyang-technological-university`, `national-university-of-singapore`, `stanford-university`, `university-of-hong-kong`, `university-of-oxford` | 71 | 76 | 65 | `en` |
| `staging/uapt-runs/uapt-shanghai-jiao-tong-university-20260511` | `shanghai-jiao-tong-university` | 4 | 6 | 3 | `zh` |
| `staging/uapt-runs/uapt-technical-university-of-munich-20260510` | `technical-university-of-munich` | 5 | 5 | 3 | `de`, `en` |
| `staging/uapt-runs/uapt-ubc-20260510` | `ubc` | 10 | 10 | 17 | `en` |
| `staging/uapt-runs/uapt-ucla-20260511` | `ucla` | 4 | 4 | 3 | `en` |
| `staging/uapt-runs/uapt-universite-psl-20260511` | `universite-psl` | 5 | 5 | 4 | `en`, `fr` |
| `staging/uapt-runs/uapt-university-of-amsterdam-20260512` | `university-of-amsterdam` | 4 | 4 | 5 | `en` |
| `staging/uapt-runs/uapt-university-of-michigan-ann-arbor-20260510` | `university-of-michigan-ann-arbor` | 8 | 8 | 8 | `en` |
| `staging/uapt-runs/uapt-university-of-queensland-20260510` | `university-of-queensland` | 5 | 5 | 13 | `en` |
| `staging/uapt-runs/uapt-university-of-sydney-20260510` | `university-of-sydney` | 10 | 10 | 8 | `en` |
| `staging/uapt-runs/uapt-university-of-toronto-20260511` | `university-of-toronto` | 5 | 5 | 7 | `en` |
| `staging/uapt-runs/uapt-yale-university-20260510` | `yale-university` | 12 | 12 | 8 | `en` |
| `staging/uapt-runs/uapt-zhejiang-university-20260511` | `zhejiang-university` | 1 | 2 | 4 | `en` |
| `data/openclaw-staging/run-20260505-cambridge-contract-v2-clean` | `university-of-cambridge` | 12 | 17 | 16 | `en` |
| `data/openclaw-staging/run-20260505-eth-ucl-curated` | `eth-zurich`, `ucl` | 13 | 13 | 7 | `en` |
| `data/openclaw-staging/uapt-repair-20260506-3uni-reviewed` | `california-institute-of-technology`, `national-university-of-singapore`, `university-of-chicago` | 23 | 23 | 7 | `en` |

## Caveats

- This file intentionally excludes raw source text, PDFs, screenshots, and
  browser traces.
- Public facts must be read from versioned public JSON or official source
  artifacts, not from this summary.
- One current public entity is still `needs_review`; do not describe the public
  dataset as fully reviewed.
- Some promoted runs contain machine candidate artifacts in staging history; the
  public data contract and release audit decide what appears in public JSON.
