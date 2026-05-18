# QS200 Stage 2 Batch 1 Review Summary

Status: internal staging review note, not a public release decision
Generated at: 2026-05-18T01:54:49.356Z
Run ID: uapt-qs200-stage2-batch1-20260517
Artifact path: /home/openclaw/workspace/staging/uapt-maintenance/uapt-qs200-stage2-batch1-20260517/openclaw-artifacts/artifacts.json

## Validator Gate

- `pnpm validate:openclaw-artifacts` passed on the remote host before this summary was generated.
- Total artifacts: 225
- Universities detected: 25

## Artifact Counts

| Artifact type | Count |
| --- | ---: |
| claim_candidate | 25 |
| crawl_plan | 25 |
| evidence_candidate | 25 |
| fetch_attempt | 25 |
| report_draft | 25 |
| review_decision | 25 |
| source_candidate | 25 |
| source_discovery_trace | 25 |
| source_snapshot | 25 |

## Source-Health Outcomes

| Outcome | Count |
| --- | ---: |
| retry_recommended | 2 |
| success | 23 |

### Retry Recommended

| Entity | Source URL | Reason |
| --- | --- | --- |
| yale-university | https://poorvucenter.yale.edu/teaching/teaching-resource-library/ai-guidance-for-teachers/ai-course-assignment-design/academic | Firecrawl returned no usable markdown metadata; status 408 |
| epfl | https://www.epfl.ch/about/vice-presidencies/vice-presidency-for-academic-affairs-vpa/tips-for-the-use-of-generative-ai-in-research-and-education/ | Firecrawl returned no usable markdown metadata; status 408 |

## Publication Safety Checks

- Canonical publication attempts: 0
- Human/institution verified self-assertions: 0
- Raw artifact path issues: 0
- Missing rights caveat count: 0
- Claim review states: {"agent_reviewed":25}
- Review decision states: {"agent_reviewed":25}

## Universities

- california-institute-of-technology
- cornell-university
- epfl
- eth-zurich
- harvard-university
- imperial-college-london
- massachusetts-institute-of-technology
- nanyang-technological-university
- national-university-of-singapore
- peking-university
- princeton-university
- stanford-university
- technical-university-of-munich
- tsinghua-university
- ucl
- university-of-california-berkeley
- university-of-cambridge
- university-of-chicago
- university-of-hong-kong
- university-of-melbourne
- university-of-oxford
- university-of-pennsylvania
- university-of-sydney
- unsw-sydney
- yale-university


## Targeted Retry Probe

Generated at: 2026-05-18T01:55:23.360Z

| Entity | Firecrawl outcome | HEAD status | Range/body metadata status | Last-Modified | Interpretation |
| --- | --- | ---: | ---: | --- | --- |
| yale-university | retry_recommended | 200 | 206 | Fri, 15 May 2026 15:56:54 GMT | Official URL is accessible by metadata-only probe; keep Firecrawl retry as source-health warning, not a claim blocker. |
| epfl | retry_recommended | 200 | 200 | Mon, 18 May 2026 01:55:22 GMT | Official URL is accessible by metadata-only probe; keep Firecrawl retry as source-health warning, not a claim blocker. |

No response body, raw HTML, PDF text, screenshot, browser trace, cookie, or profile was stored during this probe.

## Updated Recommendation

The run is validator-clean and publication-safe as staged maintenance metadata. Yale and EPFL should remain visibly marked as Firecrawl retry/source-health warnings unless a later Firecrawl or Playwright/OpenCLI pass extracts metadata successfully. Because this run does not create new canonical claims and reuses promoted evidence snippets, it can move to a human/operator promotion decision after confirming that retry_recommended source-health warnings are acceptable for this maintenance release.

This summary is planning metadata only. It does not publish canonical claims, change review state, or replace official source evidence.
