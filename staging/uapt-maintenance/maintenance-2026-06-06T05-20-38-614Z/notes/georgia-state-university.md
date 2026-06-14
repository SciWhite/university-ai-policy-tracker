# Maintenance Note: georgia-state-university

**Maintenance run:** maintenance-2026-06-06T05-20-38-614Z
**Date:** 2026-06-06
**Target source URL:** https://cetloe.gsu.edu/teaching-advancement/artificial-intelligence-ai/
**Review type:** source_health_maintenance (single-source lightweight)

## Finding: No policy-content update

The CETLOE "AI in Teaching and Learning" page at `https://cetloe.gsu.edu/teaching-advancement/artificial-intelligence-ai/` was re-fetched and compared against the staged content from run `uapt-georgia-state-university-20260519` (source candidate `sc-gsu-cetloe-ai-teaching`, snapshot `ss-gsu-cetloe-ai-teaching`, contentHash `842b35c76356e2e3bb6ff1d04bd93713a1d337f9c4647dac2a1f3b17e8c8c228`).

### Claim evidence verification

Both existing claim evidence snippets are preserved verbatim on the live page:

1. **claim-gsu-instructor-ai-boundaries** — "As the instructor, you set the boundaries for how students can use generative AI tools like ChatGPT, Google Gemini, or Microsoft Copilot in your course. Since AI expectations may vary between different types of assignments, it's important to provide specific guidance for each graded item." → **intact**
2. **claim-gsu-unauthorized-genai-misconduct** — "Unauthorized use or insufficient attribution of GenAI may constitute academic misconduct under the university's Policy on Academic Honesty." → **intact**

### Substantive content comparison

The live page policy-relevant sections — AI and Academic Integrity, Syllabus Statement (including AI Assessment Scale reference and credential-sharing prohibition), Key Issues to Consider (integrity, credential sharing, career relevance, protected information), Practical Tips, Additional Resources, AI Initiatives (BoodleBox pilot, Catalyst), AI Tools, Chatbots for Teaching, and AI Events — are all substantively identical to the previously captured normalized snapshot.

The contentHash mismatch between the live fetch and the stored snapshot is attributable to normalizer differences (Firecrawl vs. web_fetch readability extractor) and minor chrome/formatting noise, not to policy-content changes.

### Decision

**No artifact bundle created.** No directory created under `staging/uapt-runs/`. The source URL remains valid, accessible, and policy-content-stable since the last staging run.

### Source health metadata (not claim evidence)

- HTTP status: 200
- robots.txt: no restrictions on this public CETLOE guidance path
- URL stable: no redirect or relocation detected
- Title: "Artificial Intelligence in Teaching and Learning" (unchanged)
- Source type: teaching_guidance (unchanged)
