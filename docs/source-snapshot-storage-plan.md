# Source Snapshot Storage Plan

Status: implementation plan and operating boundary
Scope: private normalized source snapshots for maintenance and release-to-release diff quality
Public boundary: source snapshots are not public dataset artifacts

## Goals

The tracker needs enough historical source context to distinguish real policy-text changes from page chrome, redirects, metadata churn, and crawler noise. Current public releases preserve claim/evidence snippets and source snapshot hashes, but they do not preserve full source page text. That is correct for public distribution, but it limits diff quality.

This plan adds a private source snapshot layer:

- Store normalized source text for promoted official source URLs in private storage.
- Compare private normalized text hashes during maintenance.
- Use the comparison to route work to no-change notes, source-health repair, or claim/evidence review.
- Keep public pages and public JSON limited to short evidence snippets, source URLs, hashes, and citation-safe metadata.

## Non-Goals

- Do not publish raw HTML, PDF full text, screenshots, browser profiles, or full normalized source text.
- Do not treat stored source text as a new canonical evidence source.
- Do not bypass robots.txt, login walls, paywalls, CAPTCHAs, WAFs, or access controls.
- Do not upgrade claim `reviewState` because a page was fetched or stored.
- Do not provide legal advice or academic integrity advice.

## Storage Boundary

Private source snapshots must live outside Git-tracked data and outside public API routes. Preferred locations:

- Local development: `.local/source-snapshots/`
- OCI maintenance host: `/home/openclaw/workspace/.local/source-snapshots/`
- Future object storage: private Cloudflare R2, OCI Object Storage, or S3-compatible bucket

Already ignored Git paths such as `.local/`, `data/raw/`, and `data/snapshots/` are acceptable private roots. Public release artifacts under `data/public-releases/` must not contain full source text.

## Copyright And Source Rights

Official university pages remain the canonical source. The tracker may keep private, operational snapshots for change detection and audit, but public output must remain citation-first:

- Public pages show source URL, source title, retrieved time, snapshot hash, and short evidence snippets.
- Public JSON exposes metadata and evidence excerpts only.
- Private normalized text may be used to decide whether a source needs review, but it is not redistributed.
- If a source has explicit restrictive terms, login requirements, paywalls, or robots restrictions, the maintenance system records access metadata and does not bypass the restriction.

## Private Snapshot Layout

Recommended local/object layout:

```text
.local/source-snapshots/
  current.json
  <releaseId>/
    manifest.json
    snapshots/
      <entitySlug>__<sourceHash>/
        metadata.json
        normalized.md
  diffs/
    <previousReleaseId>__<currentReleaseId>.json
```

`normalized.md` is private. `metadata.json`, `manifest.json`, and `diffs/*.json` are also private by default, even though they should avoid raw source text.

## Metadata Contract

Each private snapshot record should include:

- `schemaVersion`
- `releaseId`
- `entitySlug`
- `entityName`
- `sourceUrl`
- `finalUrl`
- `citationTitle`
- `sourceType`
- `publicSnapshotHash`
- `retrievedAt`
- `fetchStatus`
- `fetchedAt`
- `httpStatus`
- `contentType`
- `contentLength`
- `normalizedTextHash`
- `normalizedTextBytes`
- `metadataPath`
- `normalizedTextPath`
- `sourceRightsPolicy`
- `limitations`

The private diff record should include:

- `previousReleaseId`
- `currentReleaseId`
- `entitySlug`
- `sourceUrl`
- `status`
- `oldPublicSnapshotHash`
- `newPublicSnapshotHash`
- `oldNormalizedTextHash`
- `newNormalizedTextHash`
- `summary`

Allowed diff statuses:

- `added`
- `removed`
- `unchanged`
- `normalized_text_changed`
- `metadata_changed`
- `metadata_only`
- `unavailable`

## P0: Documentation And Boundary

Deliverables:

- This plan.
- A documented rule that private source snapshots are operational metadata, not public claims.
- A documented rule that original-language evidence snippets remain the public evidence surface.

Acceptance criteria:

- No public API exposes full source text.
- No Git-tracked file contains fetched page bodies.
- Public diff pages keep no-advice and source-rights caveats.

## P1: Baseline Snapshot Builder

Add a script that reads the current promoted public release and writes a private source snapshot manifest.

Default behavior should be no-network:

```bash
pnpm snapshots:baseline
```

This writes metadata-only records under `.local/source-snapshots/<releaseId>/`.

Optional fetch mode can be run on OCI or another approved maintenance environment:

```bash
pnpm snapshots:baseline -- --fetch --limit 25
```

Fetch mode:

- Uses normal public HTTP requests only.
- Stores normalized text privately.
- Computes `normalizedTextHash`.
- Does not write raw source content to Git.
- Does not call OpenClaw.
- Does not create or promote claims.

## P2: Maintenance Diff Routing

The maintenance scanner should compare current source results against private snapshot metadata:

- Same normalized text hash: route to no-change note.
- Snapshot hash changed but normalized text unchanged: route to `metadata_or_chrome_delta`.
- Normalized text changed: route to `content_policy_delta` candidate.
- Fetch failed or blocked without a prior content-change signal: route to source-health risk only.
- Fetch failed or blocked with other strong change signals: route to Firecrawl verification candidate.

HTTP failures, 403s, robots blocks, timeouts, and Firecrawl failures are not policy changes by themselves.

## P3: Change Page Integration

`/changes` and `/api/public/v1/changes/...` may read private diff metadata if it exists in the deployment environment. This must be optional:

- If private diff metadata exists, source snapshot rows can say whether normalized source text changed.
- If it does not exist, pages fall back to claim/evidence diff and source snapshot hash diff.
- Public output never includes full source text, storage keys, or private object paths.

Public rows may expose only:

- `sourceTextDiffStatus`
- `sourceTextDiffSummary`

These fields are explanatory metadata. They do not change the official source boundary or claim review state.

## Validation Checklist

Before using private snapshots for release review:

- `pnpm validate:dataset-release`
- `pnpm audit:public-data`
- `pnpm validate:public-contract`
- `pnpm check`
- `git diff --check`

Before publishing changes:

- Confirm no `normalized.md`, raw HTML, PDF text, screenshots, browser profiles, or full source text were staged.
- Confirm source snapshot metadata did not upgrade `reviewState`.
- Confirm public JSON remains versioned under `/api/public/v1/...`.
- Confirm change pages distinguish tracker changes from official policy changes.
