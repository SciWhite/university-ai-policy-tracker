# Policy Maintenance Plan

This document defines how University AI Policy Tracker should maintain already
indexed university AI policy records. It is an operating and development plan,
not an instruction to start a crawl.

The current priority is trust maintenance for the public release, not raw
expansion. Large-scale scanning and recrawling should run on the 4c/24GB OCI
server with OpenClaw. Local Codex threads should plan, review pull requests,
run validators, perform small artifact or schema repairs, and promote reviewed
releases.

## Maintenance Goals

- Keep public university policy records fresh without weakening the
  evidence-backed data contract.
- Detect source changes before rerunning expensive extraction.
- Preserve original-language evidence, source URLs, source hashes, confidence,
  and review state.
- Expose policy changes through claim-level diffs and citation-ready public
  JSON, not raw source text.
- Use real QS Top 200 change behavior to calibrate long-term refresh frequency.
- Keep OpenClaw, staging data, review decisions, public release manifests, and
  the public website separated by clear gates.

## Execution Boundary

### OpenClaw on OCI

OpenClaw on the 4c/24GB OCI server is responsible for:

- QS Top 200 baseline scans.
- Source-health probes.
- HTTP, Playwright, Firecrawl, OpenCLI, and script-based fetching.
- Source discovery repair when existing source URLs fail.
- Snapshot generation.
- Claim extraction and evidence binding candidates.
- Review assistance and report drafts.
- GitHub data pull requests containing staged artifacts.

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

Local Codex should not perform large-scale QS200 scanning, broad recrawls, or
bulk policy extraction. Those jobs belong on the OCI OpenClaw host.

### Public Site

The public website and public API consume promoted public releases only. They
must not read OpenClaw runtime output, unpromoted staging directories, local
knowledge summaries, or non-authoritative reference sheets as canonical policy
data.

## QS Top 200 Baseline Scan

Before setting long-term refresh frequency, OpenClaw should run a two-stage
baseline scan over QS Top 200 universities. The purpose is to measure real
change rates, source failure rates, and deep-crawl workload.

### Stage 1: Lightweight Source Check

For every QS Top 200 university already present in the public release, check
the promoted official source URLs first.

Collect only metadata needed for maintenance:

- entity slug and QS rank;
- source URL and final URL;
- HTTP status;
- redirect status;
- `ETag`, `Last-Modified`, and other cache validators when available;
- robots/access status;
- content hash for successfully fetched normalized text;
- previous promoted snapshot hash;
- source-health status;
- checked timestamp;
- recommended next action.

Stage 1 must not publish new claims. If the source hash is unchanged, update
maintenance metadata only and stop.

### Stage 2: Deep Crawl For Changed Or Risky Records

Run deeper OpenClaw crawling and extraction only when Stage 1 finds:

- changed content hash;
- missing or stale source URL;
- source-health failure;
- blocked, inconclusive, or dynamic source;
- high-value university needing stronger verification;
- low source count or weak current evidence;
- suspected policy relocation.

Stage 2 output must be staged artifacts, not public data. It should include
source discovery traces, source candidates, fetch attempts, source snapshots,
claim candidates, evidence candidates, review decisions, and report drafts.
When Stage 2 reuses existing promoted claim IDs and evidence snippets only to
bind source-health checks to public records, the run is maintenance metadata
only. It must stay out of `data/public-releases/current.json` until a
deduplicated maintenance metadata ingestion path promotes source-health fields
without adding duplicate public claims.

## Maintenance Tiers

Frequency should be calibrated after the QS Top 200 baseline scan. Until then,
use these initial tiers as a starting point.

| Tier | Members | Initial cadence | Fetch strategy |
| --- | --- | --- | --- |
| A | QS Top 200, high-traffic universities, and universities changed in the last 60 days | Weekly | HTTP plus regular Firecrawl/Playwright/OpenCLI when useful |
| B | Other public-release universities with healthy sources | Monthly | HTTP and conditional requests first; escalate on hash change or failure |
| C | Source-health failed, blocked, opened with no usable content, low source count, inaccessible, or no-policy records | Weekly repair queue | Discovery repair and selective deep crawl |
| D | Stable, low-traffic, low-risk records | Quarterly | Lightweight source checks only unless source changes |

Do not treat source-health metadata as evidence. It is maintenance and repair
metadata only.

## Frequency Adjustment Rules

After the QS Top 200 baseline scan, adjust cadence based on measured outcomes:

- If QS Top 200 changed-source rate is high, keep Tier A weekly and move Tier B
  to biweekly until stability improves.
- If QS Top 200 changed-source rate is low, keep Tier A weekly, Tier B monthly,
  and Tier D quarterly.
- If source failure or blocked-source rates are high, increase Tier C repair
  queue priority instead of increasing full recrawl frequency.
- If most changes are non-policy boilerplate, improve normalization and diff
  filters before increasing crawl frequency.
- If claim-level changes are frequent in a region or source type, create a
  region/source-specific maintenance rule.

The baseline report should recommend updated frequencies rather than hard-code
them into the crawler.

## Staged Artifact Workflow

All maintenance updates must pass through the staged artifact workflow:

1. OpenClaw builds a maintenance run plan from public release records, QS rank,
   source-health status, and previous snapshot hashes.
2. Stage 1 collects source metadata and hash status.
3. Stage 2 runs only for changed or risky records.
4. OpenClaw writes staged artifacts under the existing artifact contract.
   Maintenance-only bundles must set
   `runPurpose: source_health_maintenance`; claim/evidence release candidates
   may omit `runPurpose` or use `claim_evidence_release`.
5. OpenClaw opens a data pull request with run ID, target entities, source URLs,
   access notes, snapshot counts, claim counts, validation output, and known
   limitations.
6. Local Codex reviews the PR, runs validators, and performs small repairs if
   needed.
7. Passing staged runs that create or repair canonical claim/evidence records
   can be added to `data/public-releases/current.json`.
8. Passing maintenance-only runs stay unpromoted and feed source-health and
   review-queue metadata only.
9. The public site rebuilds from promoted release data and read-only
   source-health/review metadata.

The public release manifest remains the gate for what appears in public pages,
public JSON, datasets, reports, feeds, widgets, and search surfaces.

## Auto-Promotion Gate

Machine-reviewed updates may be auto-promoted only when all required validators
pass. Published machine-reviewed records should use `agent_reviewed`.

Maintenance-only source-health runs are not auto-promotion candidates, even
when validator-clean. They can update source-health planning metadata, but they
must not add duplicate claim/evidence rows to the public dataset.
The dataset release validator explicitly rejects any public release manifest
that includes a staged bundle marked `runPurpose: source_health_maintenance`.

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

## QS200 Baseline Report Requirements

The first OpenClaw baseline report should include:

- generated timestamp;
- OpenClaw run ID;
- QS Top 200 input source and rank coverage;
- public release coverage count;
- universities missing from the public release;
- unchanged source count;
- changed hash count;
- source failed count;
- source blocked or inaccessible count;
- records needing deep crawl;
- records needing source discovery repair;
- estimated cost/time for Stage 2;
- recommended frequency adjustment for Tier A/B/C/D;
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

Acceptance criteria for the QS200 baseline scan:

- QS200 coverage summary exists.
- `unchanged`, `changed_hash`, `source_failed`, `source_blocked`, and
  `needs_deep_crawl` counts are reported.
- Frequency recommendations are based on observed results.
- No raw source text is published.
- No production database write occurs.
- No direct push to `main` occurs.

## Implementation Notes

The first implementation should be documentation and queue generation only.
Do not start with a full automated promotion loop.

Recommended sequence:

1. Commit this maintenance plan.
2. Finish and commit Source Health P0 separately if still pending.
3. Add an OpenClaw-facing QS200 baseline prompt/runbook.
4. Have OpenClaw run Stage 1 on OCI.
5. Review the baseline report locally.
6. Decide the first calibrated maintenance cadence.
7. Implement queue generation and public metadata fields only after the
   baseline results justify them.
