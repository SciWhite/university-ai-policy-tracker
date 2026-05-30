# Report Distribution Playbook

P6 reports turn the public evidence database into citation-safe artifacts for
researchers, newsletters, teaching centers, journalists, and AI answer engines.

## Report Contract

Each report should include:

- checked institution count;
- changed institution count;
- public university record count;
- source-backed claim count;
- evidence record count;
- reviewed vs candidate or needs-review counts;
- source-language distribution;
- example institution records with public JSON links;
- methodology and citation links;
- dataset release manifest link;
- no legal advice / no academic integrity advice boundary.

Reports must not imply that candidate or needs-review records are final policy
conclusions. Analysis summaries are derived metadata, not canonical evidence.

## Public Surfaces

Current report distribution surfaces:

- `/reports`
- `/reports/monthly/2026-05`
- `/reports/outreach`
- `/api/public/v1/reports/index.json`
- `/api/public/v1/reports/monthly/2026-05/chart-data.json`
- `/api/public/v1/reports/outreach.json`
- `/feeds/reports.xml`
- `/feeds/recent-changes.xml`
- `/feeds/atom.xml`

The HTML pages are for readers and crawlers. The JSON routes are for agents,
newsletter tooling, notebooks, and repeatable citation workflows.

Legacy monthly report paths such as `/reports/2026-05` should redirect to the
canonical `/reports/monthly/YYYY-MM` route so public indexing and citation
signals consolidate on one URL.

## Outreach Rules

Use wording like:

> Open, evidence-backed university AI policy metadata.

Avoid wording like:

> Official advice on whether students may use AI.

Every outreach asset should preserve:

- official source URLs as the authority for institutional language;
- original-language evidence as canonical;
- review state visibility;
- source-rights caveat;
- no legal advice and no academic integrity advice boundary.

## Share Assets

For each report, keep:

- canonical report URL;
- report chart-data JSON URL;
- Open Graph image URL;
- dataset manifest URL;
- outreach JSON URL;
- RSS feed URL.

Visual chart assets should use dataset counts and review-state labels, not
policy-quality rankings.

GEO-specific monthly report rules, including the private Google Search Console
boundary, are documented in `docs/geo-monthly-reports.md`.

## Distribution Rhythm

Suggested cadence:

1. Publish or update a dataset release.
2. Run validators and public-data audits.
3. Publish a report page and chart-data JSON.
4. Update feeds.
5. Refresh outreach copy.
6. Share with researchers, teaching centers, library guides, newsletters, and
   education media.
7. Record feedback as GitHub issues or contribution review tasks.

## Acceptance Criteria

- Report pages are crawlable and server-rendered.
- Report data is available as versioned public JSON.
- Feeds expose report URLs.
- Outreach copy is reusable without overstating evidence.
- Report metrics can be traced back to the dataset release manifest.
- The report states limitations and review-state boundaries visibly.
