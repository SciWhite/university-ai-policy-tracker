# Policy Analysis Layer Development Plan

This document defines the next product and engineering layer for University AI
Policy Tracker: turning source-backed claim/evidence records into comparable,
citable, SEO/GEO-ready policy analysis surfaces.

The goal is not to create opinionated rankings or generic SEO pages. The goal is
to publish structured policy analysis that remains traceable to original source
evidence, visible in server-rendered HTML, available as versioned public JSON,
and reusable by researchers, journalists, students, developers, and AI answer
engines.

## 1. Current Baseline

As of the current public release `public-release-20260510-001`, the project has:

- 36 public university records
- 430 public policy claims
- 439 evidence records
- 222 official source attributions
- 36 freshness/change records
- 5 source languages in public evidence: `en`, `fr`, `ja`, `ko`, `zh`
- public pages under `/universities`, `/changes`, `/datasets`, `/reports`,
  `/widgets`, `/api-reference`, `/mcp`, `/contribute`, and `/review`
- versioned public JSON under `/api/public/v1/...`
- bulk JSONL dataset release artifacts
- RSS/Atom feeds
- `sitemap.xml`, `robots.txt`, and `llms.txt`
- GitHub issue-template contribution intake that creates review tasks rather
  than canonical facts

The current site already does claim/evidence extraction. The missing product
layer is normalized policy analysis:

- What is the institution's disclosure posture?
- Does the public record mention exams?
- Does it restrict data entry into AI tools?
- Does it name ChatGPT, Copilot, DeepSeek, or approved institutional tools?
- How complete is the public policy coverage?
- Which universities have similar or different policy treatment?
- Which trends can be cited at theme, region, and dataset levels?

## 2. Product Positioning

Policy Analysis Layer positioning:

> Source-backed comparative analysis of university AI policy claims.

Public messaging should avoid saying:

- "This university allows AI."
- "This course permits ChatGPT."
- "This is the best or worst policy."
- "This is legal or academic integrity advice."

Preferred wording:

- "The public record contains source-backed claims indicating..."
- "No source-backed public claim was found for this dimension."
- "This dimension is not mentioned in the reviewed public record."
- "Coverage score measures public policy coverage, not policy quality."
- "Original-language evidence remains canonical."

## 3. Non-Negotiable Data Principles

The analysis layer must inherit the existing evidence contract.

Every analysis conclusion must either:

- cite one or more public claim IDs and evidence records, or
- explicitly say `not_mentioned` / `insufficient_public_evidence`.

Analysis must not:

- infer private institutional practice from silence
- treat `not_mentioned` as `allowed` or `prohibited`
- combine confidence and review state
- replace source-language evidence with translation
- publish student/course submissions without moderation
- provide legal advice or academic integrity advice
- create thin programmatic SEO pages without evidence-backed content

## 4. SEO And GEO Requirements

Google's AI features guidance states that normal SEO fundamentals remain
relevant for AI features and that there are no special technical requirements
or special AI markup required for AI Overviews or AI Mode. The implication for
this project is direct: make analysis pages crawlable, useful, source-backed,
internally linked, and visible in HTML. Do not rely on hidden JSON alone.

Google also states that important content should be available in textual form
and that structured data should match visible page content. This project must
therefore keep every analysis dimension visible on the page when it appears in
JSON-LD or public JSON.

Sitemaps help search engines understand important URLs and update metadata, but
they do not guarantee indexing. Analysis URLs should be included in the sitemap
only when they meet the evidence and quality thresholds defined below.

Dataset structured data should be used where appropriate on dataset and
analysis release pages. Required and recommended dataset metadata should map to
visible page content: name, description, creator, license, distribution,
identifier, keywords, and citation-oriented fields.

### 4.1 GEO Definition For This Project

GEO means making pages and JSON easy for AI answer engines and research agents
to cite accurately.

GEO requirements:

- citation-ready summary visible near the top of each analysis page
- original source URLs visible on page
- public JSON URL visible on page
- review state visible next to analysis conclusions
- confidence visible where relevant, but secondary to review state
- source-language evidence preserved
- no hidden-only analysis claims
- stable canonical URLs
- stable fragment IDs for dimensions such as `#disclosure`, `#exams`,
  `#privacy`, and `#approved-tools`
- `llms.txt` updated as an auxiliary guide, not described as a ranking signal
- public API endpoints listed in `/api/public/v1/index.json`
- dataset releases and analysis artifacts included in `/datasets`

### 4.2 SEO Quality Gate

An analysis page is indexable only if it has:

- at least 8 institutions with relevant source-backed data, or
- at least 1 high-quality university profile page with 4 or more meaningful
  analysis dimensions, or
- a report-style narrative backed by public JSON and visible citations.

Noindex or do not generate:

- theme pages with fewer than 5 meaningful records
- comparison pages where both universities have fewer than 3 comparable
  dimensions
- pages where analysis is mostly `not_mentioned`
- pages with only tables and no explanatory summary
- pages where JSON-LD adds facts not visible in HTML

## 5. Analysis Data Model

Add a shared analysis contract without changing the production database first.
The first implementation should be static/public-data derived.

Suggested file:

```text
packages/shared/src/analysis.ts
```

### 5.1 Core Types

```ts
type AnalysisReviewState =
  | "machine_candidate"
  | "agent_reviewed"
  | "human_reviewed"
  | "institution_verified"
  | "needs_review"
  | "rejected";

type AnalysisDimensionStatus =
  | "allowed"
  | "conditionally_allowed"
  | "restricted"
  | "blocked"
  | "required"
  | "recommended"
  | "not_mentioned"
  | "unclear"
  | "insufficient_public_evidence";

type PolicyAnalysisDimensionKey =
  | "policy_presence"
  | "ai_disclosure"
  | "coursework"
  | "exams"
  | "privacy_data_entry"
  | "academic_integrity"
  | "approved_tools"
  | "named_ai_services"
  | "teaching_guidance"
  | "research_guidance"
  | "security_procurement";
```

### 5.2 PolicyAnalysisProfile

```ts
interface PolicyAnalysisProfile {
  schemaVersion: "uapt-policy-analysis-v1";
  apiVersion: "v1";
  entityType: "university" | "course";
  entitySlug: string;
  entityName: string;
  canonicalUrl: string;
  publicJsonUrl: string;
  generatedAt: string;
  basedOnClaimIds: string[];
  basedOnSourceUrls: string[];
  sourceLanguages: string[];
  reviewState: AnalysisReviewState;
  confidence: number;
  coverageScore: PolicyCoverageScore;
  dimensions: PolicyAnalysisDimension[];
  limitations: string[];
  suggestedCitation: string;
}
```

### 5.3 PolicyAnalysisDimension

```ts
interface PolicyAnalysisDimension {
  key: PolicyAnalysisDimensionKey;
  label: string;
  status: AnalysisDimensionStatus;
  summary: string;
  explanation: string;
  evidenceClaimIds: string[];
  evidenceSourceUrls: string[];
  sourceLanguages: string[];
  reviewState: AnalysisReviewState;
  confidence: number;
  evidenceCount: number;
  sourceCount: number;
  notMentionedReason?: string;
}
```

Rules:

- `allowed`, `conditionally_allowed`, `restricted`, `blocked`, `required`, and
  `recommended` require at least one evidence claim ID.
- `not_mentioned` requires zero evidence claim IDs and a clear
  `notMentionedReason`.
- `unclear` requires evidence claim IDs and a reason the evidence does not
  support a stronger classification.
- `insufficient_public_evidence` is used when a source exists but does not
  support a reliable conclusion.

### 5.4 PolicyCoverageScore

Use `Policy Coverage Score`, not `Policy Quality Score`.

```ts
interface PolicyCoverageScore {
  score: number; // 0-100
  label:
    | "minimal_public_coverage"
    | "partial_public_coverage"
    | "moderate_public_coverage"
    | "broad_public_coverage";
  components: PolicyCoverageScoreComponent[];
  reviewState: AnalysisReviewState;
  limitations: string[];
}
```

Initial scoring rubric:

| Component | Points |
| --- | ---: |
| university-wide or central AI policy source exists | 15 |
| academic integrity guidance | 15 |
| AI disclosure guidance | 15 |
| coursework guidance | 10 |
| exam or assessment guidance | 10 |
| privacy or data-entry guidance | 15 |
| approved tools, procurement, or licensed tools | 10 |
| teaching or research guidance | 10 |

Required visible caveat:

> Policy Coverage Score measures the breadth of public, source-backed policy
> coverage in the tracker. It is not a judgment of policy quality, strictness,
> legality, fairness, or institutional compliance.

## 6. First Analysis Dimensions

### 6.1 `policy_presence`

Question:

- Does the public record contain a central university AI policy or official
  institutional guidance?

Statuses:

- `required` is not used.
- Use `allowed` only when the dimension is not about permission; avoid it here.
- Use:
  - `conditionally_allowed`: not applicable.
  - `not_mentioned`: no public source-backed policy found.
  - `insufficient_public_evidence`: source exists but is too generic.
  - `unclear`: source mentions AI but policy scope is ambiguous.

Preferred normalized values:

- `university_wide_policy`
- `unit_policy_or_guidance`
- `external_policy_or_guidance`
- `no_policy_found`
- `inaccessible`

### 6.2 `ai_disclosure`

Question:

- Does public guidance require, recommend, or conditionally mention disclosure of
  AI use?

Examples:

- `required`: source-backed claim says students must disclose AI use.
- `recommended`: source-backed claim says students should disclose or cite AI
  use.
- `conditionally_allowed`: disclosure depends on course or assignment.
- `not_mentioned`: no source-backed disclosure claim.
- `unclear`: source mentions transparency but not student disclosure.

### 6.3 `coursework`

Question:

- Does the public record discuss AI use in assignments, coursework, projects,
  writing, coding, or homework?

Statuses:

- `allowed`
- `conditionally_allowed`
- `restricted`
- `blocked`
- `not_mentioned`
- `unclear`

Guardrail:

- Do not summarize this as advice to students. Say what the public source says.

### 6.4 `exams`

Question:

- Does the public record mention AI use in exams, tests, proctored assessments,
  quizzes, or closed-book settings?

Common outcomes:

- `restricted` or `blocked` when explicitly supported.
- `not_mentioned` when no claim exists.

Guardrail:

- Do not infer exam policy from coursework policy.

### 6.5 `privacy_data_entry`

Question:

- Does public guidance restrict entering personal, confidential, student,
  research, institutional, or regulated data into AI services?

This dimension is high-value for GEO because it answers concrete policy queries
about privacy and data entry.

### 6.6 `academic_integrity`

Question:

- Does AI guidance appear under academic integrity, misconduct, plagiarism,
  cheating, citation, or assessment rules?

Guardrail:

- Do not tell users what counts as misconduct. Report only source-backed policy
  claims.

### 6.7 `approved_tools`

Question:

- Does the institution name approved, licensed, procured, or supported AI tools?

Examples:

- Microsoft Copilot
- ChatGPT Enterprise/Edu
- institution-hosted chatbot
- approved AI service list

### 6.8 `named_ai_services`

Question:

- Does the public record name specific AI services such as ChatGPT, DeepSeek,
  Copilot, Gemini, Claude, Grammarly, Turnitin AI, or institutional tools?

This powers future tool pages:

```text
/tools/chatgpt
/tools/copilot
/tools/deepseek
```

### 6.9 `teaching_guidance`

Question:

- Does public guidance help instructors design courses, syllabi, assignments,
  disclosure policies, or classroom AI rules?

### 6.10 `research_guidance`

Question:

- Does public guidance address research use, research data, grant writing,
  publication ethics, human subjects, or research compliance?

### 6.11 `security_procurement`

Question:

- Does public guidance mention security review, procurement, vendor approval,
  risk assessment, authentication, SSO, or enterprise licensing?

## 7. Derivation Strategy

The first version should derive analysis from existing public claims, not from
raw crawler output.

Input:

```text
data/public-releases/current.json
/api/public/v1/datasets/claims.jsonl
/api/public/v1/datasets/sources.jsonl
```

Derivation order:

1. Read public university summaries.
2. Normalize claim text and claim type.
3. Map claims to dimensions using deterministic rules first.
4. Use heuristic keyword matching only as a candidate signal.
5. Require source-backed evidence for non-empty statuses.
6. Aggregate review state from supporting claims.
7. Compute confidence from supporting claims.
8. Compute coverage score from completed dimensions.
9. Emit analysis profile.
10. Validate analysis profile.

Do not use LLM classification as the first source of truth. LLMs may propose
analysis candidates later, but repo-side validation must enforce the contract.

## 8. Public API Plan

Add versioned endpoints only under `/api/public/v1/...`.

Initial endpoints:

```text
/api/public/v1/analysis/index.json
/api/public/v1/analysis/universities/{slug}.json
/api/public/v1/analysis/coverage-scores.json
/api/public/v1/analysis/themes/{theme}.json
```

Later endpoints:

```text
/api/public/v1/analysis/comparisons/{slugA}-vs-{slugB}.json
/api/public/v1/analysis/regions/{region}.json
/api/public/v1/analysis/tools/{tool}.json
```

Every endpoint must use the existing v1 envelope:

```ts
{
  apiVersion,
  generatedAt,
  canonicalUrl,
  license,
  trackerMetadataLicense,
  sourceRightsPolicy,
  limitations,
  citation,
  data
}
```

Every analysis payload must include:

- `basedOnClaimIds`
- `basedOnSourceUrls`
- `sourceLanguages`
- `reviewState`
- `confidence`
- `limitations`
- canonical HTML URL
- public JSON URL

## 9. Public Page Plan

### 9.1 Analysis Index

Route:

```text
/analysis
```

Purpose:

- explain analysis methodology
- show current coverage distribution
- link to theme pages, coverage score page, API JSON, and dataset release
- show caveats

Required visible sections:

- What this analysis means
- What it does not mean
- Analysis dimensions
- Coverage score definition
- Current release summary
- Public JSON endpoints
- Citation format

### 9.2 Theme Analysis Pages

Routes:

```text
/analysis/disclosure
/analysis/exams
/analysis/coursework
/analysis/privacy
/analysis/approved-tools
/analysis/academic-integrity
```

Each page must include:

- citation-ready answer summary
- count of institutions in each status bucket
- table of universities with status, review state, evidence count, source count
- visible caveat for `not_mentioned`
- links to university record, analysis JSON, and source evidence
- JSON-LD only when it matches visible content

Do not create a theme page until it has enough meaningful data to avoid thin
content.

### 9.3 University Policy Profile Section

Add to each university page:

```text
Policy Profile
- Policy presence
- Disclosure
- Coursework
- Exams
- Privacy/data entry
- Academic integrity
- Approved tools
- Named AI services
- Teaching guidance
- Research guidance
- Security/procurement
```

Each row must show:

- dimension status
- short source-backed summary
- review state
- confidence
- evidence count
- source count
- link to supporting claims

### 9.4 Coverage Score Page

Route:

```text
/analysis/policy-coverage
```

Purpose:

- explain the score
- show sorted university table
- emphasize this is coverage, not quality
- link each score component to evidence-backed dimensions

Do not use language like:

- "best AI policy"
- "worst AI policy"
- "most compliant"
- "legally safe"

### 9.5 Comparison Pages

Initial route:

```text
/compare
```

Later static pairs only when there is enough evidence:

```text
/compare/harvard-university-vs-massachusetts-institute-of-technology
```

Comparison page rules:

- compare only dimensions supported in both records
- label missing dimensions as `not_mentioned` or `insufficient_public_evidence`
- no automatic indexable page for arbitrary pairs
- no pair page unless at least 3 comparable dimensions exist
- every row links back to source-backed evidence

## 10. Structured Data Plan

Use structured data selectively.

### 10.1 Dataset Pages

Use:

- `Dataset`
- `DataCatalog`
- `DataDownload`

Appropriate for:

- `/datasets`
- `/analysis`
- `/analysis/policy-coverage`
- monthly analysis reports

Dataset JSON-LD should include:

- `name`
- `description`
- `url`
- `license`
- `creator`
- `includedInDataCatalog`
- `distribution`
- `keywords`
- `identifier` when release IDs are available

### 10.2 University Analysis Pages

Use:

- `WebPage`
- `Dataset` only if the page exposes a downloadable analysis artifact
- `BreadcrumbList`

Avoid:

- fake `FAQPage` blocks unless visible Q/A content exists
- unsupported `ClaimReview` unless the project is doing fact-check markup
- review/rating schema that implies subjective ratings

### 10.3 Reports

Use:

- `Article`
- `Dataset` distribution links where chart data or JSON exists

Structured data must be generated from the same data as visible HTML.

## 11. Sitemap, Robots, Canonical, And Internal Links

### 11.1 Sitemap

Add analysis URLs to `apps/web/app/sitemap.ts` only after they meet the quality
gate.

Include:

- `/analysis`
- `/analysis/policy-coverage`
- theme pages that meet thresholds
- selected comparison pages that meet thresholds

Use last modified dates based on:

- latest source `lastCheckedAt`
- latest source `lastChangedAt`
- analysis release generation time

### 11.2 Robots

Current public policy should remain:

- allow public reference pages
- allow public JSON
- avoid blocking CSS/JS needed for rendering

Noindex should be considered for:

- thin analysis pages
- internal preview pages
- arbitrary comparison pages
- candidate-only pages that do not meet evidence thresholds

### 11.3 Canonicals

Every analysis page must define:

- canonical HTML URL
- public JSON URL
- stable API version

Avoid duplicate pages such as:

- `/analysis/disclosure`
- `/themes/ai-disclosure`

If both exist, one must be the canonical analysis page and the other should link
to it as a reference/theme page.

### 11.4 Internal Links

Required links:

- home -> `/analysis`
- university page -> policy profile -> analysis JSON
- `/analysis` -> `/datasets`, `/api-reference`, `/citation`, `/methodology`
- theme page -> relevant university pages
- university page -> relevant theme analysis pages
- report pages -> analysis pages and chart data
- `llms.txt` -> analysis index and analysis API

## 12. GEO Answer Summary Contract

Each analysis page should include a short "Citation-ready summary" block.

Template:

```text
Citation-ready summary

As of {releaseDate}, University AI Policy Tracker classifies {dimension}
for {institutionCount} public university records using source-backed claims
from official or clearly attributed sources. Original-language evidence remains
canonical. Records are labeled with review state and confidence. This analysis
is not legal advice, academic integrity advice, or an official university
statement.
```

University profile summary:

```text
As of {lastCheckedAt}, {University} has source-backed public analysis for
{dimensionCount} AI policy dimensions. The record is based on {claimCount}
claims from {sourceCount} source attributions. Review state: {reviewState}.
```

This block helps AI answer engines quote the page without losing context.

## 13. OpenClaw Role

OpenClaw can assist, but must not publish canonical analysis.

Allowed:

- propose dimension candidates
- classify claim text into analysis dimensions
- identify source gaps
- draft report observations
- generate PRs with analysis candidate artifacts
- flag weak evidence or conflicting claims

Not allowed:

- write production DB
- push `main`
- mark its own output as `human_reviewed`
- publish canonical analysis without repo validation
- bypass robots, login walls, paywalls, or source-site restrictions
- turn course submissions into public facts without moderation

Future agent role:

```text
policy-analysis-classifier
```

Expected output:

```text
analysis_candidate.json
analysis_dimension_candidate.json
analysis_gap_report.json
```

Review state:

- initial: `machine_candidate`
- after reviewer agent: `agent_reviewed`
- after human review: `human_reviewed`
- after institutional correction: possible `institution_verified`

## 14. Validation Plan

Add validators before adding public pages at scale.

Suggested scripts:

```text
scripts/validate-analysis-contract.ts
scripts/audit-policy-analysis.ts
scripts/smoke-analysis-pages.ts
```

Validation rules:

- every non-empty dimension has evidence claim IDs
- every evidence claim ID exists in public release data
- every source URL exists in public claim evidence
- no `not_mentioned` dimension has evidence claim IDs
- no `allowed`/`restricted`/`required` dimension lacks evidence
- source languages are preserved
- review state exists
- confidence is between 0 and 1
- coverage score components sum to score
- no public JSON path is unversioned
- structured data content matches visible content
- pages do not generate horizontal overflow on mobile
- no candidate-only page is indexable

Add to `pnpm check` after stable:

```text
pnpm validate:analysis-contract
pnpm audit:policy-analysis
pnpm smoke:analysis-pages
```

## 15. Implementation Roadmap

### P9-A: Analysis Contract

Scope:

- shared schema
- examples
- documentation
- validator
- no production DB changes
- no new OpenClaw connection

Files:

```text
packages/shared/src/analysis.ts
examples/policy-analysis-profile.json
docs/policy-analysis-contract.md
scripts/validate-analysis-contract.ts
```

Acceptance criteria:

- schema expresses university and future course analysis profiles
- every dimension can bind to claim IDs and source URLs
- `not_mentioned` and `insufficient_public_evidence` are distinct
- confidence and review state remain separate
- original-language evidence remains canonical
- validator passes on examples

### P9-B: Static Analysis Builder

Scope:

- derive analysis from existing public release data
- no LLM dependency
- no production DB changes
- deterministic outputs remain `machine_candidate` until separately reviewed

Files:

```text
apps/web/lib/policy-analysis.ts
apps/web/app/api/public/v1/analysis/index.json/route.ts
apps/web/app/api/public/v1/analysis/universities/[slug]/route.ts
apps/web/app/api/public/v1/analysis/coverage-scores.json/route.ts
scripts/audit-policy-analysis.ts
```

Acceptance criteria:

- all 36 public universities receive analysis profiles
- all non-empty statuses trace to public claim IDs
- coverage score has visible caveat
- API index includes analysis endpoints
- dataset page links analysis metadata
- `pnpm audit:policy-analysis` validates profile count, claim/source binding,
  review-state boundary, and versioned analysis URLs

### P9-C: Analysis Pages

Scope:

- public analysis index
- first theme pages
- university policy profile section
- coverage score page
- sitemap, navigation, and llms.txt links for quality-gated analysis pages

Routes:

```text
/analysis
/analysis/policy-coverage
/analysis/disclosure
/analysis/privacy
/analysis/approved-tools
```

Acceptance criteria:

- pages are SSR/SSG friendly
- important content appears in HTML
- each analysis conclusion shows review state and evidence/source counts
- pages have canonical metadata
- sitemap includes only pages passing quality gate
- no thin page generation
- mobile and desktop smoke tests pass
- university detail pages include a source-backed policy profile section with
  links to supporting claim anchors

### P9-D: Reports And Comparison

Scope:

- analysis page-quality gates
- analysis review workflow
- read-only page-quality JSON
- page smoke validation for analysis surfaces
- no new OpenClaw connection or production database writes

Routes:

```text
/analysis
/analysis/policy-coverage
/analysis/{theme}
/review#analysis-review
/api/public/v1/analysis/page-quality.json
```

Acceptance criteria:

- page-quality gates are visible on public analysis pages
- analysis review workflow has a stable anchor and public metadata
- page-quality JSON is versioned under `/api/public/v1/...`
- review state remains separate from page publication readiness
- coverage-score copy continues to reject quality, strictness, compliance,
  legal adequacy, safety, or ranking language
- `pnpm smoke:analysis-pages` verifies analysis page readiness rules

### P9-E: Reports And Comparison

Scope:

- analysis report page
- selected comparison page templates
- chart data JSON

Routes:

```text
/reports/monthly/2026-05/policy-analysis
/compare
/compare/{slugA}-vs-{slugB}
```

Acceptance criteria:

- comparison pages are limited and evidence-rich
- report chart data is available under `/api/public/v1/...`
- report includes citation-ready methodology
- no quality/ranking language that overclaims

### P9-F: OpenClaw Analysis Candidates

Scope:

- update OpenClaw task prompts after repo-side contract exists
- add staged analysis candidate validation

Acceptance criteria:

- OpenClaw produces candidate artifacts only
- candidates cannot publish canonical analysis
- validators reject dimensions without evidence
- policy-manager routes output through PR/review workflow

### P10: Course-Level Analysis

Do not start until:

- course submission moderation exists
- syllabus rights policy is stable
- privacy rules are enforced
- course entities reuse claim/evidence
- contribution review queue is operating

Initial course dimensions:

- AI allowed status
- disclosure rule
- coding/homework policy
- exam/assessment rule
- source type
- term
- review state
- student report count
- clarity score, later

## 16. Measurement Plan

Track:

- indexed analysis pages
- impressions and clicks by query group
- queries that mention "AI disclosure", "ChatGPT policy", "AI exams",
  "approved AI tools", and university names
- AI answer engine referrals when available
- dataset downloads
- public JSON requests
- widget usage
- GitHub issues created from contribution paths
- external citations/backlinks to `/analysis`, `/datasets`, `/citation`, and
  monthly reports

Search Console interpretation:

- separate finalized data from fresh partial data
- inspect page/query buckets, not only site-wide averages
- distinguish unknown-to-Google, crawled-not-indexed, canonical-shadow, and 404
  cases

## 17. Risk Register

| Risk | Mitigation |
| --- | --- |
| Overstating policy conclusions | Require evidence claim IDs and visible caveats. |
| Thin programmatic pages | Enforce quality gate before sitemap inclusion. |
| Silent source-language loss | Preserve source language in analysis payloads. |
| Score interpreted as policy quality | Name it Policy Coverage Score and repeat caveat. |
| Candidate data treated as final | Show review state next to every dimension. |
| UGC abuse | Keep course/user submissions in review queues. |
| Structured data mismatch | Generate JSON-LD from visible page data only. |
| Duplicate route families | Define canonical URLs before page generation. |
| OpenClaw overreach | Keep OpenClaw candidate-only; repo validators decide. |

## 18. Recommended Next Task

Start with P9-A only.

Suggested Codex prompt:

```text
Work in /Users/newvolume/Documents/university-ai-policy-tracker.

Task: implement P9-A Policy Analysis Contract only.

Do not connect OpenClaw, SSH, deploy, touch production DB, or modify staging
artifacts. Do not create public analysis pages yet.

Read docs/policy-analysis-layer-development-plan.md, docs/data-contract.md,
packages/shared/src/claims.ts, and packages/shared/src/public-examples.ts.

Implement:
- packages/shared/src/analysis.ts
- docs/policy-analysis-contract.md
- examples/policy-analysis-profile.json
- scripts/validate-analysis-contract.ts
- package.json script validate:analysis-contract

The contract must preserve:
- claim/evidence binding
- source-language evidence as canonical
- confidence separate from reviewState
- not_mentioned distinct from insufficient_public_evidence
- no legal advice and no academic integrity advice
- versioned public API assumptions under /api/public/v1/...

Run:
- pnpm validate:analysis-contract
- pnpm check
- pnpm --filter @uapt/web build
- git diff --check

Commit locally with: Add policy analysis contract.
Do not push unless explicitly instructed.
```

## 19. Reference Notes

- Google Search Central, AI Features and Your Website:
  https://developers.google.com/search/docs/appearance/ai-features
- Google Search Central, SEO Starter Guide:
  https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google Search Central, Dataset Structured Data:
  https://developers.google.com/search/docs/appearance/structured-data/dataset
- Google Search Central, Sitemaps:
  https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
