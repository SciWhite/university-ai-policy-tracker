# Policy Maintenance Plan

This document defines how University AI Policy Tracker should maintain already
indexed university AI policy records. It is an operating and development plan,
not an instruction to start a crawl.

The current priority is trust maintenance for the public release, not raw
expansion. Routine maintenance must be stable and cheap: deterministic OCI
scripts do the regular scanning, Firecrawl verifies only suspected changes that
HTTP cannot confirm reliably, and OpenClaw is reserved for small deep-review
jobs after a likely policy update is detected.

## Maintenance Goals

- Keep public university policy records fresh without weakening the
  evidence-backed data contract.
- Detect likely source changes before rerunning expensive extraction.
- Avoid treating HTTP failure, blocked responses, or transient timeouts as
  policy changes.
- Preserve original-language evidence, source URLs, source hashes, confidence,
  and review state.
- Expose policy changes through claim-level diffs and citation-ready public
  JSON, not raw source text.
- Keep scripts, Firecrawl verification, OpenClaw staged artifacts, release
  manifests, and the public website separated by clear gates.

## Execution Boundary

### OCI Maintenance Script

The 4c/24GB OCI server should run the regular maintenance scheduler and Stage 1
scanner. This scanner is deterministic code, not an OpenClaw/NIM agent flow.
It is responsible for:

- dynamically loading the current public release and ranking targets;
- scanning QS Top 200 every 3 days;
- scanning all other public-release universities in weekly dynamic shards;
- checking promoted official source URLs with HTTP metadata and normalized hash
  comparison;
- classifying source-health risk without claiming policy change;
- writing maintenance logs, source-health metadata, queue JSON, and markdown
  summaries;
- opening or preparing data PRs only when there is a real metadata change,
  source-health update, or OpenClaw queue item.

The scheduler must not hard-code a total university count. It should derive
worklists from the current public dataset and ranking files so the cadence still
works after the project grows beyond the current release size.

### Firecrawl Verification

Firecrawl is a compliant verification fallback for difficult or dynamic pages.
It is not the default scanner.

Use Firecrawl only when HTTP scanning finds evidence of a possible change but
cannot verify the content reliably. Examples:

- previous content hash exists, but current HTTP content is blocked or unstable;
- final URL or redirect path changed and HTTP content is incomplete;
- `ETag`, `Last-Modified`, content length, title, or normalized text signal
  suggests a meaningful source change;
- prior source-health history plus current metadata makes the source
  inconclusive enough to require verification.

Do not call Firecrawl for HTTP failure, timeout, `403`, blocked, or
`robots_blocked` alone. Those statuses are source-health risks, not policy
change signals.

The Firecrawl API key must live only in OCI secrets or environment variables
such as `FIRECRAWL_API_KEY`. Do not write the key to Git, docs, JSON artifacts,
logs, pull request text, or public API responses.

Firecrawl output remains source-health verification metadata. A
`firecrawl_verified` status only means content was extracted for maintenance
planning. It does not upgrade claim review state, source officialness, or
canonical evidence status.

### OpenClaw Lightweight Deep Review

OpenClaw should not run routine Stage 1 scans and should not use the
`policy-manager` full orchestration flow for daily maintenance. NVIDIA NIM free
keys can be unstable for large jobs, so OpenClaw is reserved for targeted
single-page work after a likely policy update is detected.

Trigger OpenClaw only when HTTP or Firecrawl output indicates a suspected policy
update or source relocation. Each source/page should use one lightweight agent
with a narrow task:

- read the changed source page or an alternate official source;
- decide whether the change is policy-relevant;
- write no-change maintenance notes only under
  `staging/uapt-maintenance/<run-id>/notes/`;
- generate minimal staged artifacts under `staging/uapt-runs/` only when a
  real policy-content update or source repair needs claim/evidence review;
- set top-level `runPurpose` to `claim_evidence_release` for candidate
  claim/evidence updates; do not create note-only `source_health_maintenance`
  artifact bundles;
- return a concise report with source URL, access status, hash status,
  suspected change reason, artifact counts, and recommended next action.

OpenClaw failures should return to the queue with `retryCount`, `lastError`, and
`maintenanceRecommendedAction`. Do not continuously retry a failed item until
it blocks the queue.

OpenClaw must not:

- write the production database;
- push directly to `main`;
- publish canonical claims;
- mark its own output `human_reviewed` or `institution_verified`;
- bypass robots, login walls, paywalls, CAPTCHA, WAF, or other access controls;
- commit raw HTML, raw PDF text, screenshots, browser traces, profiles, or full
  source text to Git.

### Local Codex

Local Codex threads are responsible for:

- planning crawler and release workflows;
- reviewing OpenClaw data pull requests;
- running validators and smoke checks;
- making small artifact, schema, or documentation repairs when needed;
- updating `data/public-releases/current.json` only after staged output passes
  release gates;
- checking the public site, public JSON, and dataset release surfaces.

Local Codex should not perform broad maintenance scans or bulk policy
extraction. Those jobs belong on the OCI maintenance host and, only after a
suspected update, targeted OpenClaw agents.

### Public Site

The public website and public API consume promoted public releases only. They
must not read OpenClaw runtime output, unpromoted staging directories, local
knowledge summaries, or non-authoritative reference sheets as canonical policy
data.

## Maintenance Cadence

The first production cadence is:

| Target set | Cadence | Selection rule | Runner |
| --- | --- | --- | --- |
| QS Top 200 | Every 3 days | Dynamically read ranking/public release intersection | OCI HTTP-first scanner |
| All other public-release universities | Weekly | Dynamic shards over the current public dataset excluding QS Top 200 | OCI HTTP-first scanner |
| Firecrawl verification queue | Same run, bounded by queue policy | Only suspected-change items with unreliable HTTP | OCI script using Firecrawl |
| OpenClaw deep-review queue | Small batches after scan | Only suspected policy updates or source relocation | One lightweight OpenClaw agent per page |

Do not hard-code `518` or any other current dataset size. The weekly sharder
must calculate shard count and shard membership from the live public release.

## Stage 1: HTTP-First Diff

Stage 1 checks promoted official source URLs before any agent work.

Collect maintenance metadata only:

- entity slug and ranking context when available;
- source URL and final URL;
- HTTP status, redirect chain, and access classification;
- `ETag`, `Last-Modified`, content length, and content type;
- title or compact content signal when safely available;
- normalized content hash when HTTP content is readable;
- previous promoted snapshot hash and previous maintenance hash;
- source-health status;
- checked timestamp;
- recommended next action.

Stage 1 must not publish new claims. If HTTP content is readable and the
normalized hash/signals are unchanged, update maintenance metadata only and
stop.

HTTP failure, timeout, `403`, blocked, or `robots_blocked` alone must not become
`changed_hash`, `suspected_policy_update`, or an OpenClaw trigger. These states
should be recorded as source-health risks or repair candidates.

Stage 1 should classify rows into at least:

- `unchanged`
- `changed_hash`
- `metadata_changed`
- `http_failed`
- `blocked_or_inconclusive`
- `needs_firecrawl_verification`
- `firecrawl_verified_changed`
- `suspected_policy_update`
- `needs_openclaw`
- `repair_queue`

## Firecrawl Verification Queue

Only Stage 1 rows with a suspected content or metadata change and unreliable
HTTP should enter `needs_firecrawl_verification`.

Firecrawl should record:

- checked URL and final URL;
- Firecrawl status and HTTP metadata status when available;
- extracted title or compact metadata;
- whether meaningful source content was extracted;
- normalized content hash when available;
- recommended action;
- no-bypass/no-advice caveats.

Firecrawl results should be interpreted conservatively:

- `firecrawl_verified` plus changed content signal can move to
  `suspected_policy_update` or `needs_openclaw`.
- `firecrawl_opened_no_content` moves to repair queue unless other metadata
  strongly suggests policy change.
- `firecrawl_failed` moves to repair queue and does not trigger OpenClaw by
  itself.

## Stage 2: OpenClaw Single-Agent Review

Stage 2 is not a full OpenClaw policy-manager workflow. It is a targeted
single-page review for queue items that already have suspected policy-update
signals.

Trigger conditions:

- HTTP readable content changed in a likely policy-relevant way;
- Firecrawl verified changed source content after HTTP was unreliable;
- official source moved and the new official URL needs policy-specific review;
- source-health risk combines with prior weak evidence, low source count, or low
  confidence and has a change signal.

Do not trigger OpenClaw for:

- HTTP failure alone;
- blocked response alone;
- Firecrawl failure alone;
- unchanged metadata;
- generic source-health warnings with no change signal.

OpenClaw output must not become public data directly. It should generate only
the minimum review material needed:

- no-change or metadata-only results go to
  `staging/uapt-maintenance/<run-id>/notes/`;
- claim/evidence update candidates go to `staging/uapt-runs/` as valid
  `openclaw-artifact-v1` bundles.

Do not put no-change maintenance notes in `staging/uapt-runs/`; they are not
artifact bundles and should not be sent through the artifact validator.

## Maintenance Tiers

| Tier | Members | Cadence | Fetch strategy |
| --- | --- | --- | --- |
| A | QS Top 200, high-traffic universities, recently changed records | Every 3 days for QS Top 200; otherwise configured as high-priority | HTTP-first, Firecrawl only for suspected changes, OpenClaw only for likely policy updates |
| B | Other public-release universities with healthy sources | Weekly dynamic shards | HTTP-first; Firecrawl only for suspected changes |
| C | Source-health failed, low source count, inaccessible, or no-policy records | Weekly repair queue | Source repair and selective Firecrawl/OpenClaw only with change signal or repair need |
| D | Stable, low-traffic, low-risk records | Covered by weekly shard or reduced later after evidence | HTTP-first only unless signals change |

Do not treat source-health metadata as evidence. It is maintenance and repair
metadata only.

## Staged Artifact Workflow

All maintenance updates must pass through the staged artifact workflow:

1. The OCI scheduler builds a maintenance run plan from public release records,
   QS rank, source-health status, and previous snapshot hashes.
2. The HTTP-first scanner collects source metadata and hash status.
3. Firecrawl verifies only suspected-change rows whose HTTP content is
   unreliable.
4. OpenClaw runs only one lightweight agent per source/page for rows marked
   `suspected_policy_update` or `needs_openclaw`.
5. OpenClaw writes no-change results as maintenance notes under
   `staging/uapt-maintenance/<run-id>/notes/`.
6. OpenClaw writes staged artifacts under the existing artifact contract only
   when it finds a real policy-content update or source repair candidate.
   Claim/evidence release candidates may omit `runPurpose` or use
   `claim_evidence_release`.
7. The automation opens a data pull request only when there are valid staged
   artifacts or source-health metadata changes worth reviewing. The PR should
   include run ID, target entities, source URLs, access notes, snapshot counts,
   claim counts, validation output, and known limitations.
8. Local Codex reviews the PR, runs validators, and performs small repairs if
   needed.
9. Passing staged runs that create or repair canonical claim/evidence records
   can be added to `data/public-releases/current.json`.
10. Note-only maintenance results remain outside `staging/uapt-runs/` and feed
   source-health and review-queue metadata only.
11. The public site rebuilds from promoted release data and read-only
   source-health/review metadata.

The public release manifest remains the gate for what appears in public pages,
public JSON, datasets, reports, feeds, widgets, and search surfaces.

## Auto-Promotion Gate

Machine-reviewed updates may be auto-promoted only when all required validators
pass. Published machine-reviewed records should use `agent_reviewed`.

Note-only maintenance results are not auto-promotion candidates and should not
enter the artifact validator. They can update source-health planning metadata,
but they must not add duplicate claim/evidence rows to the public dataset.
The dataset release validator still rejects any public release manifest that
includes a staged bundle marked `runPurpose: source_health_maintenance`.

Do not auto-promote records when:

- validator output has errors;
- source access is blocked or inconclusive;
- claim text changes semantic policy meaning in a way the evidence does not
  clearly support;
- evidence snippets are missing, too broad, translated-only, or not tied to the
  source hash;
- confidence is low;
- source language is missing for verified source or evidence records;
- source discovery skipped required escalation before concluding no reliable
  source;
- OpenClaw attempts to assert `human_reviewed`, `institution_verified`, or
  canonical publication status.

`confidence` remains machine confidence. `reviewState` remains workflow status.
Neither source-health metadata nor Firecrawl verification upgrades review state.

## Review Queue Fallback

Records that fail auto-promotion should enter the review queue with a concrete
recommended action:

- find alternate official URL;
- rerun source discovery;
- rerun browser or Firecrawl fetch;
- reduce claim scope;
- split overbroad claim;
- mark source inaccessible;
- keep current public claim and record maintenance failure;
- request human review.

The review queue should distinguish:

- unchanged source;
- changed hash with no claim change;
- changed claim candidate;
- source failed;
- source blocked;
- source moved;
- low confidence;
- evidence mismatch.

## Public Page And API Implications

No immediate public API change is required to document this plan.

Future additive fields may be added to `/api/public/v1/source-health.json`:

```text
maintenanceTier
lastMaintenanceCheckedAt
nextRecommendedCheckAt
lastMaintenanceRunId
stage1Status
firecrawlVerificationStatus
openclawQueueStatus
maintenanceRecommendedAction
```

These fields are maintenance metadata only. They must not be treated as claim
evidence, source evidence, or review-state upgrades.

Public pages may eventually display:

- maintenance tier;
- last maintenance check;
- next recommended check;
- claim-level diff summary;
- source-health warnings;
- machine-reviewed update labels.

Important public boundaries:

- Public JSON remains versioned under `/api/public/v1/...`.
- Original-language evidence remains canonical.
- Localized summaries and translations are display helpers only.
- The tracker is not legal advice or academic integrity advice.
- Official source documents, page text, PDFs, and screenshots retain their
  original rights.

## Maintenance Run Report Requirements

Each scheduled maintenance run should report:

- generated timestamp;
- run ID;
- target set and shard definition;
- scanned count;
- unchanged source count;
- HTTP failed count;
- blocked or inconclusive count;
- suspected changed count;
- Firecrawl verification count;
- Firecrawl verified changed count;
- repair queue count;
- needs OpenClaw count;
- generated PR URL or no-change summary;
- no-bypass and no-advice caveats.

The report must not include raw source text or full page snapshots.

## Validation Checklist

Before merging any maintenance data PR:

```bash
pnpm validate:openclaw-artifacts <staged-run>
pnpm validate:dataset-release
pnpm audit:public-data
pnpm validate:public-contract
pnpm check
git diff --check
```

After promotion, smoke-check:

```text
/source-health
/coverage/qs-2026
/changes
/api/public/v1/source-health.json
/api/public/v1/datasets/latest.json
```

Acceptance criteria for the maintenance system:

- QS Top 200 is scanned every 3 days.
- Non-QS public-release universities are covered by weekly dynamic shards.
- No target count is hard-coded.
- HTTP-only failure does not trigger Firecrawl or OpenClaw.
- Firecrawl only handles `needs_firecrawl_verification` rows.
- OpenClaw only handles `suspected_policy_update` or `needs_openclaw` rows.
- OpenClaw runs one lightweight agent per page and does not invoke the
  `policy-manager` full workflow.
- OpenClaw writes no-change notes under
  `staging/uapt-maintenance/<run-id>/notes/`, not `staging/uapt-runs/`.
- Only valid `openclaw-artifact-v1` bundles are written to `staging/uapt-runs/`.
- No raw source text is published.
- No production database write occurs.
- No direct push to `main` occurs.

## Implementation Notes

The first implementation should be documentation, queue generation, and a safe
OCI scheduler only. Do not start with a full automated promotion loop.

Recommended sequence:

1. Commit this revised maintenance plan.
2. Implement the OCI HTTP-first scanner with dynamic target selection.
3. Store Firecrawl API credentials only in OCI secrets/environment variables.
4. Add Firecrawl verification only for suspected-change rows with unreliable
   HTTP.
5. Add an OpenClaw lightweight-agent prompt/runbook for single-page deep review.
6. Add systemd service/timer for the scanner.
7. Review the first maintenance report locally before enabling PR automation.
