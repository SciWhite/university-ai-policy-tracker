# KU Leuven — Maintenance Note: maintenance-2026-07-07T04-40-28-942Z

**Target entity:** ku-leuven
**Target source:** https://www.kuleuven.be/english/education/leuvenlearninglab/support/genai/responsible-use-of-generative-ai-in-our-education
**Source title:** Responsible use of Generative AI in our education
**Previous run:** uapt-ku-leuven-20260512 (sourceCandidate: sc-kul-teaching-genai)
**Maintenance scan:** 2026-07-07T04:46 UTC
**Manual review:** 2026-07-07T13:08 UTC

## Verdict: No policy-content update — metadata/chrome update only

**Source health:** HTTP 200, accessible, same URL, same title. Not relocated. Not degraded.

**Signal source:** Content hash changed (`7ababb8b...` → `17b6a7a3...`); `lastModified: Mon, 06 Jul 2026`.

## What changed (metadata/chrome)

1. **Academic-year scope expanded.** The banner now reads "Academic Year 2025-2026 (Third Examination Period) **and 2026-2027**" (previously just "2025-2026 academic year"). This is the annual rollover extending applicability into the new academic year starting September/October 2026.

2. **New reference to a summary presentation.** A line was added: "View the summary presentation on Sharepoint for a clear overview of the **changes to the guidelines for 2026-2027**", with English and Dutch PPTX download links pointing to the KU Leuven Learning Lab Sharepoint.

3. **OER regulation link.** The hyperlink for "article 84 of the Education and Examination Regulations" now targets the 2025 regulations path. (The underlying regulation text reference is unchanged.)

## What stayed the same (core policy content)

All three substantive guidance principles are **textually identical** to the May 2026 snapshot:

- **Principle 1:** Teaching staff must clearly inform students about GenAI use permission for assignments.
- **Principle 2:** Students must be transparent about GenAI use so assessment is fair and correct.
- **Principle 3:** Non-transparent GenAI misuse can be an irregularity under Article 84 of the OER.

The "applies to whole university" caveat and the Sources section are unchanged.

## Assessment

This is an annual administrative rollover. The policy guidance itself has not changed. The new presentation link (PPTX) references "changes to the guidelines for 2026-2027," but the summary presentation has not been fetched — it is a Sharepoint-hosted PPTX, not a text-based policy page. If the presentation contains new policy positions (not just a reformatting of existing rules), a follow-up review of that PPTX could be warranted, but that is beyond the scope of this lightweight source-health review.

## Recommendation

- **No artifact staging.** Core policy claims remain valid; no evidence snippets need updating.
- **No canonical-claim changes.**
- **Optional:** A deep-dive extraction of the Sharepoint PPTX could be queued separately if the tracker wants to capture any AY 2026-2027 policy refinements beyond what the HTML page states. Not blocking for current release.

## Reviewer

openclaw_agent/agent_reviewed — 2026-07-07T13:08Z
