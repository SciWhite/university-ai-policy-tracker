# Crawler Policy

The crawler should collect public policy evidence without bypassing access controls or creating avoidable load.

Canonical public domain: `https://eduaipolicy.org`. Crawler output may include this domain for tracker canonical URLs, while source URLs must remain the original university URLs.

## Fetch Order

1. Use plain HTTP fetch first.
2. Use conditional requests with `ETag` and `Last-Modified` when available.
3. Escalate to Crawlee or Playwright for dynamic pages only when static fetch is insufficient.
4. Use opencli for browser/control workflows when it materially improves reliability.
5. Use Firecrawl as a fallback for difficult extraction or structured crawl tasks.

JS-render escalation rule (2026-07 calibration): when an HTTP 200 response
yields fewer than ~400 normalized text characters, treat the page as a
JS-rendered shell, not as evidence. Escalate to rendered fetch (Playwright or
Firecrawl) before extraction or health classification. A 2026-07 production
sample found SPA guidance sites (for example `aiguide.hanyang.ac.kr`) whose
plain-HTTP body contains only skip links.

## Discovery Recall

Tool pages from IT departments are the easiest sources to find, and sampled
coverage showed they crowd out higher-authority policy documents. For every
university, discovery must attempt, and the discovery trace must record,
beyond the IT/tools path:

- registry / academic-office paths (`registry.*`, `academics.*`, senate or
  examination regulations) for assessment and misconduct rules;
- provost / teaching-center paths for teaching guidance;
- library paths for citation and copyright guidance;
- `pdf_discovery` for official policy PDFs, which frequently hold the
  campus-wide rules that HTML pages only summarize.

Negative and interim tool statuses are claims, not noise. When an official
source lists a tool as not approved, not recommended, under review, or
web-version-only, stage a claim candidate with the matching availability
(`restricted_or_blocked`, `not_recommended`, `under_review`,
`conditionally_allowed`) and endorsement (`explicitly_not_endorsed`) values
instead of skipping the row.

## Robots, Access, And Rate Limits

- Respect robots.txt and site-specific crawl rules.
- Use a clear crawler user agent and contact email.
- Apply per-host concurrency and delay limits.
- Do not bypass login gates, paywalls, MFA, IP blocks, or CAPTCHAs.
- Mark blocked or login-gated sources as `inaccessible`.

## Source Evidence

Every classification and public claim candidate should preserve:

- source URL
- final URL after redirects
- title, if available
- fetched timestamp
- HTTP status
- robots decision
- content hash
- normalized text snapshot pointer
- evidence quote or location, when legally and practically available
- extraction confidence and review state

Every public claim must additionally preserve a short evidence snippet tied to the source URL and source snapshot hash. Long source passages should not be copied into tracker metadata.

Verbatim snippet policy (2026-07 calibration): `evidenceSnippetOriginal` must
be a verbatim quote in the source language. Summaries, translations, and
reporting-voice paraphrases ("The university states that ...") belong only in
`evidenceSnippetDisplay`. New runs must declare
`"snippetPolicy": "verbatim_original_v2"` in their artifact bundle; the
validator then rejects non-English sources whose original snippet carries no
source-language script or reads as an English paraphrase, and requires an
English `evidenceSnippetDisplay` for non-English sources. Verbatim originals
keep original-language evidence canonical and make automated re-verification
against the live page possible.

## Change Detection

Run extraction only after source content changes:

1. Fetch source.
2. Normalize text.
3. Compute content hash.
4. If hash is unchanged, update last checked metadata and stop.
5. If hash changed, create snapshot, diff, extraction candidate, claim/evidence candidate, and review task.

Link-health calibration (2026-07): an HTTP 200 is not proof the source is
alive. The maintenance scan additionally flags:

- `dead_link` for HTTP 404/410, which queues URL relocation (same-domain site
  search and redirect discovery) before any claim deprecation;
- `suspected_soft_404` when a 200 body fingerprints as a not-found page
  (multilingual tombstone wording) or when a deep link silently collapses to
  the domain root or a one-segment section index.

Both states route to the repair queue instead of counting as healthy. A
2026-07 sample caught `kamu.uef.fi` pages returning localized not-found bodies
and `yz.cau.edu.cn` deep links redirecting to a section index while
source-health still reported `ok`. High-churn platforms (LibGuides and similar
CMS guides) deserve shorter re-check cycles than stable policy PDFs.

## Local Ingestion Contract

Crawler output should be converted into structured ingest payloads before it reaches the API:

- crawl plan: planned set of crawl targets, expected themes, and fetch modes.
- crawl target: one URL plus university slug and source metadata.
- crawl artifact: fetched URL result, status, headers, normalized text, hash, and failure reason.
- source snapshot ingest payload: normalized source text and hash tied to a known university/source.
- extraction candidate payload: taxonomy classification, evidence, confidence, and review state tied to a source snapshot.
- claim/evidence candidate: citation-ready claim text, machine confidence, review state, source URL, source snapshot hash, and a short source-attributed evidence snippet.

The local sample script `pnpm ingest:sample` creates a crawl run and source snapshot directly against the local database after `pnpm db:seed`. It is for local verification only and does not connect OpenClaw.

OpenClaw is orchestration and crawling only. It may submit staged artifacts through pull requests or limited ingestion credentials, but it must not deploy services, push `main`, or write the production database directly.

## Content Retention

Raw snapshots, screenshots, browser profiles, and logs should not be committed to Git. Keep them in controlled object storage or local ignored artifact directories.

## OpenClaw PR Validation

Before a crawl/data PR is reviewed, run:

```bash
pnpm validate:openclaw-artifacts path/to/staging-directory
```

The validator fails staged output when evidence is missing, source language is absent for verified sources or evidence, review state is unclear, `/api/public` links are not versioned under `/api/public/v1`, raw HTML/PDF/screenshots are staged for Git, crawl targets or snapshots lack verified source candidates, source discovery skipped escalation before declaring no reliable source, successful fetch attempts lack hashes, or OpenClaw attempts to publish canonical claims.
