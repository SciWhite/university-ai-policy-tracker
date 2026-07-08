# Maintenance Note: university-of-california-berkeley

**Run:** maintenance-2026-07-07T04-40-28-942Z
**Target source URL:** https://re-ai.berkeley.edu/sites/default/files/responsible_use_of_generative_ai_uc_berkeley_2025.pdf
**Existing snapshot:** ss-sc-berkeley-005 (fetched 2026-05-06, hash fe63cb6b...)
**Current fetch hash:** 0ac95fef6fbfb0ecafa3c4476290af90e245e517cb04137b6500eaaa8b02fa59 (SHA-256)
**HTTP status:** 200
**Last-Modified header:** Tue, 04 Feb 2025 16:57:32 GMT (unchanged)
**ETag:** "67a246fc-310d64"
**PDF metadata (internal):** Creation D:20250201200145-08'00, Mod D:20250201200151-08'00
**Decision: No policy-content update.**

## Analysis

1. **Hash differs but content unchanged.** The binary hash changed between the 2026-05-06 snapshot and today's fetch, but the extracted text content is substantively identical. Previously extracted evidence snippets — the UC system AI principles (Appropriateness; Transparency; Accuracy, Reliability and Safety; Fairness and Non-Discrimination; Privacy and Security; Human Values; Shared Benefit and Prosperity; Accountability) and the UC Berkeley risk assessment pre-screening description — both match exactly.

2. **Last-Modified unchanged.** The server's Last-Modified header has remained `Tue, 04 Feb 2025 16:57:32 GMT` across both fetches. Internal PDF metadata shows creation and modification dates of 2025-02-01. No indication of a revised edition.

3. **No new version markers.** The document references 2024 studies and the 2025 academic paper it's based on. There are no references to 2026, no version/edition numbers, and no supersession notice.

4. **Document type.** This is a general responsible-AI playbook for product managers, authored by BAIR/Stanford/Oxford researchers with Google funding. It is a research/guidance publication, not a UC Berkeley internal AI use policy. The UC Berkeley-specific policy content it contains is limited to brief case examples in "OL Play 2" (lines 2221–2243). The hash drift is likely an artifact of PDF re-generation (e.g., InDesign export metadata, embedded timestamps, or compression differences).

## Consequence

No staged artifact bundle created. No maintenance action required for this source URL. The existing evidence candidates (ev-university-of-california-berkeley-21, ev-university-of-california-berkeley-22) remain valid.
