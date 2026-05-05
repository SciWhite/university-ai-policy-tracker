# Data Contract

The P0 public data contract is claim/evidence/citation first. Extraction candidates remain useful intermediate records, but they are not the public source of truth.

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
- source snapshot hash
- short evidence snippet
- retrieved timestamp when available
- source attribution

### SourceAttribution

Describes provenance and rights for an official source. It records source URL, final URL, citation title, publisher, retrieval time, snapshot hash, source type, and the source rights caveat.

## Public JSON

Public university JSON is available at:

```text
/api/public/v1/universities/{slug}.json
```

Recent changes JSON is available at:

```text
/api/public/v1/recent-changes.json
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
- crawl artifact
- source snapshot ingest payload
- extraction candidate payload
- policy claim candidate
- claim evidence
- source attribution

OpenClaw output should arrive through pull requests or limited ingestion credentials. OpenClaw must not deploy services, push `main`, or write the production database directly.

## Student And Course Extension

Student-facing and course-level features should add canonical entities with claim/evidence records. They should reuse the same evidence and citation model instead of storing unsupported comments as public facts.
