# Policy Analysis Contract

This contract defines how University AI Policy Tracker turns public
claim/evidence records into source-backed policy analysis profiles.

The analysis layer is not a legal interpretation, academic integrity advice, or
an official university statement. It is a structured summary of public tracker
metadata that must remain traceable to claim IDs, source URLs, source language,
and original evidence snippets.

## Contract Version

Current schema:

```text
uapt-policy-analysis-v1
```

Current public API version assumption:

```text
/api/public/v1/...
```

The first implementation is contract-only. It does not require production
database migrations, OpenClaw changes, or public analysis pages.

## Core Objects

### PolicyAnalysisProfile

One analysis profile belongs to one canonical entity, initially a university
and later a course.

Required concepts:

- `schemaVersion`
- `apiVersion`
- `entityType`
- `entitySlug`
- `entityName`
- `canonicalUrl`
- `publicJsonUrl`
- `generatedAt`
- `basedOnClaimIds`
- `basedOnSourceUrls`
- `sourceLanguages`
- `reviewState`
- `confidence`
- `coverageScore`
- `dimensions`
- `limitations`
- `suggestedCitation`

The `publicJsonUrl` must be versioned under `/api/public/v1/`.

### PolicyAnalysisDimension

Each dimension is one analysis conclusion about one entity.

Supported dimension keys:

- `policy_presence`
- `ai_disclosure`
- `coursework`
- `exams`
- `privacy_data_entry`
- `academic_integrity`
- `approved_tools`
- `named_ai_services`
- `teaching_guidance`
- `research_guidance`
- `security_procurement`

Supported statuses:

- `allowed`
- `conditionally_allowed`
- `restricted`
- `blocked`
- `required`
- `recommended`
- `not_mentioned`
- `unclear`
- `insufficient_public_evidence`

The `normalizedValue` field may carry dimension-specific labels such as
`university_wide_policy`, `course_or_assignment_dependent`, or
`sensitive_or_confidential_data_restricted`.

### AnalysisSourceBasis

The `basis` array preserves the evidence trail for a dimension:

- `claimId`
- `sourceUrl`
- `sourceLanguage`
- `evidenceSnippet`
- `sourceSnapshotHash`
- `reviewState`

Original-language evidence remains canonical. Display translation is not part
of the analysis basis unless it is explicitly modeled as helper display text in
a later version.

### PolicyCoverageScore

The score is named `Policy Coverage Score`.

It measures breadth of public, source-backed coverage. It is not a policy
quality score, strictness score, legal adequacy score, safety score, or
institutional compliance score.

The initial score has `maxScore = 100`. Component points must sum to `score`;
component `maxPoints` must sum to `maxScore`.

Initial rubric:

| Component | Max points |
| --- | ---: |
| Central AI policy or guidance source exists | 15 |
| Academic integrity guidance | 15 |
| AI disclosure guidance | 15 |
| Coursework guidance | 10 |
| Exam or assessment guidance | 10 |
| Privacy or data-entry guidance | 15 |
| Approved tools, procurement, or licensed tools | 10 |
| Teaching or research guidance | 10 |

## Evidence Rules

Statuses that require evidence:

- `allowed`
- `conditionally_allowed`
- `restricted`
- `blocked`
- `required`
- `recommended`
- `unclear`
- `insufficient_public_evidence`

For those statuses, `evidenceClaimIds` must contain at least one claim ID.

`not_mentioned` rules:

- must have no `evidenceClaimIds`
- must have no `evidenceSourceUrls`
- must have empty `basis`
- must include `notMentionedReason`

`not_mentioned` means no source-backed public claim is present in the current
tracker profile. It does not mean the policy does not exist, and it does not
mean the activity is allowed or prohibited.

## Review State Rules

Analysis review state remains separate from confidence.

Supported review states:

- `machine_candidate`
- `agent_reviewed`
- `human_reviewed`
- `institution_verified`
- `needs_review`
- `rejected`

Automation may create candidate or agent-reviewed analysis, but it must not mark
its own output as `human_reviewed` or `institution_verified`.

## Multilingual Rules

Analysis profiles must preserve source language.

Requirements:

- profile-level `sourceLanguages`
- dimension-level `sourceLanguages`
- basis-level `sourceLanguage`
- original-language `evidenceSnippet`

Translated summaries may be added later as helper display fields, but they must
not replace original evidence.

## SEO And GEO Rules

Analysis data should support future crawlable pages, but the contract itself
does not create public analysis pages.

Future analysis pages must:

- render important analysis content in HTML
- show review state next to analysis conclusions
- link to canonical university pages and public JSON
- expose source URLs and evidence counts
- include citation-ready summaries
- avoid thin programmatic pages
- keep structured data aligned with visible text
- use sitemap inclusion only after quality gates are met

`llms.txt` can reference analysis surfaces as an auxiliary guide after public
analysis endpoints exist. It must not be described as a guaranteed ranking
signal.

## Validation

Run:

```bash
pnpm validate:analysis-contract
```

The validator currently checks:

- example profile parses against `policyAnalysisProfileSchema`
- every supported dimension key appears in the example
- public JSON URL is versioned under `/api/public/v1/analysis/...`
- no-advice limitation is present
- evidence-backed statuses have claim IDs
- `not_mentioned` dimensions have no evidence and include a reason
- coverage score components sum to the declared score

The example file is:

```text
examples/policy-analysis-profile.json
```

## Next Implementation Stage

P9-B should derive static analysis profiles from existing public release data.
It should not use LLM classification as the first source of truth.

Expected future files:

```text
apps/web/lib/policy-analysis.ts
apps/web/app/api/public/v1/analysis/index.json/route.ts
apps/web/app/api/public/v1/analysis/universities/[slug]/route.ts
apps/web/app/api/public/v1/analysis/coverage-scores.json/route.ts
```

P9-B must continue to avoid production database writes and must not connect
OpenClaw directly.
