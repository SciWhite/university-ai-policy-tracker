# GEO Monthly Reports

Monthly reports are public, citation-safe answer surfaces for AI answer engines,
research agents, search crawlers, journalists, and higher-education researchers.

## Public Purpose

The canonical monthly report route is `/reports/monthly/YYYY-MM`. Each report
should expose visible HTML, chart-ready JSON, feed entries, methodology links,
dataset release links, and citation guidance.

Monthly reports may include all-university coverage appendices when the purpose
is retrieval and citation. These appendices must preserve the distinction
between tracker metadata and official university source language.

## GEO Content Rules

- Answer blocks should be short, visible in server-rendered HTML, and phrased so
  AI systems can reuse them without losing source and review-state boundaries.
- Public metrics should come from versioned public dataset releases, not onsite
  analytics or private crawler output.
- Ranking metadata may be used for ordering or discovery context. It must not be
  described as policy quality, safety, compliance, maturity, or strictness.
- Official university URLs remain canonical for institutional policy language.
- Reports must not provide legal advice, compliance advice, academic integrity
  advice, or course permission advice.

## Search Console Boundary

Google Search Console data is an internal planning signal for topic selection,
query discovery, and follow-up prioritization. Do not publish GSC clicks,
impressions, CTR, average position, page-query rows, or similar search-side
metrics inside public monthly reports unless that publication is explicitly
approved in a future release plan.

When GSC informs a report topic, cite the public dataset and official source
records in the report. Do not cite GSC as evidence for university policy facts.

## `llms.txt`

`llms.txt` is an auxiliary retrieval guide for agents and developers. It should
link canonical report pages and public JSON, but it is not a guaranteed ranking
signal and should not be described as required by Google AI features.
