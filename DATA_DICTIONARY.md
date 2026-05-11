# Data Dictionary

This dictionary explains the public University AI Policy Tracker data contract. Public JSON is versioned under `/api/public/v1/...`.

## Contract Rules

- Public API changes should be additive inside `v1`.
- Breaking public contract changes require a new version, such as `v2`.
- Original-language evidence is canonical.
- Display translations and summaries are helper fields only.
- Confidence and review state must remain separate.
- Tracker metadata can be reused with attribution; official source documents retain their original rights.
- The tracker is not legal advice, not academic integrity advice, and not an official university statement unless a linked official source says so.

## Public API Envelope

Most public JSON responses include:

| Field | Meaning |
| --- | --- |
| `apiVersion` | Public API version, currently `v1`. |
| `generatedAt` | ISO datetime when the response was generated. |
| `canonicalUrl` | Canonical public URL for the artifact or page. |
| `license` / `trackerMetadataLicense` | Tracker metadata license, currently `CC-BY-4.0`. |
| `sourcePolicy` / `sourceRightsPolicy` | Rights caveat for official source materials. |
| `limitations` | Boundary notices, including no legal or academic integrity advice. |
| `citation` | Citation metadata for this public artifact. |
| `data` | Versioned payload. |

Some endpoints also keep selected top-level fields for backward compatibility.

## Dataset Release Manifest

The latest release manifest is available at `/api/public/v1/datasets/latest.json`.

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Dataset release schema, currently `uapt-dataset-release-v1`. |
| `apiVersion` | Public API version, currently `v1`. |
| `releaseId` | Public release identifier from the curated release manifest. |
| `releasePeriod` | Release month in `YYYY-MM` format. |
| `publishedAt` | Release publication datetime. |
| `generatedAt` | Dataset artifact generation datetime. |
| `canonicalUrl` | Canonical dataset page URL. |
| `citation` | Citation metadata for the dataset release. |
| `counts` | Aggregate counts for universities, claims, sources, changes, evidence records, source languages, and review states. |
| `artifacts` | Downloadable artifact metadata with URL, filename, media type, byte length, row count, and SHA-256 checksum. |

## Dataset Release Artifacts

Bulk exports are available under `/api/public/v1/datasets/...`.

| Artifact | Meaning |
| --- | --- |
| `universities.jsonl` | One public university record per line. |
| `claims.jsonl` | One claim-level row per line, including original-language evidence arrays. |
| `sources.jsonl` | One official source attribution row per line. |
| `changes.jsonl` | One public source-check or freshness row per university. |
| `data-dictionary.md` | Markdown data dictionary for the release. |
| `checksums.txt` | SHA-256 checksums, byte sizes, row counts, filenames, and paths for the release artifacts. |

## Canonical Entity

| Field | Meaning |
| --- | --- |
| `type` | Entity type such as `university`, `tool`, `region`, `theme`, or `course`. |
| `slug` | Stable route and JSON identifier. |
| `name` | Public entity name. |
| `canonicalUrl` | Canonical page URL. |
| `aliases` | Known alternate names. |
| `summary` | Short reference summary. |

## Public University Record

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Public schema version, currently `v1`. |
| `citationTitle` | Human-readable citation title. |
| `canonicalUrl` | Canonical university page URL. |
| `publicPageUrl` | Public HTML page URL, when present. |
| `apiUrl` | Per-university public JSON URL. |
| `entitySlug` | University slug. |
| `entity` | Canonical entity object. |
| `summary` | Citation-ready public summary. |
| `lastCheckedAt` | Latest known source-check datetime. |
| `lastChangedAt` | Latest known source-change datetime. |
| `confidence` | Machine confidence aggregate. |
| `reviewState` | Workflow review state aggregate. |
| `officialSources` | Source attribution objects. |
| `claims` | Source-backed policy claims. |
| `suggestedCitation` | Suggested citation text. |

## Claim

| Field | Meaning |
| --- | --- |
| `id` | Stable claim identifier when available. |
| `entitySlug` | Entity the claim belongs to. |
| `entityType` | Entity type, usually `university` today. |
| `claimType` | Normalized category such as `ai_tool_treatment`, `academic_integrity`, `privacy`, `teaching`, `research`, `security_review`, `procurement`, `source_status`, or `other`. |
| `claimText` | Human-readable normalized claim text. |
| `claimValue` | Optional normalized value. |
| `confidence` | Machine confidence from `0` to `1`. |
| `reviewState` | Workflow state. |
| `lastCheckedAt` | Latest check datetime for the claim. |
| `lastChangedAt` | Latest changed datetime for the claim. |
| `evidence` | Evidence objects supporting the claim. |

## Review State

| State | Meaning |
| --- | --- |
| `machine_candidate` | Machine-extracted or generated candidate. |
| `agent_reviewed` | Reviewed by a review agent, but not necessarily human-approved. |
| `human_reviewed` | Approved by a human reviewer or deterministic publish rule. |
| `needs_review` | Ambiguous, weakly supported, stale, or blocked. |
| `rejected` | Rejected and should not be presented as a public claim. |

Review state is not confidence. A high-confidence candidate can still need review, and a lower-confidence claim can still be human reviewed with appropriate caveats.

## Evidence

| Field | Meaning |
| --- | --- |
| `sourceUrl` | Official or cited source URL. |
| `sourceLanguage` | Language of the original source evidence. Required for verified evidence. |
| `sourceSnapshotHash` | Hash for the source snapshot associated with the evidence. |
| `evidenceSnippet` | Original-language evidence snippet. Canonical for claim support. |
| `evidenceSnippetDisplay` | Optional translated or localized display snippet. Not canonical. |
| `snippetLocation` | Optional section, page, anchor, or other location hint. |
| `retrievedAt` | Retrieval datetime. |
| `attribution` | Source attribution object. |

## Source Attribution

| Field | Meaning |
| --- | --- |
| `sourceUrl` | Source URL. |
| `finalUrl` | Final URL after redirects, when tracked. |
| `citationTitle` | Title used for citation. |
| `publisher` | Publisher or university unit. |
| `retrievedAt` | Retrieval datetime. |
| `snapshotHash` | Hash for source snapshot. |
| `sourceType` | Type such as `official_policy_page`, `official_guidance`, `official_pdf`, `archived_official_source`, or `other`. |
| `official` | Whether the source is treated as official. |
| `sourceRights` | Rights caveat for source materials. |

## Change Record

HTML change pages under `/changes/{slug}` and the recent changes JSON expose freshness and review information.

| Field | Meaning |
| --- | --- |
| `entitySlug` | Entity slug. |
| `entityName` | Entity name. |
| `canonicalUrl` | Canonical university page URL. |
| `citationTitle` | Citation title. |
| `lastCheckedAt` | Latest check datetime. |
| `lastChangedAt` | Latest change datetime. |
| `reviewState` | Aggregate review state. |
| `claimCount` | Number of public claim records. |
| `claims` | Claim records when included. |

Current HTML diff previews are derived from public claim/evidence records. Full source old/new diffs require paired historical source snapshots.

## OpenClaw Staged Artifacts

OpenClaw should stage candidate artifacts, not canonical records. Required concepts include:

- `runId`
- source discovery trace
- verified source candidates
- fetch attempts and outcomes
- source URL and source language
- content or snapshot hash
- original-language evidence snippet
- confidence
- review state
- citation fields
- official source rights caveat

OpenClaw output must validate before review and must not directly write production data, publish canonical claims, push `main`, or deploy the public website.

## Contribution Metadata

Contribution metadata is available at
`/api/public/v1/contributions/index.json` and
`/api/public/v1/contributions/review-policy.json`.

| Field | Meaning |
| --- | --- |
| `status` | Current contribution surface status, currently `review-task-intake-alpha`. |
| `publicApiMutationAllowed` | Always `false` for the public v1 metadata endpoints. |
| `submissionChannel` | Initial intake channel, currently GitHub issue templates. |
| `submissionCreatesReviewTask` | Contributions create review tasks. |
| `submissionCreatesCanonicalFact` | Always `false`; submissions do not directly publish facts. |
| `workflows` | Contribution paths such as source URL submission, institution correction, course policy evidence, translation correction, and dataset issue reports. |
| `reviewQueues` | Review queue definitions and publication gates. |
| `privacyRules` | Privacy constraints for public and course-level submissions. |
| `copyrightRules` | Source rights and excerpt constraints. |
| `moderationRules` | Abuse, safety, and boundary rules. |
| `publicationRules` | Rules that must pass before a contribution can affect public claim/evidence records. |

Course-level submissions are future-facing evidence intake, not open comments.
They must preserve original-language evidence and remain pending until
moderation, rights review, and claim/evidence review pass.
