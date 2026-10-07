# Agent working methods

Agents support development and maintenance of University AI Policy Tracker.
The workflow has used Claude, Codex and Antigravity across source research,
implementation, translation drafts and review. Tool choice varies by task;
this is not a claim that every public record was produced by one model or
that the public website calls those providers on each request.

## From source to public record

1. Discover official university sources and preserve their audience and scope.
2. Collect source material using HTTP, browser tools or Firecrawl and retain
   source URLs, original text and snapshot hashes.
3. Extract candidate claims and bind them to original-language evidence.
4. Review wording, scope, exceptions, dates and evidence quality. Keep machine
   confidence separate from review state; do not label agent work human-reviewed.
5. Promote accepted candidates into a public dataset release. Candidate output
   does not directly overwrite published policy conclusions.

Original-language evidence remains canonical. Translations and summaries
support navigation and do not replace the source. A content hash supports
traceability and change detection; it does not prove a policy is still current.

## Selected repository history

- [Source checks and evidence re-sourcing](https://github.com/SciWhite/university-ai-policy-tracker/commit/1e785be):
  official-source checks, candidate evidence and source re-collection.
- [Live-fetch and evidence audit tools](https://github.com/SciWhite/university-ai-policy-tracker/commit/e27c42c):
  live-fetch checks, browser escalation and snippet-anchor validation.
- [Follow-up verification](google-index-recovery-p0-final-acceptance.md):
  validation and corrections to an earlier agent report, including the limits
  of the available build and browser evidence.

These are examples of work and review, not proof that every candidate was
accepted or that the website has a direct first-party model API integration.

## Data handling

Research uses official-source material. Source text, hashes, evidence links and
review records support reproducibility and change tracking. Contributors should
send official URLs and corrections rather than private student records or
confidential documents. This guidance does not claim that agents cannot receive
sensitive data or that every provider has the same retention policy.

For record publication rules, see [agent workflow](agent-workflow.md) and
[crawler policy](crawler-policy.md). Contact: <support@eduaipolicy.org>.
