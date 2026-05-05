# Data Contract

The P0 public data contract is claim/evidence/citation first. Extraction candidates remain useful intermediate records, but they are not the public source of truth.

Canonical public domain: `https://eduaipolicy.org`. Public canonical URLs should be generated from this base in production.

## Core Objects

### CanonicalEntity

Represents a stable public entity:

- university
- tool
- region
- theme
- future course-level entity

Canonical entities own canonical URLs and public summaries.

### PolicyClaim

Represents one policy assertion about a canonical entity. A policy claim stores claim text, claim type, confidence, review state, last checked time, and last changed time.

Confidence and review state must not be merged.

### ClaimEvidence

Links a policy claim to source proof. Every public claim needs at least one evidence record with:

- source URL
- source language
- source snapshot hash
- short evidence snippet in the original source language
- optional localized display snippet or summary
- retrieved timestamp when available
- source attribution

Original-language evidence is canonical. Localized display text is presentation-only helper content and must not replace source URL, source hash, review state, confidence, or the original evidence snippet.

### SourceAttribution

Describes provenance and rights for an official source. It records source URL, final URL, citation title, publisher, retrieval time, snapshot hash, source type, and the source rights caveat.

## Public JSON

Public university JSON is available at:

```text
https://eduaipolicy.org/api/public/v1/universities/{slug}.json
```

Recent changes JSON is available at:

```text
https://eduaipolicy.org/api/public/v1/recent-changes.json
```

The university JSON includes:

- `citationTitle`
- `canonicalUrl`
- `lastCheckedAt`
- `lastChangedAt`
- `confidence`
- `reviewState`
- `license`
- `sourcePolicy`
- `officialSources`
- `claims`
- `suggestedCitation`

## OpenClaw Artifact Target

OpenClaw should produce artifacts that can validate into this contract:

- crawl plan
- crawl target
- source candidate
- source discovery trace
- source rejection
- fetch attempt
- source snapshot ingest payload
- extraction candidate payload
- policy claim candidate
- claim evidence
- source attribution
- review decision
- report draft

OpenClaw output should arrive through pull requests or limited ingestion credentials. OpenClaw must not deploy services, push `main`, or write the production database directly.

Repo-side validation is available with:

```bash
pnpm validate:openclaw-artifacts path/to/staging-directory
```

OpenClaw staged artifacts must include `runId`, `sourceUrl`, `sourceLanguage` for verified sources and evidence, source discovery trace, source candidate verification status, fetch attempt outcome, content or snapshot hash, original-language evidence snippet, confidence, review state, citation fields, and the official source rights caveat. The validator rejects unversioned `/api/public` links, missing evidence, missing source language, crawl targets or snapshots without verified source candidates, generic or low-specificity verified sources, raw HTML/PDF/screenshot paths intended for Git, OpenClaw attempts to publish canonical claims, and unclear review states.

## Student And Course Extension

Student-facing and course-level features should add canonical entities with claim/evidence records. They should reuse the same evidence and citation model instead of storing unsupported comments as public facts.
