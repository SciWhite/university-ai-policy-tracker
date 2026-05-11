# Exposure And Distribution Architecture

This document is the long-term product, data, and distribution roadmap for University AI Policy Tracker. It is intentionally a development document only: it does not implement code, migrations, deployment, or OpenClaw configuration.

Canonical public domain: `https://eduaipolicy.org`. The domain has been purchased and added to Cloudflare; production deployment should use this as the stable canonical site origin.

## 1. Positioning

The project should not be positioned as another AI policy blog or link directory.

Preferred positioning:

```text
The open, evidence-backed database of university and course AI policies.
```

Supporting positioning:

```text
A public, citation-first tracker for university and course AI policies.
```

The core value is not that the site has many pages. The value is that every public conclusion can be traced back to:

- a canonical entity,
- an official or clearly labeled source,
- a source snapshot,
- a source hash,
- a short evidence snippet in the original source language,
- a confidence score,
- a review state,
- a change history,
- a public JSON record,
- a citation policy.

This makes the project useful to search users, AI answer engines, researchers, journalists, higher-education staff, students, developers, and agents.

## 2. Strategic Principle

Build the project as public infrastructure:

```text
Evidence Layer -> Reference Layer -> Distribution Layer -> Contribution & Review Layer
```

Each layer has a different job. Do not mix them.

- The Evidence Layer decides what is true enough to store.
- The Reference Layer makes facts understandable and indexable.
- The Distribution Layer makes facts reusable and citable.
- The Contribution & Review Layer lets humans and agents expand coverage without corrupting canonical records.

## 3. Layer 1: Evidence Layer

The Evidence Layer is the durable trust base. It should be source-first, claim-level, versioned, and reviewable.

### 3.1 Core Objects

The system should converge on these core objects:

- `canonical_entities`
- `policy_sources`
- `source_snapshots`
- `source_attributions`
- `policy_claims`
- `claim_evidence`
- `review_decisions`
- `crawl_runs`
- `policy_versions`

Existing objects such as `universities`, `policy_sources`, `source_snapshots`, `crawl_runs`, `extraction_candidates`, `policy_versions`, and `review_decisions` should be preserved for compatibility. New claim/evidence objects should be additive and should gradually become the public contract.

### 3.2 Canonical Entities

`canonical_entities` are stable public subjects that can receive claims.

Entity types should support:

- university
- AI tool
- region
- theme
- source document
- course, future
- professor, future and optional
- institution office or unit, future

Canonical entity fields should support:

- stable ID
- entity type
- canonical slug
- canonical path
- display name
- alternate names
- country
- region
- language defaults
- source language defaults
- indexability state
- citation title
- citation description
- last checked date
- last changed date
- review state summary

### 3.3 Policy Claims

A policy claim is one citation-ready assertion.

Examples:

- "MIT prohibits generative AI use with High Risk MIT information."
- "Harvard guidance treats student AI use as course- or assignment-dependent."
- "This source names Microsoft Copilot as an institutionally licensed or procured AI service."
- "The source does not name any specific AI service."

Each claim should include:

- `claimId`
- `entityId`
- `claimType`
- `claimText`
- `normalizedValue`
- `toolSlug`, optional
- `themeSlugs`
- `audiences`
- `academicContexts`
- `dataSensitivities`
- `jurisdiction`
- `sourceLanguage`
- `confidence`
- `reviewState`
- `createdFromExtractionId`, optional
- `supersedesClaimId`, optional
- `validFrom`, optional
- `validUntil`, optional

### 3.4 Confidence Is Not Review State

Do not collapse `confidence` and `reviewState`.

`confidence` means:

```text
How strongly the machine or agent believes the source supports the extracted claim.
```

`reviewState` means:

```text
Where the claim sits in the review workflow.
```

Examples:

```json
{
  "confidence": 0.94,
  "reviewState": "machine_candidate"
}
```

```json
{
  "confidence": 0.72,
  "reviewState": "human_reviewed"
}
```

Public pages may display both, but trust language should emphasize `reviewState` more than `confidence`.

### 3.5 Claim Evidence

Every public claim must have evidence.

Evidence should include:

- `claimId`
- `sourceSnapshotId`
- `policySourceId`
- `sourceUrl`
- `finalUrl`
- `sourceTitle`
- `sourceLanguage`
- `snapshotHash`
- `evidenceTextOriginal`
- `evidenceTextDisplay`, optional localized summary or translation
- `evidenceLocator`, such as section, heading, paragraph, or offset
- `evidenceType`
- `relevance`
- `rightsNote`

Evidence snippets must be short and necessary. Do not store large copied sections of official pages in tracker metadata.

### 3.6 Source-First Multilingual Evidence

Multilingual support is a data-model requirement, not a display afterthought.

Rules:

- Preserve original source language evidence.
- Original evidence is canonical.
- Translation is auxiliary display.
- A translated summary must never replace original source evidence.
- A localized page must link back to the original evidence and source URL.
- Translation confidence and translation review state should be tracked separately from claim confidence and claim review state.

Required multilingual fields should include:

- `sourceLanguage`
- `originalTitle`
- `localizedTitle`
- `normalizedTextLanguage`
- `evidenceTextOriginal`
- `evidenceTextDisplay`
- `translationStatus`
- `translationReviewState`
- `localizedSummaries`
- `localizedMetaTitle`
- `localizedMetaDescription`

### 3.7 Canonical Facts Versus Localized Display

Canonical facts are language-neutral and evidence-bound.

Examples:

- entity ID
- source URL
- source hash
- source language
- document status
- service treatment
- AI service status
- review state
- confidence
- claim type
- evidence locator
- dates

Localized display is language-specific presentation.

Examples:

- Chinese summary
- French page title
- localized taxonomy labels
- localized citation text
- translated evidence helper text
- localized FAQ copy
- localized outreach copy

Do not let localized display mutate canonical facts.

## 4. Layer 2: Reference Layer

The Reference Layer is the public website. It must serve humans, search crawlers, AI answer engines, and citation workflows.

### 4.1 Core Trust Routes

These routes are core trust assets and should be treated as first-class product surfaces:

- `/methodology`
- `/citation`
- `/datasets`
- `/changes`

They should be linked from the footer, homepage, university pages, API docs, and GitHub README.

### 4.2 Entity Pages

Initial page types:

- university pages
- AI tool pages
- region pages
- theme pages
- source document pages
- change log pages
- monthly report pages
- comparison pages

University page examples:

- `/universities/harvard-university-ai-policy`
- `/universities/mit-ai-policy`
- `/universities/university-of-toronto-ai-policy`

Each high-quality university page should include:

- short answer
- citation-ready summary
- policy status
- official sources
- evidence-backed claims
- AI service treatment table
- disclosure rules, if known
- coursework rules, if known
- exam rules, if known
- research rules, if known
- data/privacy restrictions
- last checked
- last changed
- review state
- confidence
- version history
- public JSON link
- suggested citation
- limitations and coverage notes

### 4.3 Programmatic SEO Without Thin Pages

Do not generate thousands of low-evidence pages.

Pages should be indexable only when they have enough source-backed value:

- at least one official or clearly labeled source,
- at least one claim/evidence pair, or
- a useful no-policy/inaccessible finding with search evidence and review state.

Thin pages should remain `noindex` until coverage is useful.

### 4.4 Topic And Comparison Pages

Topic pages should answer high-intent questions:

- `/themes/ai-disclosure-policy`
- `/themes/ai-in-exams`
- `/themes/chatgpt-coursework-policy`
- `/themes/ai-detectors-in-universities`
- `/themes/approved-ai-tools`

Comparison pages should be generated only when both sides have enough evidence:

- `/compare/harvard-vs-mit-ai-policy`
- `/compare/university-of-toronto-vs-mcgill-ai-policy`
- `/regions/us-vs-canada-university-ai-policies`

### 4.5 Change Pages

Change pages expose the product's strongest differentiator:

- `/universities/harvard-university-ai-policy/changes`
- `/changes/2026-05`
- `/regions/canada/recent-ai-policy-changes`
- `/tools/chatgpt/university-policy-changes`

Each change entry should show:

- source URL,
- old snapshot hash,
- new snapshot hash,
- changed date,
- detected date,
- claim affected,
- review state,
- diff link.

### 4.6 Dataset And Methodology Pages

`/datasets` should explain:

- available public JSON endpoints,
- versioned API paths,
- dataset snapshot downloads,
- license of tracker metadata,
- official source rights caveat,
- release cadence,
- data dictionary,
- citation formats,
- DOI or release identifiers when available.

`/methodology` should explain:

- source discovery,
- crawl order,
- robots and rate limits,
- normalization,
- hash-based change detection,
- claim extraction,
- evidence binding,
- review workflow,
- publication rules,
- multilingual handling,
- limitations.

`/citation` should explain:

- suggested citation format,
- per-entity citation fields,
- dataset citation,
- GitHub/Zenodo citation,
- source attribution caveat,
- no legal advice and no academic integrity advice boundaries.

### 4.7 Front-End Product Priority

The front end should behave like a trustworthy public database, not a decorative landing page. Prioritize features that make evidence easier to inspect, cite, compare, and reuse.

Priority levels:

- P1 foundation: build before scaling pages, because later refactors become expensive.
- P2 public trust: build while the first 20-50 high-quality pages are being prepared.
- P3 expansion: build after initial pages and OpenClaw pilot data are stable.
- P4 ecosystem: build after the site has recurring usage, external citations, or contribution volume.

P1 foundation features:

- design tokens for light mode and dark mode,
- system color preference support through `prefers-color-scheme`,
- manual theme toggle with local persistence,
- semantic color tokens for review states, confidence, source types, diffs, and charts,
- i18n routing and locale-aware metadata architecture,
- source-first multilingual rendering rules,
- reusable claim/evidence card component,
- reusable citation/copy actions.

Dark mode is a design-system requirement, not a standalone visual theme. It should be implemented through tokens before the UI has many hard-coded cards, charts, diff views, and status badges.

Multilingual support is a data-contract and routing requirement. A localized page must never overwrite canonical facts. It may localize UI, summaries, taxonomy labels, citations, and helper text while preserving original evidence and source URLs.

P2 public trust features:

- evidence-backed claim cards,
- official source cards,
- copy citation button,
- copy public JSON URL button,
- data freshness block,
- review state and confidence display,
- clear candidate-versus-reviewed labeling,
- trust-route navigation on every entity page,
- SEO metadata, canonical URL, and structured data helpers.

P3 expansion features:

- university list search,
- filters for country, region, tool, policy status, review state, governance theme, last checked, and last changed,
- entity change timeline,
- GitHub Diff-style source and claim diffs,
- source history page,
- theme and region page templates,
- noindex controls for thin pages,
- Open Graph/share-image template for reports and high-value pages.

P4 ecosystem features:

- embeddable university policy status widget preview,
- recent changes widget preview,
- institution correction call-to-action,
- report missing source flow,
- report policy change flow,
- translation correction flow,
- read-only MCP/API documentation surface,
- course-level policy submission entry points after moderation exists.

Feature priority rules:

- Claim/evidence inspection outranks visual polish.
- Multilingual evidence integrity outranks localized page count.
- Reviewed claims outrank broad coverage.
- Search and filters should wait until enough records exist to make filtering useful.
- Public submission forms should create review tasks, not canonical facts.
- Widgets and MCP integrations should stay read-only until correction and moderation workflows are mature.

## 5. Layer 3: Distribution Layer

The Distribution Layer turns the project into reusable infrastructure.

### 5.1 SEO

SEO should focus on reliable reference pages, not generic posts.

Requirements:

- SSR or SSG for critical public content,
- crawlable HTML,
- stable canonical URLs,
- clean internal links,
- sitemap indexes,
- robots.txt,
- canonical tags,
- no login wall for public data,
- visible text matching structured data,
- fast page speed,
- page titles that answer real queries.

Google's AI features guidance says regular SEO fundamentals still apply and there are no extra special technical requirements for AI Overviews or AI Mode. The practical implication is simple: do not hide important content in JSON only; make it visible, useful, crawlable, and source-backed.

### 5.2 GEO And AI Answer Engine Visibility

GEO means making the site easy for AI answer engines and research agents to cite.

Primary tactics:

- citation-ready summaries,
- source-backed claims,
- clear review states,
- public JSON records,
- stable canonical URLs,
- recent change pages,
- methodology page,
- citation page,
- dataset releases,
- short evidence snippets,
- source provenance.

`llms.txt` should be provided as an auxiliary guide for agents and developers. It must not be described as a guaranteed ranking signal.

### 5.3 Public JSON And API Distribution

Public JSON/API must be versioned from the beginning.

Use paths such as:

- `/api/public/v1/universities/{slug}.json`
- `/api/public/v1/tools/{slug}.json`
- `/api/public/v1/regions/{slug}.json`
- `/api/public/v1/themes/{slug}.json`
- `/api/public/v1/recent-changes.json`
- `/api/public/v1/datasets/latest.json`

Versioning rules:

- `v1` is stable enough for public links.
- Breaking changes require `v2`.
- Additive fields may stay in the same version.
- Deprecated fields should be documented before removal.
- Every response should include a schema version.

Public JSON should include:

- `citationTitle`
- `canonicalUrl`
- `apiUrl`
- `entityType`
- `entitySlug`
- `lastCheckedAt`
- `lastChangedAt`
- `reviewState`
- `trackerMetadataLicense`
- `sourceRightsPolicy`
- `officialSources`
- `claims`
- `evidence`
- `limitations`

### 5.4 Dataset Distribution

The dataset should be distributed outside the website as well.

Targets:

- GitHub Releases,
- Zenodo DOI,
- Hugging Face Dataset,
- Kaggle Dataset, optional,
- direct downloads from `/datasets`.

Recommended release artifacts:

- `university-ai-policy-claims-YYYY-MM.jsonl`
- `university-ai-policy-sources-YYYY-MM.jsonl`
- `university-ai-policy-changes-YYYY-MM.jsonl`
- `university-ai-policy-data-dictionary-YYYY-MM.md`
- checksums,
- release notes.

Dataset pages should use `Dataset`, `DataCatalog`, and `DataDownload` structured data where appropriate. Dataset metadata should include source and provenance fields such as canonical page, license, identifier, and links to source documents.

### 5.5 API Positioning

The API should be marketed as a citation and lookup API, not as an internal app API.

Use cases:

- "Find the current AI policy status for a university."
- "Compare ChatGPT treatment across Canadian universities."
- "List universities that require AI disclosure."
- "Get recent policy changes for a region."
- "Retrieve claim-level evidence for a policy assertion."

Later API products may include:

- API key tier for higher rate limits,
- bulk exports,
- webhooks for changes,
- institution correction API,
- research snapshots.

### 5.6 MCP And Agent Integrations

The project should eventually expose a read-only MCP server.

Initial MCP tools:

- `lookup_university_ai_policy`
- `compare_university_ai_policies`
- `get_recent_policy_changes`
- `get_policy_claim_evidence`
- `search_policy_sources`
- `list_universities_by_ai_tool_treatment`

MCP must be read-only at first. Write tools for institution corrections or course submissions should wait until the review system is mature.

### 5.7 Embeddable Widgets

Embeddable widgets can generate backlinks and adoption by teaching centers, student newspapers, blogs, and researchers.

Potential widgets:

- university policy status badge,
- last checked badge,
- approved tools table,
- recent changes widget,
- disclosure requirement badge,
- course AI policy status widget, future.

Example future embed shape:

```html
<script
  src="https://eduaipolicy.org/widgets/university-ai-policy.js"
  data-university="harvard-university"
></script>
```

Widget rules:

- show source and last checked date,
- link to canonical page,
- avoid legal or academic integrity advice,
- avoid unreviewed claims unless clearly labeled,
- support locale display,
- keep canonical facts server-side.

### 5.8 RSS And Newsletter Feeds

Feeds help journalists, researchers, librarians, and automation users.

Initial feeds:

- `/feeds/recent-changes.xml`
- `/feeds/reports.xml`
- `/feeds/atom.xml`
- `/feeds/canada-ai-policy-changes.xml`
- `/feeds/chatgpt-policy-changes.xml`

Each feed item should include:

- title,
- summary,
- canonical URL,
- source count,
- review state,
- changed date,
- region and themes.

### 5.9 GitHub Discoverability

The GitHub repo should look like an open-data infrastructure project.

Recommended root files:

- `README.md`
- `CONTRIBUTING.md`
- `DATA_DICTIONARY.md`
- `CITATION.cff`
- `LICENSE`
- `SECURITY.md`
- `examples/harvard.json`
- `examples/policy-claim.json`

Recommended topics:

- `ai-policy`
- `higher-education`
- `university-policy`
- `generative-ai`
- `open-data`
- `policy-tracker`
- `education-technology`
- `academic-integrity`
- `geo`
- `llms-txt`

The README should emphasize:

- official source URLs,
- claim/evidence model,
- review states,
- public JSON API,
- change detection,
- citation-ready pages,
- dataset releases.

### 5.10 Academic Citation

The project should support academic citation early.

Requirements:

- `CITATION.cff` with dataset type when dataset releases begin,
- `/citation` page,
- suggested citation per entity,
- suggested citation per dataset release,
- DOI through Zenodo after stable release,
- release notes with coverage stats.

Suggested entity citation shape:

```text
University AI Policy Tracker. "Harvard University AI Policy." Last checked 2026-05-04. Source-backed claims and official source URLs available at: https://eduaipolicy.org/universities/harvard
```

Dataset citation should cite the tracker metadata, not official source documents as if they were relicensed.

### 5.11 Newsletter And Media Citation

Monthly reports are the best media and newsletter asset.

Report concepts:

- "University AI Policy Changes - May 2026"
- "Which Universities Require Students To Disclose AI Use?"
- "AI Exam Policy Trends Across Canadian Universities"
- "How Universities Are Handling ChatGPT In Coursework"
- "Approved AI Tools Across Higher Education"

Each report should include:

- checked source count,
- changed source count,
- top trends,
- regional breakdown,
- examples with citations,
- chart images,
- data download link,
- methodology link,
- limitations.

### 5.12 Institution Correction Workflow

Institution correction is a trust and backlink channel.

Institutions should be able to:

- submit official source URLs,
- correct stale claims,
- identify official pages,
- request label corrections,
- add office contact information,
- verify an institution page.

Corrections should create reviewed records, not overwrite canonical claims directly.

## 6. Layer 4: Contribution & Review Layer

This layer controls growth without lowering data quality.

### 6.1 Contribution Types

Contribution paths:

- submit university AI policy URL,
- report policy change,
- submit course syllabus AI policy,
- institution correction,
- developer data adapter,
- dataset issue,
- translation correction.

### 6.2 Review Queues

Separate review queues:

- source discovery review,
- crawl failure review,
- extraction review,
- claim/evidence review,
- translation review,
- institution correction review,
- course submission review,
- abuse/moderation review.

### 6.3 Student And Course-Level UGC

Student/course functionality is a major opportunity, but it should not begin as an open comment wall.

Course-level data should reuse the claim/evidence model:

- course entity,
- term,
- instructor, optional,
- source type,
- claim,
- evidence,
- review state,
- student report count,
- clarity score,
- moderation status.

Example:

```text
Course: CS50
Term: Fall 2026
Claim: AI may be used for debugging but not for final code generation.
Evidence: syllabus excerpt
Source type: student uploaded syllabus
Review state: pending
Student reports: 43
Clarity score: 4.1
```

UGC rules:

- no doxxing,
- no personal attacks,
- no unverified accusations,
- no private student data,
- no full copyrighted syllabus republication unless permitted,
- short excerpts only when needed for evidence,
- clear pending/verified/rejected states.

## 7. OpenClaw Agent Operating Standard

This is an operating standard, not a feature introduction.

### 7.1 Trigger Rule

Normally trigger only `policy-manager`.

Do not manually chain all six role agents unless debugging a broken stage. `policy-manager` owns the internal dispatch flow and should use `sessions_send` to call:

```text
crawl-designer -> crawl-worker -> policy-extractor -> policy-reviewer -> report-writer
```

### 7.2 What OpenClaw May Do

OpenClaw may perform:

- crawl planning,
- source discovery,
- public page fetching,
- snapshot generation,
- content normalization,
- content hashing,
- claim extraction,
- evidence binding,
- review assistance,
- report draft writing,
- bot branch generation,
- pull request generation,
- drift reports,
- smoke tests.

### 7.3 What OpenClaw Must Not Do

OpenClaw must not:

- write the production database directly,
- publish canonical claims,
- push `main`,
- force push any branch,
- deploy the website,
- modify Vercel or production infrastructure,
- bypass review,
- bypass robots.txt,
- bypass login walls,
- bypass paywalls,
- bypass CAPTCHAs,
- store broad production credentials,
- commit raw HTML, PDFs, screenshots, browser profiles, traces, or logs.

### 7.4 Required Inputs To `policy-manager`

Each run should include:

- run purpose,
- target universities or entities,
- max URLs per entity,
- region/language scope,
- allowed fetch modes,
- rate limits,
- output mode, PR or local staging,
- branch naming rule,
- schema/data contract version,
- stop conditions,
- whether report draft is requested.

### 7.5 Required Outputs From `policy-manager`

Each completed run should output:

- run ID,
- branch name,
- PR URL or reason PR was not created,
- target entities,
- fetched URLs,
- skipped URLs,
- blocked URLs and reasons,
- snapshot count,
- claim candidate count,
- evidence count,
- review decision summary,
- validation results,
- files changed,
- recommendations before expanding coverage.

### 7.6 OpenClaw Staging Contract

OpenClaw should stage data in these categories:

- crawl plans,
- crawl runs,
- source candidates,
- source discovery traces,
- source rejections,
- fetch attempts,
- source snapshots,
- policy claim candidates,
- claim evidence candidates,
- review decisions,
- report drafts,
- run summaries,
- drift reports.

OpenClaw output must validate against the current repo contract before PR creation.

### 7.7 OpenClaw Git Branch Rules

Allowed branch patterns:

- `bot/crawl/YYYYMMDD-{scope}`
- `bot/report/YYYYMMDD-{scope}`
- `bot/docs/YYYYMMDD-{scope}`, if agent docs are updated

Forbidden:

- direct `main`,
- force push,
- rewrite human branches,
- commit secrets,
- commit unreviewed production files.

### 7.8 OpenClaw Expansion Rule

Do not expand from pilot to large crawl until:

- claim/evidence contract is stable,
- validation script exists,
- pilot PR passes validation,
- at least one human has reviewed the output,
- stop conditions are working,
- raw artifact retention is not in Git.

## 8. Git Workflow

### 8.1 Branch Types

Use branch prefixes:

- `feature/*` for human/Codex product work,
- `docs/*` for planning/docs,
- `bot/crawl/*` for OpenClaw crawl output,
- `bot/report/*` for OpenClaw report drafts,
- `fix/*` for focused bug fixes.

### 8.2 Main Protection

`main` should require:

- pull request review,
- CI validation,
- no force push,
- no direct OpenClaw push,
- schema/data contract validation for data PRs,
- secret scanning,
- diff check.

### 8.3 Data PR Requirements

OpenClaw data PRs must include:

- run ID,
- target list,
- source URLs,
- skipped URL reasons,
- robots/access notes,
- snapshot hashes,
- claim/evidence count,
- review state summary,
- validation command results,
- known limitations.

### 8.4 Merge Rules

Do not merge data PRs when:

- JSON does not validate,
- evidence is missing,
- source language is missing,
- source hash is missing,
- review state is unclear,
- unsupported claims are present,
- raw artifacts are committed,
- legal/copyright risks are unresolved.

## 9. Safety, Copyright, And Compliance

### 9.1 Legal And Academic Integrity Boundary

The site must include risk boundaries:

- This is not legal advice.
- This is not academic integrity advice.
- This is not an official statement by any university unless the source is the university's own official page.
- Users must follow their institution, course, and instructor policies.
- Course-level and student-submitted records may be incomplete or pending review.

### 9.2 Copyright And Source Rights

Tracker metadata can be open licensed. Official source documents retain their original rights.

Rules:

- Do not republish long official source text.
- Store short evidence snippets only when necessary.
- Link to official source URLs.
- Store source hashes and metadata for provenance.
- Store raw files outside Git if retention is needed.
- Keep rights caveats in public JSON and dataset releases.

### 9.3 Crawler Compliance

Crawler rules:

- respect robots.txt,
- identify crawler user agent,
- use rate limits,
- do not bypass access controls,
- stop on login wall, paywall, CAPTCHA, 403, or 429,
- record inaccessible status,
- avoid unnecessary repeat fetches through hash and header checks.

### 9.4 Privacy And UGC

Student/course features must avoid:

- private student information,
- private instructor data beyond public course context,
- accusations,
- harassment,
- full syllabus reposting,
- hidden personal data in uploaded files.

Review and moderation must exist before broad UGC launch.

### 9.5 Security

Security rules:

- no secrets in Git,
- OpenClaw gets limited credentials only,
- no production DB superuser credentials in OpenClaw,
- no deployment credentials in OpenClaw,
- rotate ingestion tokens if exposed,
- validate all ingestion payloads,
- log ingestion actor and source,
- keep OpenClaw separate from public web/API hosting.

## 10. Execution Roadmap

The roadmap has four large phases, with P0-P8 execution milestones.

### Phase A: Evidence Foundation

Includes P0-P2.

Goal: make the data trustworthy before scaling coverage.

### Phase B: Reference Product

Includes P3-P4.

Goal: make high-quality pages that people and search engines can use.

### Phase C: Distribution And Growth

Includes P5-P6.

Goal: make the project reusable, citable, and visible outside the site.

### Phase D: Contribution And Ecosystem

Includes P7-P8.

Goal: enable institution correction, course-level UGC, and agent integrations.

## 11. P0-P8 Execution Roadmap

### P0: Claim/Evidence/Citation Data Contract

Build:

- canonical entities,
- policy claims,
- claim evidence,
- source attribution,
- citation policy,
- multilingual source-first fields,
- review state/confidence separation,
- validation examples.

Acceptance criteria:

- Every public claim can point to source URL, snapshot hash, original evidence, confidence, and review state.
- Translation fields exist as display helpers and cannot replace original evidence.
- `confidence` and `reviewState` are separate in docs and contracts.
- Existing extraction tables remain backward compatible.
- OpenClaw output contract is documented.

### P1: High-Quality Reference Page Contract

Build:

- university detail page contract,
- tool page contract,
- region page contract,
- theme page contract,
- design tokens for light and dark mode,
- source-first i18n routing and metadata plan,
- reusable claim/evidence card component,
- reusable citation and public JSON copy actions,
- citation-ready summary block,
- official sources block,
- evidence-backed claims block,
- public JSON link block,
- suggested citation block.

Acceptance criteria:

- 20-50 target universities can be rendered as non-thin reference pages.
- Pages expose last checked, last changed, review state, and source links.
- Unreviewed claims are clearly labeled or hidden from canonical summaries.
- Localized display is separated from canonical facts.
- Dark mode uses semantic tokens and does not hard-code status or diff colors.
- Localized pages preserve original evidence, original source URL, and source language.

### P2: Public JSON, API Versioning, And Core Trust Routes

Build:

- `/api/public/v1/...` endpoints,
- `/methodology`,
- `/citation`,
- `/datasets`,
- `/changes`,
- `/llms.txt`,
- sitemap and robots plan,
- entity-page data freshness block,
- reviewed-versus-candidate visual labeling,
- SEO metadata, canonical URL, and structured data helpers,
- JSON schema examples.

Acceptance criteria:

- API URLs are versioned with `/api/public/v1`.
- Public JSON includes citation and rights caveats.
- Core trust routes are linkable and part of site navigation.
- `llms.txt` is documented as auxiliary, not a guaranteed ranking signal.
- Public pages expose copyable citation and public JSON URLs.
- Structured data matches visible page content.

### P3: OpenClaw Contract Alignment

Build:

- update OpenClaw agent role docs,
- policy-manager run spec,
- claim/evidence output contract,
- data PR validation checklist,
- pilot crawl prompt,
- stop conditions.

Acceptance criteria:

- User only needs to trigger `policy-manager` for normal runs.
- OpenClaw produces source discovery, source verification, fetch, claim, evidence, and citation artifacts, not only page-level extraction candidates.
- OpenClaw does not write production DB, publish canonical claims, push main, or bypass review/access rules.
- Pilot PR validates before coverage expansion.

### P4: Change Log And Diff Product

Build:

- entity change timeline,
- source change pages,
- entity change pages,
- monthly change pages,
- diff views,
- GitHub Diff-style source and claim diffs,
- source history page,
- recent changes feed,
- claim supersession model.

Acceptance criteria:

- Users can see exactly what source changed and which claim was affected.
- Each change links old/new snapshot hashes.
- Recent changes are available as HTML and JSON.
- Change pages can support monthly reports.
- Diff views use theme tokens and remain readable in light and dark mode.

### P5: Dataset Distribution And GitHub Discoverability

Build:

- GitHub README upgrade,
- `DATA_DICTIONARY.md`,
- `CITATION.cff`,
- release artifact plan,
- dataset JSONL exports,
- Dataset structured data,
- Zenodo release process.

Acceptance criteria:

- Repo explains the project as an open evidence database.
- Dataset releases include checksums and data dictionary.
- Citation flow works on GitHub.
- `/datasets` links to versioned downloads.

### P6: Reports, Media, And Newsletter Distribution

Build:

- first monthly data report,
- report template,
- chart assets,
- Open Graph/share-image template,
- RSS/Atom feeds,
- outreach package,
- share images.

Acceptance criteria:

- Reports include checked count, changed count, trend summary, examples, data links, and methodology.
- Feed links are public.
- Reports only use reviewed claims or clearly labeled candidate data.
- Outreach copy is available for researchers/newsletters.

### P7: Embeddable Widgets, API Product, And MCP Alpha

Build:

- embeddable widget preview surface,
- embeddable status widget,
- recent changes widget,
- read-only MCP server design,
- API docs,
- rate-limit policy,
- example agent queries.

Acceptance criteria:

- Widgets link back to canonical pages.
- Widgets display last checked and source/review state.
- MCP is read-only and cannot mutate records.
- API docs include versioning and citation guidance.
- Widgets do not expose unreviewed claims unless clearly labeled.

### P8: Contribution, Institution Correction, And Course-Level UGC

Build:

- submit official source URL,
- report policy change,
- institution correction workflow,
- course-level structured submission,
- syllabus evidence handling,
- moderation queues,
- translation correction flow.

Acceptance criteria:

- Submissions create review tasks, not direct canonical facts.
- Course policies reuse claim/evidence.
- UGC has moderation, privacy, and copyright safeguards.
- Institution corrections preserve audit history.

## 12. Expansion Rules

Before adding many universities:

- P0 contract must be stable.
- P3 OpenClaw alignment must be complete.
- Pilot PR must validate.
- Review queue must be manageable.
- Thin page `noindex` rules must exist.
- Multilingual source fields must exist.

Before adding student/course UGC:

- moderation exists,
- syllabus rights policy exists,
- privacy policy exists,
- review workflow exists,
- course entities reuse claim/evidence.

Before launching MCP write tools:

- read-only MCP has been tested,
- abuse model is understood,
- institution correction workflow is mature.

## 13. External Reference Notes

These external references inform the roadmap:

- Google Search Central, [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features): AI features rely on normal SEO fundamentals; no special AI text file is required to appear in Google AI features.
- Google Search Central, [Dataset Structured Data](https://developers.google.com/search/docs/appearance/structured-data/dataset): dataset structured data supports dataset discovery, data catalog pages, download metadata, sitemap guidance, and source/provenance fields.
- GitHub Docs, [About CITATION files](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-citation-files): `CITATION.cff` enables repository citation UI, and dataset repositories can set dataset citation metadata.
- Zenodo Docs, [GitHub and Software](https://help.zenodo.org/docs/github/): GitHub releases can be archived and described with citation metadata for DOI-based citation.

The project should follow those sources pragmatically: make content useful and visible first, then add structured and machine-readable distribution as infrastructure.
