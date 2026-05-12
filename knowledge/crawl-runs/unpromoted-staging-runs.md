---
title: Unpromoted Staging Runs
authoritativeLevel: derived_snapshot
generatedAt: 2026-05-12T10:19:46-04:00
sourceFiles:
  - data/public-releases/current.json
  - staging/uapt-runs/
  - scripts/validate-openclaw-artifacts.ts
sourceCommands:
  - find staging/uapt-runs -maxdepth 1 -mindepth 1 -type d
  - pnpm validate:openclaw-artifacts <candidate-run>
refreshCadence: after each OpenClaw or OpenCode staged run
canonicalBoundary: This file is a staging review summary only. Unpromoted runs are not public data.
---

# Unpromoted Staging Runs

This file lists staging directories under `staging/uapt-runs/` that are not
listed in `data/public-releases/current.json`. It is a planning snapshot for
review and repair work.

Unpromoted data must not be used by public pages or public JSON until a run is
reviewed, repaired if needed, validated, added to the public release manifest,
and re-audited.

## Summary

| Category | Count |
| --- | ---: |
| Staging directories checked | 39 |
| Manifest-promoted staging directories | 28 |
| Promoted legacy `data/openclaw-staging` directories | 3 |
| Unpromoted staging candidate directories | 10 |
| Archive directory | 1 |
| Unpromoted candidates passing artifact validator | 9 |
| Unpromoted candidates failing artifact validator | 1 |

## Unpromoted Candidate Runs

| Run directory | Detected slug | JSON files | Claims | Evidence | Sources | Languages | Validator status | Likely reason not promoted | Recommended next action |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| `staging/uapt-runs/uapt-carnegie-mellon-university-20260512` | `carnegie-mellon-university` | 42 | 7 | 7 | 6 | `en` | pass | New repaired staging run after current release manifest | Review and consider adding to next manifest if source/citation quality is acceptable |
| `staging/uapt-runs/uapt-johns-hopkins-university-20260510` | `johns-hopkins-university` | 37 | 6 | 6 | 6 | `en` | pass | Separate run exists while public dataset already exposes JHU as `jhu` with entity `needs_review` | Resolve slug/canonical entity mapping and review why public entity remains `needs_review` |
| `staging/uapt-runs/uapt-yonsei-university-20260512` | `yonsei-university` | 21 | 4 | 4 | 1 | `en` | pass | New repaired staging run after current release manifest | Review limited source count and consider next manifest promotion |
| `staging/uapt-runs/uapt-the-london-school-of-economics-and-political-science-20260512` | `the-london-school-of-economics-and-political-science` | 53 | 8 | 8 | 10 | `en` | pass | New staging run after initial snapshot | Review source breadth and decide whether to promote |
| `staging/uapt-runs/uapt-kyoto-university-20260512` | `kyoto-university` | 39 | 7 | 7 | 6 | `ja` | pass | New staging run after initial snapshot | Review Japanese original-language evidence and decide whether to promote |
| `staging/uapt-runs/uapt-ludwig-maximilians-universitat-munchen-20260512` | `ludwig-maximilians-universitat-munchen` | 40 | 6 | 6 | 8 | `de`, `en` | pass | New staging run after initial snapshot | Review German/English source handling and decide whether to promote |
| `staging/uapt-runs/uapt-universiti-malaya-20260512` | `universiti-malaya` | 1 bundled JSON | 6 | 6 | 6 | `en` | pass | New staging run after initial snapshot | Review bundled artifact structure and decide whether to promote |
| `staging/uapt-runs/uapt-the-hong-kong-polytechnic-university-20260512` | `the-hong-kong-polytechnic-university` | 35 | 5 | 6 | 6 | `en` | pass | New staging run, currently untracked/unpromoted in local workspace | Stage/review intentionally, then decide whether to promote |
| `staging/uapt-runs/uapt-university-of-bristol-20260512` | `university-of-bristol` | 27 | 4 | 4 | 4 | `en` | pass | New staging run, currently untracked/unpromoted in local workspace | Stage/review intentionally, then decide whether to promote |
| `staging/uapt-runs/uapt-new-york-university-20260512` | `new-york-university` | 31 | 5 | 5 | 5 | `en` | fail | Missing `crawl_plan` and `report_draft`; invalid claim types; invalid snapshot/content hashes | Repair schema, content hashes, artifact names, and required artifact families before any promotion review |

## Validator Notes

The following commands were run for the current snapshot:

```bash
pnpm validate:openclaw-artifacts staging/uapt-runs/uapt-carnegie-mellon-university-20260512
pnpm validate:openclaw-artifacts staging/uapt-runs/uapt-yonsei-university-20260512
pnpm validate:openclaw-artifacts staging/uapt-runs/uapt-johns-hopkins-university-20260510
pnpm validate:openclaw-artifacts staging/uapt-runs/uapt-the-hong-kong-polytechnic-university-20260512
pnpm validate:openclaw-artifacts staging/uapt-runs/uapt-university-of-bristol-20260512
pnpm validate:openclaw-artifacts staging/uapt-runs/uapt-new-york-university-20260512
pnpm validate:openclaw-artifacts staging/uapt-runs/uapt-the-london-school-of-economics-and-political-science-20260512
pnpm validate:openclaw-artifacts staging/uapt-runs/uapt-kyoto-university-20260512
pnpm validate:openclaw-artifacts staging/uapt-runs/uapt-ludwig-maximilians-universitat-munchen-20260512
pnpm validate:openclaw-artifacts staging/uapt-runs/uapt-universiti-malaya-20260512
```

Passing candidate outputs:

- CMU: 42 artifacts; required families present; 7 claims; 7 evidence
  candidates; 7 review decisions.
- Yonsei: 21 artifacts; required families present; 4 claims; 4 evidence
  candidates; 4 review decisions; only 1 source candidate/snapshot.
- JHU: 37 artifacts; required families present; 6 claims; 6 evidence
  candidates; 6 review decisions.
- PolyU: 35 artifacts; required families present; 5 claims; 6 evidence
  candidates; 5 review decisions.
- Bristol: 27 artifacts; required families present; 4 claims; 4 evidence
  candidates; 4 review decisions.
- LSE: 53 artifacts; required families present; 8 claims; 8 evidence
  candidates; 8 review decisions.
- Kyoto: 39 artifacts; required families present; 7 claims; 7 evidence
  candidates; 7 review decisions; evidence language is `ja`.
- LMU Munich: 40 artifacts; required families present; 6 claims; 6 evidence
  candidates; 6 review decisions; languages are `de` and `en`.
- Universiti Malaya: 36 artifacts in one bundle JSON; required families
  present; 6 claims; 6 evidence candidates; 6 review decisions.

NYU validator failures are schema-level blockers:

- missing required artifact families: `crawl_plan`, `report_draft`, plus
  validator-recognized required families after parse failures;
- invalid `claimType` values outside the shared taxonomy;
- invalid `snapshotHash` and `contentHash` values that do not match 64-character
  lowercase SHA-256 format.

## Archive Directory

`staging/uapt-runs/_archives` is not a candidate release directory and contains
no JSON files in this snapshot.

## Do Not Use As Canonical

Unpromoted runs are staging data. They can guide review and repair, but they
must not appear in public JSON, ranking pages, university pages, analysis pages,
or citation examples until promoted through the manifest workflow.
