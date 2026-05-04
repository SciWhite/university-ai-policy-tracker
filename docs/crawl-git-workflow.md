# Crawl Git Workflow

This document defines the branching strategy, data file structure, and PR workflow for OpenClaw-managed crawl operations.

## Branch Naming

| Pattern | Purpose | Example |
|---|---|---|
| `bot/crawl/<run-id>` | Raw crawl artifacts for a single run | `bot/crawl/run-20260504-a1b2c3` |
| `bot/extract/<run-id>` | Extraction candidates from a run | `bot/extract/run-20260504-a1b2c3` |
| `bot/review/<run-id>` | Review annotations and proposed changes | `bot/review/run-20260504-a1b2c3` |
| `bot/report/<date>-<slug>` | Report drafts | `bot/report/20260504-weekly-digest` |
| `chore/<topic>` | Workflow and documentation updates | `chore/openclaw-agent-workflow` |

**Rules:**

- Never push to `main` directly.
- Never force push any branch.
- Run IDs follow: `run-YYYYMMDD-<6-char-hex>` (e.g., `run-20260504-a1b2c3`).
- Branch names are lowercase, hyphenated, max 63 characters.

## Data File Structure

### Crawl Artifacts (bot/crawl branches)

```
data/
  crawls/
    <run-id>/
      manifest.json            # Run metadata: id, timestamp, target schools, params
      <school-slug>/
        <url-hash>.md          # Normalized markdown snapshot
        <url-hash>.meta.json   # Metadata: url, final_url, status, hash, fetched_at, robots_decision
```

### Extraction Candidates (bot/extract branches)

```
data/
  extractions/
    <run-id>/
      <school-slug>/
        <url-hash>.extraction.json   # Structured extraction with source citations
```

### Extraction JSON Schema

```jsonc
{
  "source_url": "https://...",
  "final_url": "https://...",       // After redirects
  "snapshot_hash": "sha256:...",
  "extracted_at": "ISO-8601",
  "extractor_model": "model-id",
  "fields": {
    "ai_policy_status": {
      "value": "restricted",
      "confidence": 0.85,
      "evidence": "Quote or location reference",
      "review_state": "proposed"    // proposed | needs_review | approved | rejected
    }
    // ... additional taxonomy fields
  },
  "needs_review": false,
  "review_notes": null
}
```

### Review Annotations (bot/review branches)

```
data/
  reviews/
    <run-id>/
      review.json   # Array of review decisions per extraction candidate
```

### Report Drafts (bot/report branches)

```
content/
  reports/
    drafts/
      <slug>.mdx    # MDX report draft
```

## PR Workflow

### 1. Crawl Run

```
policy-manager → creates bot/crawl/<run-id> from main
crawl-worker   → fetches URLs, writes artifacts
crawl-worker   → pushes branch, opens PR titled "crawl: <run-id>"
```

### 2. Extraction

```
policy-extractor → creates bot/extract/<run-id> from main
                 → reads crawl artifacts from bot/crawl branch or merged data
                 → writes extraction candidates
                 → pushes branch, opens PR titled "extract: <run-id>"
```

### 3. Review

```
policy-reviewer → creates bot/review/<run-id>
               → reviews extraction candidates
               → writes review annotations
               → pushes branch, opens PR titled "review: <run-id>"
```

### 4. Report

```
report-writer → creates bot/report/<date>-<slug>
              → reads approved extractions
              → writes MDX draft to content/reports/drafts/
              → pushes branch, opens PR titled "report: <slug>"
```

### PR Labels

| Label | Meaning |
|---|---|
| `crawl` | Contains crawl artifacts |
| `extraction` | Contains extraction candidates |
| `review` | Contains review decisions |
| `report` | Contains report draft |
| `needs-human` | Requires human review before merge |
| `dry-run` | Test run, not for merge |

### Merge Strategy

- All bot branches merge via **squash merge** into `main`.
- PRs require at least one human approval (or automated approval rules if configured).
- Conflicts are resolved by rebasing the bot branch onto latest `main`.

## Pilot Crawl Flow

The first crawl should be a limited dry-run to validate the full pipeline:

1. **policy-manager** creates `bot/crawl/pilot-dryrun` with 3-5 well-known universities, max 10 URLs each.
2. **crawl-designer** generates crawl plans and commits to the branch.
3. **crawl-worker** fetches URLs, writes normalized snapshots, pushes artifacts.
4. **policy-extractor** runs extraction on the pilot data.
5. **policy-reviewer** reviews and flags issues.
6. **report-writer** generates a pilot report draft.
7. All PRs are opened with label `dry-run` and reviewed before any merge.

### Pilot Success Criteria

- [ ] All fetches complete without auth errors or rate limit violations.
- [ ] `robots.txt` is respected for all sources.
- [ ] Content hashes are deterministic (same URL → same hash on re-fetch).
- [ ] Extraction candidates cite valid source URLs and snapshot hashes.
- [ ] No credentials or tokens appear in any committed file.
- [ ] All PRs target non-`main` branches.
- [ ] Reviewer correctly flags uncertain extractions as `needs_review`.

## Safety Boundaries

### Do

- Write crawl data only to bot branches.
- Respect rate limits and `robots.txt`.
- Mark inaccessible sources (login walls, paywalls, CAPTCHAs).
- Use conditional requests (`ETag`, `Last-Modified`) when available.
- Report missing credentials instead of fabricating them.

### Don't

- Push to `main`.
- Force push any branch.
- Print or commit tokens, API keys, or secrets.
- Bypass access controls.
- Write to production databases.
- Deploy the website or expose control ports.
- Create cron jobs or scheduled tasks without explicit approval.
- Make final policy conclusions without source evidence.
