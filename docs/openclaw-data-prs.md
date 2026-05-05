# OpenClaw Data PR Requirements

OpenClaw crawl output is staged candidate data. It must be reviewed before merge and must never deploy services, push `main`, or write the production database directly.

Canonical public domain: `https://eduaipolicy.org`. OpenClaw PRs may generate tracker links under this domain, but must not change Cloudflare, DNS, deployment settings, or production credentials.

## Required Artifact Types

OpenClaw data PRs should stage JSON artifacts that validate against `openclaw-artifact-v1`:

- `crawl_plan`
- `source_snapshot`
- `claim_candidate`
- `evidence_candidate`
- `review_decision`
- `report_draft`

Run validation locally with:

```bash
pnpm validate:openclaw-artifacts path/to/staging-directory
```

The default fixture command is:

```bash
pnpm validate:openclaw-artifacts
```

## Required Fields

Each artifact group must preserve:

- `runId`
- `sourceUrl`
- `sourceLanguage`
- `contentHash` or `snapshotHash`
- `evidenceSnippetOriginal`
- `confidence`
- `reviewState`
- citation fields
- official source rights caveat

Original-language evidence is canonical. Translation or localized display is optional and must not replace original evidence.

## Automatic Rejection Conditions

Reject or request changes when validation reports:

- missing evidence
- missing source language
- missing or unclear review state
- unversioned `/api/public` links
- raw HTML, PDF, screenshots, traces, browser profiles, or logs staged for Git
- OpenClaw attempting to publish canonical claims
- OpenClaw claiming `human_reviewed`
- evidence hash that does not match a staged source snapshot
- official source rights caveat missing

## Reviewer Checklist

Before merge, reviewers should verify:

- The PR contains no secrets or credentials.
- The PR does not modify OpenClaw config or production deployment files.
- The PR does not include raw source documents or screenshots.
- Claims do not overstate what the evidence snippet supports.
- `confidence` remains machine confidence, separate from `reviewState`.
- `reviewState` is one of the project vocabulary values.
- Candidate claims are not treated as canonical facts.
- Public JSON links use `/api/public/v1/...`.
- The PR description includes run ID, target entities, fetched URLs, skipped URLs, robots/access notes, snapshot count, claim/evidence count, validation command output, and known limitations.

## Fixture Directory

Synthetic examples live in:

```text
examples/openclaw-staging/valid/
```

These fixtures are contract examples only. They are not real crawl data.
