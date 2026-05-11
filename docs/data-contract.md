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

The public university list is available at:

```text
https://eduaipolicy.org/api/public/v1/universities.json
```

Recent changes JSON is available at:

```text
https://eduaipolicy.org/api/public/v1/recent-changes.json
```

The latest dataset release manifest is available at:

```text
https://eduaipolicy.org/api/public/v1/datasets/latest.json
```

Report chart data is available at:

```text
https://eduaipolicy.org/api/public/v1/reports/2026-05/chart-data.json
```

Embeddable widget discovery and widget JSON are available at:

```text
https://eduaipolicy.org/api/public/v1/widgets/index.json
https://eduaipolicy.org/api/public/v1/widgets/university-status/{slug}.json
https://eduaipolicy.org/api/public/v1/widgets/recent-changes.json
```

Read-only agent/API policy metadata is available at:

```text
https://eduaipolicy.org/api/public/v1/mcp/manifest.json
https://eduaipolicy.org/api/public/v1/rate-limit-policy.json
```

Contribution and review policy metadata is available at:

```text
https://eduaipolicy.org/api/public/v1/contributions/index.json
https://eduaipolicy.org/api/public/v1/contributions/review-policy.json
```

Bulk dataset artifacts are available at:

```text
https://eduaipolicy.org/api/public/v1/datasets/universities.jsonl
https://eduaipolicy.org/api/public/v1/datasets/claims.jsonl
https://eduaipolicy.org/api/public/v1/datasets/sources.jsonl
https://eduaipolicy.org/api/public/v1/datasets/changes.jsonl
https://eduaipolicy.org/api/public/v1/datasets/checksums.txt
https://eduaipolicy.org/api/public/v1/datasets/data-dictionary.md
```

The release manifest includes artifact URLs, filenames, row counts, byte sizes,
SHA-256 checksums, citation fields, source rights caveats, and aggregate counts.
The JSONL files are metadata exports only; raw source documents, full page text,
PDFs, and screenshots are not published as tracker metadata.

The public API index is available at:

```text
https://eduaipolicy.org/api/public/v1/index.json
```

Public report and change feeds are available at:

```text
https://eduaipolicy.org/feeds/reports.xml
https://eduaipolicy.org/feeds/recent-changes.xml
https://eduaipolicy.org/feeds/atom.xml
```

Embeddable widgets use:

```text
https://eduaipolicy.org/widgets/embed.js
```

Widget JSON endpoints include permissive CORS headers for public embedding.
The general public API remains read-only. The MCP alpha manifest is a design
contract only: it must not write production data, operate OpenClaw, publish
canonical claims, or bypass review state.

The contribution metadata endpoints are also read-only. Public submissions use
GitHub issue templates as review tasks; they do not directly write the
production database, publish canonical facts, or change review state.

Every v1 public JSON response should include a stable envelope:

- `apiVersion`
- `generatedAt`
- `canonicalUrl`
- `license`
- `trackerMetadataLicense`
- `sourceRightsPolicy`
- `citation`
- `data`

The university JSON includes:

- `citationTitle`
- `canonicalUrl`
- `publicPageUrl`
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

Course-level submissions must start as moderated review tasks. They require a
course entity, term, source type, short original-language evidence excerpt,
source language, privacy review, copyright review, and a review state before
any public claim/evidence record can be published. Full syllabi, private student
information, non-public instructor data, and unsupported accusations are not
valid tracker evidence.

## Contribution Review Contract

Contribution paths currently include:

- official source URL submission
- policy change report
- institution correction
- course AI policy submission
- translation or evidence-display correction
- dataset or API issue

All contribution paths create review tasks, not canonical public facts.

Review queues include:

- source discovery review
- crawl failure review
- claim/evidence review
- translation review
- institution correction review
- course submission review
- abuse and moderation review

Publication requires source-first evidence, source language, rights caveats,
review state, confidence, and audit history. Institution corrections must cite
supporting sources. Translation corrections can change helper display text but
cannot replace original-language evidence.
