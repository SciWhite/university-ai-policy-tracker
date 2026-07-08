# Maintenance Note: durham-university

## Review: sc-du-dcad-genai-lta (Generative AI in Learning, Teaching & Assessment)

**Run ID:** uapt-maintenance-light-durham-university-20260707
**Conducted:** 2026-07-07T13:18:52Z
**Reviewer:** openclaw-codex (openclaw_agent)
**Status:** policy_content_update detected - artifact bundle repaired locally and validated for release

## Finding

The target URL (`https://dcad-resourcebank.webspace.durham.ac.uk/2024/07/16/generative-ai-in-learning-teaching-assessment/`) has been **completely rewritten**. It is no longer a DCAD resource-collection page listing GenAI links, case studies, and internal policy references. It now serves as **Durham University's official public-facing GenAI policy statement**, with:

- "Updated: 9.30am, Tuesday 7 July 2026" banner
- Senate-approved GenAI policy (June 2026)
- Four-tier assessment categorisation: No GenAI Allowed, Selective, Allowed, Embedded
- Programme-level requirement for mixed GenAI-secure/open assessments
- Staff-use framework with transparency and GDPR compliance
- Separate GenAI policy for postgraduate research degrees approved by Senate
- Microsoft AI Skills Centre of Excellence partnership announced

The old resource-collection content has moved to:
`https://dcad-resourcebank.webspace.durham.ac.uk/2026/07/06/generative-ai-in-teaching-learning-and-assessment-resources/`

## Artifact Bundle

Created at:
`/home/openclaw/workspace/university-ai-policy-tracker/staging/uapt-runs/uapt-maintenance-light-durham-university-20260707/artifacts.json`

Remote bundle contained: 1 source_candidate, 1 fetch_attempt, 1 source_snapshot, 6 claim_candidates, 6 evidence_candidates, 1 review_decision.

The local repair release bundle contains 5 claim_candidates and 5 evidence_candidates. The Microsoft AI Skills Centre candidate was excluded because it is contextual news rather than a policy boundary.

## Local Repair Review

The remote lightweight bundle was repaired locally by adding a maintenance `crawl_plan`, a `source_discovery_trace`, and a `report_draft`, then changing the bundle purpose to `claim_evidence_release`.

The remaining Durham claims were checked against the current public DCAD page and promoted as `agent_reviewed` staged candidates.

Repaired bundle:
`staging/uapt-runs/uapt-maintenance-light-durham-university-20260707/artifacts.json`

## Existing Claims Affected

- `claim-du-dcad-internal-institutional-policy-listed` is no longer accurate: the URL now is the institutional GenAI policy page rather than a resource page that lists the internal policy. It should be deprecated or repurposed in a future cleanup.

## Source Health Metadata

| Field | Baseline (May 2026) | Current (Jul 2026) |
|---|---|---|
| HTTP status | 200 | 200 |
| Content hash | `221e2a...` | `f14baa...` |
| Normalized text size | ~6,231 bytes | ~4,767 bytes |
| Content type | Resource collection index | Institutional policy statement |
| Page title | Generative AI in Learning, Teaching & Assessment | Generative AI in Learning, Teaching & Assessment at Durham University |
| Robots policy | Respect | Respect (public, no login) |
