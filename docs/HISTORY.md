# Removed documents

On 2026-11-22 the repository was cleaned so that agents stop reading outdated
material (owner approval: "按方案清理"). The files below were deleted, with no
in-tree archive. Each row gives the last commit on `main` that changed the file.
That commit has the file in its final form:

```bash
git show <commit>:<path>          # read one file
git checkout <commit> -- <path>   # restore it locally
```

These are history, not guidance. Current docs are listed in [README.md](README.md),
and the binding rules are in `AGENTS.md`.

## Dated per-school and per-release records (2026-10)

| Path | Commit | Purpose |
|---|---|---|
| `docs/audits/berkeley-qs2026-20261017/REVIEW.md` | bd3e759c | UC Berkeley evidence audit and release reconciliation |
| `docs/audits/melbourne-qs2026-20261017/HISTORY-REPAIR-R2.md` | c594fc3e | Melbourne R2 local history repair acceptance |
| `docs/audits/melbourne-qs2026-20261017/REVIEW.md` | f5a63027 | Melbourne independent evidence audit |
| `docs/audits/tsinghua-qs2026-20261017/REVIEW.md` | 550c326a | Tsinghua audit correction and V6 integration |
| `docs/policy-evidence-phase-C-20261011/melbourne-qs2026-20261017/HISTORY-REPAIR-R3.md` | dc0cd964 | Melbourne V6 R3 calibration and evidence alignment |
| `docs/changes-three-school-fixes.md` | ee7cca13 | Three-school Changes acceptance fixes |
| `docs/changes-three-school-preview.md` | ee7cca13 | Three-school Changes local preview |
| `docs/changes-v6-cohort-local.md` | ee7cca13 | Changes V6: local integration of the other 42 schools |
| `docs/changes-v6-p0-implementation.md` | ee7cca13 | Changes P0 local implementation and acceptance |
| `docs/changes-v6-p1a-implementation.md` | ee7cca13 | Changes/V6 P1a implementation record |
| `docs/changes-v6-p1b-implementation.md` | ee7cca13 | P1b per-school event history and frozen revision pages |
| `docs/changes-v6-p1c-implementation.md` | ee7cca13 | P1c site-wide per-event Changes browsing |
| `docs/changes-v6-p2-implementation.md` | ee7cca13 | P2 embedded record-update module in V6 |
| `docs/changes-v6-p3-summary-workflow.md` | ee7cca13 | P3 independent summaries, three-school pilot |
| `docs/changes-v6-storage-20261024-result.md` | 0928b143 | Changes V6 launch and first disk-governance result |
| `docs/chicago-tools-release-20261014.md` | f84c5dd4 | UChicago tool-classification correction |
| `docs/clarity-integration-20261017/` (2 files) | b7096f61 | Microsoft Clarity V6 production acceptance and a screenshot |
| `docs/cornell-v6-r2-release-20261016.md` | c3a9be57 | Cornell V6 follow-up correction |
| `docs/cornell-v6-release-20261016.md` | 6c787626 | Cornell evidence and V6 integration |
| `docs/hku-v6-release-20261014.md` | 716ea9a9 | HKU V6 scoped correction |
| `docs/imperial-v6-balance-release-20261015.md` | d6c1c0eb | Imperial V6 alignment and action shortcut release |
| `docs/imperial-v6-refine-release-20261015.md` | db8c8bfc | Imperial V6 compact presentation release |
| `docs/imperial-v6-ux-20261015.md` | d1cf1a45 | Imperial V6 evidence-first UX |
| `docs/index-measurement-release-20261026.md` | 42da9c73 | Bounded indexing and measurement repair |
| `docs/local-v6-core-pages-20261019.md` | ba543052 | V6 core pages local review |
| `docs/local-v6-directory-marks-20261019.md` | ba543052 | V6 directory marks, local integration |
| `docs/local-v6-discovery-release-20261020.md` | ba543052 | V6 discovery shared-zone release |
| `docs/local-v6-home-rankings-20261019.md` | ba543052 | V6 homepage and ranking directory review |
| `docs/local-v6-identity-dedup-20261019.md` | ba543052 | University identity dedup (828 slugs to 815 identities) |
| `docs/local-v6-mockup-alignment-20261019.md` | ba543052 | V6 five-page mockup implementation |
| `docs/mit-v6-student-guide-pilot-20261015.md` | 4985fe7b | MIT V6 compact student-guide pilot |
| `docs/ntu-chicago-v6-release-20261014.md` | 72137445 | NTU and UChicago evidence repair and V6 release |
| `docs/pku-v6-homepages-release-20261015.md` | d9249987 | PKU V6 integration and homepage links |
| `docs/prisma7-mcp-preflight-20261026.md` | 95bc68fd | Prisma 7 MCP repair and pre-deployment acceptance |
| `docs/prisma7-migration-20261026.md` | 95bc68fd | Prisma 7 isolated migration acceptance |
| `docs/qs20-24-audit-followup-20261020.md` | fc645641 | QS 20–24 second-audit follow-up |
| `docs/qs25-31-audit-followup-20261020.md` | 5da541dd | Seven-school audit follow-up |
| `docs/qs51-70-v6-presentation-release.md` | cd84b89d | QS rows 51–70 V6 presentation release |
| `docs/qs51-70-v6-repair-r3.md` | 0ac3b39a | QS 51–70 presentation repair R3 |
| `docs/release-lifecycle-20261016-result.md` | 65ff0fce | 2026-10-16 release-lifecycle governance result |
| `docs/release-storage-20261025-result.md` | b3602533 | 2026-10-25 failed and superseded release archive, hold gate |
| `docs/retention-window-20261025-result.md` | 003a30d0 | 7-day hold window implementation result |
| `docs/seo-runtime-repair-20261018.md` | 3bae1439 | Bounded search runtime repair |
| `docs/september-2026-report-release-notes.md` | dbe59f67 | September 2026 report release preparation |
| `docs/student-plugin-release.md` | dad3ce63 | Student plugin combined release (V4-era acceptance) |
| `docs/upenn-v6-release-20261016.md` | 044f5bcf | UPenn evidence correction and V6 integration |
| `docs/v6-audit-fix-20261014.md` | 19176208 | Ten-school V6 scoped correction |
| `docs/v6-compact-rollout-20261015.md` | 8572fd93 | Shared compact V6 rollout |
| `docs/v6-directory-payload-fix-20261016.md` | bda783e2 | Directories and bounded V6 first-paint data |
| `docs/v6-followup-20261014.md` | 87b3b74b | V6 acceptance follow-up correction |
| `docs/v6-norm-sync-20261014.md` | 78577ab0 | V6 norm synchronization |
| `docs/v6-runtime-release-20261017.md` | e820a7bb | 2026-10-17 V6 shared runtime partial release |
| `docs/v6-shards-cache-20261016.md` | 9ee056d1 | V6 immutable shards and bounded historical caches |
| `docs/v6-ten-pages-release-20261013.md` | 0d69611c | V6 ten-page bounded release |

## Finished or superseded plans

| Path | Commit | Purpose |
|---|---|---|
| `docs/agent-skills-usage.md` | 909b121a | 2026-05 agent skill usage notes |
| `docs/agent-working-methods.md` | 81797b5f | Agent working methods and repository history narrative |
| `docs/ai-search-page-plan.md` | 77b5f496 | AI/search reference page plan |
| `docs/changes-v6-development-plan.md` | ee7cca13 | Changes/V6 phased development plan |
| `docs/exposure-distribution-architecture.md` | 1601048b | Long-term distribution, SEO/GEO, dataset and API roadmap |
| `docs/github-style-frontend-plan.md` | 9d88976f | Frontend redesign plan (2026-05) |
| `docs/knowledge-review-infrastructure-plan.md` | 1601048b | Knowledge and review infrastructure plan |
| `docs/policy-analysis-layer-development-plan.md` | 1601048b | Policy analysis layer development plan (the contract stays in `policy-analysis-contract.md`) |
| `docs/policy-maintenance-plan.md` | 1601048b | Policy maintenance plan (the operations are in `maintenance-oci-runbook.md`) |
| `docs/source-snapshot-storage-plan.md` | 1601048b | Private source snapshot storage plan |
| `docs/reference/qs-2026-top-100.md` | 1a98aa07 | QS 2026 top-100 reference list used by the 2026-05 plans |

## V4/V5 material

The V4/V5 code itself is still in use; see [v4-v5-retirement-plan.md](v4-v5-retirement-plan.md).

| Path | Commit | Purpose |
|---|---|---|
| `docs/pku-v5-diff-fix-20261015.md` | 32a905d1 | PKU V5 historical diff JSON repair |
| `docs/pku-v5-release-20261014.md` | e40b4bc6 | PKU evidence repair and V5 release |
| `docs/policy-hero-candidates/v4-ready-three-20261003/` (13 files) | eb9d95e1 | V4 hero image prompts and selected assets (Aalto, Cornell, Melbourne) |
| `docs/policy-scene-pilot.md` | e71d4f37 | Twenty-university V4 policy scene candidate |
| `docs/tulsa-runtime-zone-release/README.md` | a2664207 | Tulsa V5 bounded runtime-content zone release |
| `docs/uapt-7-visual-assets.md` | 1e4fcaa9 | UAPT 7 visual assets |

## Google index recovery P0 (2026-09)

The pilot code (`apps/web/lib/index-recovery-pilot.ts`) still cites
`docs/google-index-recovery-p0-review.md` in a comment. Read it at a2076362.

| Path | Commit | Purpose |
|---|---|---|
| `docs/google-index-recovery-p0-deployment.md` | c346be7b | P0 deployment and production verification report |
| `docs/google-index-recovery-p0-final-acceptance.md` | a2076362 | P0 corrected final acceptance |
| `docs/google-index-recovery-p0-release-readiness.md` | a2076362 | P0 release readiness |
| `docs/google-index-recovery-p0-review.md` | a2076362 | P0 pilot local acceptance (claim-level evidence) |
| `docs/google-index-recovery-p0-evidence/` (20 files) | a2076362 | P0 baseline and candidate screenshots, pixel/RSC/hash JSON |

## Old deployment and pre-R1 release methods

| Path | Commit | Purpose |
|---|---|---|
| `docs/deployment.md` | cec289cd | Pre-R1 pull/build/restart deployment (marked superseded) |
| `docs/oci-production-deployment.md` | 8e20f0fb | Vercel-to-OCI migration and pull/build/restart deploy |
| `docs/oci-build-once-release.md` | 3e39d89a | Pre-R1 OCI full-site build-once release (superseded by `program-release.md`) |
| `docs/supabase-analytics-inbound-source-migration.md` | 3e75e1a0 | One-off Supabase SQL migration for `/internal/analytics` |
| `docs/vercel-i18n-deployment-runbook.md` | 12c3ff43 | Deprecated Vercel i18n deployment runbook |

## Old multilingual and 33-locale docs

These were superseded by the locale redesign: English and Chinese content URLs,
with UI locales chosen in the browser (branch `claude/pensive-elion-2fc75f`).

| Path | Commit | Purpose |
|---|---|---|
| `docs/multilingual-release-runbook.md` | 6142f70a | Multilingual public-content release runbook |
| `docs/multilingual-seo-geo-20261028.md` | 42c10fbe | Multilingual SEO/GEO implementation review |
| `docs/ui-i18n-33-locale-coverage.md` | 4bfe2e50 | Interface text coverage for 33 reading locales |

## knowledge/

| Path | Commit | Purpose |
|---|---|---|
| `knowledge/crawl-runs/full-source-scan-20260726-repair-queues.json` | 5cd1b847 | 2026-07-26 full source scan repair queues (data) |
| `knowledge/crawl-runs/full-source-scan-20260726-repair-queues.md` | 1601048b | 2026-07-26 full source scan repair queues (summary) |
| `knowledge/reviews/2026-05-12-public-vs-staging-vs-qs.md` | fa1ef379 | Public vs staging vs QS review note; `pnpm knowledge:update` regenerates one |
| `knowledge/reviews/2026-07-26-public-vs-staging-vs-qs.md` | 6142f70a | Same, 2026-07-26 |

## Kept on purpose

- `docs/policy-evidence-integration-plan.md`, `docs/policy-evidence-phase-C-20261011.md` and
  `docs/policy-evidence-reconciliation-20261011.md` are linked from
  `knowledge/policy-inventory/current.md`. That file is hash-pinned by
  `scripts/policy-inventory-status.py` and cannot be edited.
- `docs/audits/mit-qs2026-20261010/PRE-REPAIR-AUDIT.md` is cited by the runtime data in
  `data/public-record-repairs/mit-20261010/README.md`.
- All of `staging/` stays. `staging/uapt-runs/` is part of the content file set
  (`scripts/content-release/file-set.ts`) and the release manifests;
  `staging/ai-tools/` is referenced by the release manifests and
  `scripts/rebuild-ai-tools-openclaw-artifacts.ts`; `staging/uapt-maintenance/`
  is the default root of the maintenance scripts.
- Frozen records (`docs/policy-evidence-integration-plan.md`) and the audit documents in `docs/audit-20261121/` cite some of the removed files
  as evidence; resolve those paths with the tables above.
