---
title: Public vs Staging vs QS Review - 2026-05-12
authoritativeLevel: planning_note
generatedAt: 2026-05-12T10:19:46-04:00
sourceFiles:
  - data/public-releases/current.json
  - staging/uapt-runs/
  - data/rankings/qs-world-university-rankings-2026-top-100.json
  - knowledge/crawl-runs/current-public-release.md
  - knowledge/crawl-runs/unpromoted-staging-runs.md
  - knowledge/rankings/qs-2026-coverage.md
  - knowledge/reference-sheets/plsc-edtechai-policy-v4-summary.md
sourceCommands:
  - pnpm validate:dataset-release
  - pnpm audit:public-data
  - pnpm audit:public-data -- --details
  - pnpm validate:openclaw-artifacts <candidate-run>
refreshCadence: after each staged run batch or public release promotion
canonicalBoundary: This is an internal planning note. It cannot publish claims or replace review workflow.
---

# Public vs Staging vs QS Review - 2026-05-12

Status: internal retrieval and planning note.

This report combines the current public release, unpromoted staging runs, QS
2026 top 100 coverage, and a non-authoritative Excel benchmark. It is meant to
answer "what should we fix or crawl next?" not "what is the policy?"

## Executive Summary

- Current public release is valid and audits cleanly.
- Public dataset contains 50 universities, 500 claims, 512 evidence records,
  and 282 official source attributions.
- Public entity review states are 49 `agent_reviewed` and 1 `needs_review`.
- Claim review states are 483 `agent_reviewed` and 17 `needs_review`.
- QS top 100 target coverage is 50 public, 9 staging-only, and 41 missing.
- Nine unpromoted staging candidates pass artifact validation.
- One unpromoted staging candidate, NYU, fails validator and must be repaired
  before review.
- The Excel workbook is useful for recall and theme comparison, but it is
  non-authoritative and should not flow into public claims.

## Current Public Release

| Item | Current state |
| --- | --- |
| Release ID | `public-release-20260510-001` |
| Release published at | `2026-05-10T00:00:00.000Z` |
| Public universities | 50 |
| Public claims | 500 |
| Evidence records | 512 |
| Official source attributions | 282 |
| Public data audit | passed |
| Dataset release validator | passed |

### Public Review-State Risk

| Risk | Evidence | Recommended action |
| --- | --- | --- |
| One public entity remains `needs_review` | `jhu` appears as public with `needs_review` | Review JHU entity state and decide whether to repair, promote a canonical slug, or keep warning visible |
| 17 public claims remain `needs_review` | `pnpm audit:public-data` claim review state distribution | Keep candidate warnings visible and avoid describing all data as fully reviewed |
| Non-English evidence exists | `zh`, `ko`, `ja`, `fr`, `de` evidence records | Preserve original-language evidence as canonical; translations remain helper display only |

## Staging Not Promoted

| Run | Validator | Public relationship | Next action |
| --- | --- | --- | --- |
| `uapt-carnegie-mellon-university-20260512` | pass | QS rank 52, not public | Review source breadth and promote if accepted |
| `uapt-yonsei-university-20260512` | pass | QS rank 50, not public | Review limited-source run before promotion |
| `uapt-the-hong-kong-polytechnic-university-20260512` | pass | QS rank 54, not public | Review and intentionally stage/commit if accepted |
| `uapt-university-of-bristol-20260512` | pass | QS rank 51, not public | Review and intentionally stage/commit if accepted |
| `uapt-the-london-school-of-economics-and-political-science-20260512` | pass | QS rank 56, not public | Review source breadth and promote if accepted |
| `uapt-kyoto-university-20260512` | pass | QS rank 57, not public | Review Japanese original-language evidence before promotion |
| `uapt-ludwig-maximilians-universitat-munchen-20260512` | pass | QS rank 58, not public | Review German/English source handling before promotion |
| `uapt-universiti-malaya-20260512` | pass | QS rank 58, not public | Review bundled artifact structure and promote if accepted |
| `uapt-johns-hopkins-university-20260510` | pass | Public already has `jhu` but needs review | Resolve duplicate slug/canonical entity issue |
| `uapt-new-york-university-20260512` | fail | QS rank 55, not public | Repair artifact schema, required families, and hashes before review |

## QS 2026 Coverage

| Status | Count |
| --- | ---: |
| Public | 50 |
| Staging only / unpromoted | 9 |
| Missing | 41 |
| Total QS top 100 rows | 100 |

### Highest-Value Next Crawl/Repair Targets

1. Yonsei University - validated staging exists; review limited-source quality.
2. University of Bristol - validated staging exists; review for promotion.
3. Carnegie Mellon University - validated repaired staging exists; review for
   promotion.
4. The Hong Kong Polytechnic University - validated staging exists; review for
   promotion.
5. New York University - staging exists but validator fails; repair before
   review.
6. LSE - validated staging exists; review for promotion.
7. Kyoto University - validated staging exists; verify Japanese
   original-language evidence.
8. Ludwig-Maximilians-Universitat Munchen - validated staging exists; verify
   German/English source treatment.
9. Universiti Malaya - validated staging exists; review bundled artifact
   structure.
10. KU Leuven - no staging/public record; expect multilingual source discovery.

## Excel Reference Sheet Comparison

Source workbook:
`/Users/newvolume/Documents/OpenClaw/PLSC-EdTechAI_Policy_V4.xlsx`

Status: non-authoritative benchmark only.

| Metric | Value |
| --- | ---: |
| Workbook sheets | 10 |
| Main theme sheets | 6 |
| Institution rows in most sheets | 101 |
| Unique normalized institution names | 102-129 depending on alias handling |
| Rough public-to-workbook normalized-name matches | 26/50 |

The rough match count should be interpreted carefully. The workbook appears to
use a different ranking basis and has name/alias variations. It is still useful
for recall questions such as:

- Are DeepSeek-specific source discovery paths under-covered?
- Are approved-tool pages under-covered?
- Are privacy and copyright pages under-covered compared with teaching and
  academic-integrity pages?
- Do OpenClaw search plans need more source-discovery breadth for service/tool
  pages?

It must not be used to:

- create claims;
- publish source URLs;
- set review states;
- populate public JSON;
- replace official source snapshots.

## Data Quality Risks

| Risk | Severity | Recommended action |
| --- | --- | --- |
| NYU staging run fails validator | high | Repair required artifact families, taxonomy values, and SHA-256 fields before review |
| JHU public slug and unpromoted run use different slug forms | medium | Resolve canonical entity mapping before further promotion |
| Yonsei has one source candidate/snapshot | medium | Review whether source discovery is broad enough before promotion |
| New multilingual staging runs require source-first review | medium | Review Kyoto Japanese evidence and LMU German/English evidence without replacing original snippets |
| Public dataset includes `needs_review` data | medium | Keep warning labels prominent; do not market as fully reviewed |
| Excel benchmark may tempt shortcut filling | high | Keep benchmark files out of public JSON and source attribution |
| Multilingual source discovery will increase | medium | Keep source-first original evidence, language tags, and display translations separate |

## Recommended Next Actions

1. Repair NYU staging artifacts before any promotion review.
2. Review and decide promotion for CMU, Yonsei, Bristol, PolyU, LSE, Kyoto,
   LMU Munich, and Universiti Malaya.
3. Resolve JHU canonical slug/review-state issue.
4. Send QS rank 60 and later missing rows, starting with KU Leuven, to OpenClaw
   source discovery.
5. Use the Excel workbook only as a recall checklist for DeepSeek, approved
   tools, privacy, copyright, teaching, and academic-integrity source discovery.
6. After any accepted promotion, rerun:

```bash
pnpm validate:dataset-release
pnpm audit:public-data
pnpm check
```

7. Refresh this review report and the crawl/ranking knowledge snapshots after
   the next manifest update.

## Publication Boundary

No item in this report should appear as a public claim unless the underlying
claim is backed by official source URL, source language, snapshot hash,
original-language evidence snippet, confidence, and review state, and unless it
is included in the public release workflow.
