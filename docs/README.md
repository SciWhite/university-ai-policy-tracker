# Docs index

The current docs are listed here. Binding rules are in `AGENTS.md`. Docs removed on
2026-11-22 are listed, with the commits that still have them, in [HISTORY.md](HISTORY.md).
Do not follow a doc that is not on this page.

## Start here

- [architecture.md](architecture.md): what runs in production and how the repository is laid out.
- [audit-20261121/REPORT.md](audit-20261121/REPORT.md): the full 2026-11-21 audit (in Chinese, with an English agent appendix). Its
  [incidents](audit-20261121/incidents.md), [tooling inventory](audit-20261121/tooling-inventory.md)
  and [phase 1 record](audit-20261121/PHASE1.md) are in the same folder.

## Releases and operations

| Doc | Read when |
|---|---|
| [content-release.md](content-release.md) | Shipping data only: claims, pages, reports, translations, history |
| [program-release.md](program-release.md) | Shipping code, UI, routes, dependencies, schemas or UI copy; it also covers nginx, caches and slot memory |
| [release-lifecycle.md](release-lifecycle.md) | Controller gates, journal, recovery, `rescan`, `classify-content-releases`, `hold-status` |
| [release-storage-policy.md](release-storage-policy.md) | Disk budgets, retention register, hold deadlines, archiving and cleanup |
| [v6-pipeline.md](v6-pipeline.md) | Running a batch of schools from crawl to V6 to a content release |
| [server-fixes-20261121.md](server-fixes-20261121.md) | Memory, watchdog and hold-deadline fixes applied on 2026-11-21 |
| [stop-bleed-set2-20261121.md](stop-bleed-set2-20261121.md) | nginx and Cloudflare changes applied on 2026-11-21, and how to measure them |
| [render-once.md](render-once.md) | Page store, pre-rendered tree, content-language URLs and the combined rollout plan (not yet released) |
| [release-routing-policy.md](release-routing-policy.md), [oci-small-release.md](oci-small-release.md) | **Historical (pre-R1).** Only for reading old zone-era receipts; never for new releases |

## V6 school pages and marks

| Doc | Read when |
|---|---|
| [policy-v6-integration-guide.md](policy-v6-integration-guide.md) | Adding or updating a school's V6 page |
| [templates/policy-v6-school-input.md](templates/policy-v6-school-input.md), [templates/policy-v6-acceptance.md](templates/policy-v6-acceptance.md) | Per-school input and the acceptance checklist |
| [prompts/policy-v6-school-task.md](prompts/policy-v6-school-task.md) | Briefing an agent for one school |
| [v6-input-hash-seo-contract.md](v6-input-hash-seo-contract.md) | V6 input adapters, source hashes, the SEO contract and `validate:v6-release` |
| [university-marks-current.md](university-marks-current.md) | Looking up a university mark (current full library) |
| [policy-v6-mark-integration.md](policy-v6-mark-integration.md) | Mark roles and limits; also covers the historical 211-role delta |
| [v4-v5-retirement-plan.md](v4-v5-retirement-plan.md) | Before you touch any V4/V5 module, `apps/tulsa-zone` or `v5.json` |

## Evidence, data contracts and maintenance

| Doc | Read when |
|---|---|
| [policy-evidence-integration-runbook.md](policy-evidence-integration-runbook.md) | Crawl, review, repair or indexing work against the private inventory |
| [policy-audit-requirements-v1.json](policy-audit-requirements-v1.json), [v1.1](policy-audit-requirements-v1.1.json) | The versioned audit requirements registry, read by scripts |
| [policy-evidence-integration-plan.md](policy-evidence-integration-plan.md), [phase C](policy-evidence-phase-C-20261011.md), [reconciliation B](policy-evidence-reconciliation-20261011.md) | Frozen 2026-10-11 phase records, linked from the hash-pinned `knowledge/policy-inventory/current.md` |
| [data-contract.md](data-contract.md) | Claim, evidence and citation objects; entity aliases |
| [taxonomy.md](taxonomy.md) | Status and classification values |
| [citation-policy.md](citation-policy.md) | How claims are cited and quoted |
| [crawler-policy.md](crawler-policy.md) | Crawler behaviour and access boundaries |
| [policy-snapshot-contract.md](policy-snapshot-contract.md) | The student policy snapshot (`uapt-policy-snapshot-v1`) |
| [policy-analysis-contract.md](policy-analysis-contract.md) | Analysis profiles derived from claims |
| [policy-change-log-release-gate.md](policy-change-log-release-gate.md) | Every policy update publishes its change log |
| [dataset-release-process.md](dataset-release-process.md) | Dataset artifacts under `/api/public/v1/datasets/` |
| [report-distribution-playbook.md](report-distribution-playbook.md), [geo-monthly-reports.md](geo-monthly-reports.md) | Monthly reports and their distribution |
| [audits/mit-qs2026-20261010/PRE-REPAIR-AUDIT.md](audits/mit-qs2026-20261010/PRE-REPAIR-AUDIT.md) | Cited by `data/public-record-repairs/mit-20261010` |

## OpenClaw and maintenance

| Doc | Read when |
|---|---|
| [agent-workflow.md](agent-workflow.md) | OpenClaw agent roles and limits |
| [openclaw-data-prs.md](openclaw-data-prs.md) | The staged artifact PR workflow |
| [openclaw-policy-maintenance-contract.md](openclaw-policy-maintenance-contract.md) | Scheduled maintenance and sync recording |
| [maintenance-oci-runbook.md](maintenance-oci-runbook.md) | Installing and running the HTTP-first maintenance scanner |
| [oci-policy-update-from-crawl-data.md](oci-policy-update-from-crawl-data.md) | Turning maintenance crawl output into a reviewed update |
| [security.md](security.md) | Credential and host separation |
