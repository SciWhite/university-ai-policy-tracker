# Maintenance Note: University of Sussex — AI and academic integrity

**Maintenance run:** maintenance-2026-06-06T05-20-38-614Z
**Entity slug:** university-of-sussex
**Source URL:** https://staff.sussex.ac.uk/teaching/enhancement/support/artificial-intelligence/academic-integrity
**Source candidate ID:** src-sussex-ai-academic-integrity
**Reviewed at:** 2026-06-06T20:48Z
**Decision:** no-change (no real policy-content update)

## Summary

Live fetch (2026-06-06, HTTP 200) of the Sussex "AI and academic integrity" staff guidance page shows **no substantive policy-content change** compared to the existing snapshot from the 2026-05-16 initial crawl and 2026-05-24 public release snapshot.

## Observed differences (all noise/chrome, no policy-content change)

1. **Normalization artifacts**: The existing normalized.md snapshot is a single-line flattened extract (no newlines, HTML entities like `&rsquo;` and `&mdash;` un-resolved, navigation chrome included inline). The live web_fetch extracts structured markdown with resolved entities and stripped navigation. These are extraction-format differences, not source-content changes.

2. **Two minor link updates** (metadata/chrome, not policy content):
   - Skills Hub link updated from a bare text reference to a proper hyperlink: `https://www.sussex.ac.uk/skills-hub/writing-and-assessments/ai#module` — this is the same target page with an added anchor fragment; no content change.
   - "baseline position" link in the prohibited-AI module statement now points to `https://sussexstudent.com/support/academic-misconduct` (Sussex Students' Union) instead of the previous unlinked inline text. This is a navigation/CMS update to an external reference, not a policy-position change.

3. **One CMS artifact**: A local-file-path leak (`file:///C:/Users/kc578/Downloads/AI%20and%20Academic%20Integrity%20AUGUST%202025.docx#_msocom_1`) appears in the live page HTML alongside the "Declaration of Artificial Intelligence Use" cover sheet text. This is a Word comment anchor erroneously published to the CMS; the snapshot has clean text without the artifact. This is a CMS error, not a policy update.

4. **Cover sheet reference updated**: The existing snapshot references a generic "Here's one example cover sheet" link; the live page now points to `https://sussex.box.com/s/7f5u1t7vk9gwezecdvt0alfb5k5xke3v`. The acknowledgment template text and the "Acknowledge, Describe, Evidence" framework remain identical. This is a resource-link update, not a policy-position change.

## Core policy content — unchanged

All key policy elements are substantively identical between snapshot and live page:

- Three-tier AI permission model (prohibited / assistive / integral) — unchanged
- Module convenor determines AI use level per assessment — unchanged
- Canvas-based communication requirement (assessment + module level statements) — unchanged
- Student acknowledgment/declaration requirements and template — unchanged
- Prohibition on submitting student work to unlicensed AI detection tools — unchanged
- Guidance on handling suspected illicit AI use (mark on criteria, do not accuse without proof) — unchanged
- Baseline position: AI use prohibited unless explicitly permitted by module convenor — unchanged

## Outcome

No artifact bundle created. No directory created under `staging/uapt-runs/`. The detected differences are link/chrome/CMS-noise only; none constitute a real policy-content update, source relocation, or source repair candidate.
