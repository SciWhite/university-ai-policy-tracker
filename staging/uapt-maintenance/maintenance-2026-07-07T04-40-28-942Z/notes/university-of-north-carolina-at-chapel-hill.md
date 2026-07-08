# Maintenance Note: university-of-north-carolina-at-chapel-hill

**Run:** maintenance-2026-07-07T04-40-28-942Z
**Target source:** https://ai.unc.edu/ai-guidance-for-faculty/
**Previous artifact:** staging/uapt-runs/uapt-university-of-north-carolina-at-chapel-hill-20260514
**Checked at:** 2026-07-07T13:27:37Z

## Hash Comparison

| Field | Previous (2026-05-14) | Current (2026-07-07) | Changed? |
|---|---|---|---|
| Content hash | `2e373948ed876e8ace7da6bd84ba95c4ca94ef56ed402524e0afa9e226cc7caa` | `80792f939e8ba562639e35340cd6aa60b9670223aee17594ae2dabe4d866d05b` | Yes |
| Page title (HTML \<title\>) | "Developing AI Guidance for Faculty - Generative AI at UNC" | "Developing AI Guidance for Faculty - AI at UNC" | Yes — metadata rebrand |
| HTTP status | 200 | 200 | No |
| Final URL | https://ai.unc.edu/ai-guidance-for-faculty/ | https://ai.unc.edu/ai-guidance-for-faculty/ | No |
| robots allowed | Yes | Yes | No |

## Observed Changes

1. **Site title rebrand:** The "Generative AI at UNC" suffix in the HTML `<title>` was shortened to "AI at UNC". This is a site-wide metadata change, not a policy-content change.
2. **Chrome additions:** A "Join the AI Community" promotional link and an environmental sustainability footnote were added near the page footer. These are peripheral, not policy guidance.
3. **Footer year:** Appears to read "© 2026" (consistent with current year; not a content change).

## Core Content Assessment

The three-step faculty guidance structure (Step 1: Reflection questions, Step 2: AI usage levels, Step 3: Syllabus language) is **unchanged**. All four AI usage levels (No AI Use / Assistive AI Use Only / Partial Generative AI Use / Full Generative AI Use) and their descriptions are **verbatim the same**. The "Carolina students are expected to follow these AI guidelines" syllabus starter language (including the five bullet points and the "check with me" admonition) is **unchanged**. The sample syllabus table with assignment-level AI use designations is **unchanged**.

The key evidence snippet underpinning claim `cl-unc-faculty-course-ai-guidance`:

> "Conveying your stance on students' use of AI in your course is important; it clarifies your expectations and ensures that any use of AI supports rather than frustrates your learning objectives."

…remains present and unmodified.

## Maintenance Decision

**No policy-content update detected.** The hash difference is attributable to the site-title rebrand and the addition of non-policy chrome elements (community promotion and sustainability footnote). All existing staged claims (`cl-unc-faculty-course-ai-guidance`) remain valid and supported by the current source content.

**Action:** No artifact bundle created. No validation needed. Existing staged artifact at `staging/uapt-runs/uapt-university-of-north-carolina-at-chapel-hill-20260514` remains current for this source URL.

## Reviewer

- **Checked by:** openclaw_agent (maintenance worker)
- **Review timestamp:** 2026-07-07T13:27:37Z
- **Verdict:** source_healthy — no action required
