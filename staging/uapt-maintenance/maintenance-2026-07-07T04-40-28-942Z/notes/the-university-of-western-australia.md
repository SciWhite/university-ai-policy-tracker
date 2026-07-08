# Maintenance Note: the-university-of-western-australia
**Run:** maintenance-2026-07-07T04-40-28-942Z
**Date:** 2026-07-07
**Reviewer:** Claw (maintenance-review-light-20260707)
**Target source:** Using Artificial Intelligence Tools at UWA: A Guide for Students
**URL:** https://www.uwa.edu.au/students/-/media/project/uwa/uwa/students/academic-support/using-artificial-intelligence-tools-at-uwa---a-guide-for-students-(2026).pdf

---

## Decision

**Policy-content update detected.** Artifact bundle created at:
`staging/uapt-runs/uapt-maintenance-light-the-university-of-western-australia-20260707/artifacts.json`

The remote lightweight bundle was repaired locally by adding a maintenance `crawl_plan` and `report_draft`, changing the bundle purpose to `claim_evidence_release`, and marking the two source-supported candidates as `agent_reviewed`.

---

## Source Health Observations

| Metric | Value |
|---|---|
| HTTP status | 200 |
| Content type | application/pdf |
| Robots allowed | Yes |
| Auth/paywall | None (publicly accessible) |
| Previous contentHash (May 13) | `aecf591a0b5e39661c96b374c2dbcf4ddd6fcc67601adf912458167884fb893c` |
| Current contentHash (Jul 7) | `7d754da317549a66ae03290631c1d199876d5b89fe3c00cf16431b6de471a46c` |
| Etag | `3986240278bb42cf9a476942086101be` (unchanged) |
| Last-Modified | Mon, 09 Mar 2026 01:19:14 GMT (unchanged) |
| Cloudflare cache | HIT, age ~195721s (~2.3 days) |
| Content length | 1,191,660 bytes (unchanged) |

The PDF has been updated at least twice since the May 13 crawl snapshot: once before the Jul 7 source-hashes check (hash `e33f1266...` at 04:47 UTC), and again by the time of this review (hash `7d754d...` at 13:19 UTC), despite the etag and Last-Modified headers remaining unchanged. This suggests the server-side PDF file was replaced without updating these metadata headers.

## Policy-Content Changes Identified

### 1. DeepSeek Ban (new content in this PDF)
The PDF now explicitly states under "Privacy, copyright, and AI":
> "UWA staff and students must not use DeepSeek in any way. UWA has blocked the use of DeepSeek on all University-managed networks and devices, and students should avoid using DeepSeek on their personal devices."

This DeepSeek restriction was previously captured only from a separate askUWA page (src-uwa-006, claim-uwa-008 in the 20260513 run). Its addition to this consolidated student guide is a meaningful cross-reference and consolidation of policy.

### 2. Expanded Privacy & IP Guidance (new content)
The PDF now adds:
- Explanation that AI tools retain user inputs for training data
- Warning about losing control of personal data
- Explicit prohibition on inputting UWA staff intellectual property (lecture slides, handouts, unit reading material)

### 3. Tier 1 Clarification (minor addition)
Added: "There may be controls in place, such as invigilation or proctoring, to maintain secure conditions."

### Unchanged Core Policy
- Three-tier AI use framework (Tier 1 No AI, Tier 2 AI Assistance, Tier 3 Fully Embedded) is substantively unchanged
- Acknowledgement and citation requirements are consistent
- General prohibition on unauthorized AI use in assessments intact

## Claims & Evidence Candidate Summary

| ID | Type | Review State | Note |
|---|---|---|---|
| maint-claim-uwa-002-001 | DeepSeek ban consolidation | agent_reviewed | Cross-reference with existing claim-uwa-008 in a future dedupe cleanup |
| maint-claim-uwa-002-002 | Staff IP not for AI input | agent_reviewed | Expansion of existing privacy guidance |

## Validation Result

The repaired bundle validates as a complete `openclaw-artifact-v1` release bundle. The DeepSeek prohibition overlaps with an existing askUWA-sourced claim and is promoted here as source-specific evidence from the consolidated 2026 student AI guide.
