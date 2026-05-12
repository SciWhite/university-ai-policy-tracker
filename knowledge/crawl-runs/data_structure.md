# Crawl Run Knowledge Index

## Purpose

This directory summarizes OpenClaw and OpenCode crawl artifacts for low-token
review. It helps agents answer operational questions about public release
contents, staging gaps, validator status, and next repair actions.

## Authority Boundary

Authority level: derived_snapshot.

Files in this directory are not policy evidence. They cannot create public
claims, publish a university page, or override the artifact validator. Public
claims still require official source URL, source language, snapshot hash,
original-language evidence, confidence, and review state.

## Files

- `current-public-release.md` - what the current public release manifest
  promotes, plus public data audit totals.
- `unpromoted-staging-runs.md` - staging directories that are not promoted,
  with validator status where checked.

## Refresh Commands

Use these commands before refreshing crawl-run summaries:

```bash
pnpm validate:dataset-release
pnpm audit:public-data
pnpm audit:public-data -- --details
pnpm validate:openclaw-artifacts <staging-run-dir>
```

## Do Not Use For

- Replacing `data/public-releases/current.json`.
- Publishing unpromoted staging data.
- Treating machine or agent review as human review.
- Inferring policy facts from a summary without checking source artifacts.
