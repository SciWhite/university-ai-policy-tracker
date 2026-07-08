# Maintenance Note: queens-university-belfast

**Run ID:** maintenance-2026-07-07T04-40-28-942Z
**Entity:** Queen's University Belfast (`queens-university-belfast`)
**Target source URL:** https://blogs.qub.ac.uk/digitallearning/ai/
**Reviewer:** codex-maintenance-worker
**Decided at:** 2026-07-07T12:53:00Z

## Verdict: No policy-content update — noise only

**Source status:** Live, HTTP 200, no relocation. All known sub-pages (position on AI, using AI, responsible use, assessment, student support, research guidance) return HTTP 200.

**Extraction comparison:**
- Previous snapshot (2026-05-15): ~4506 bytes normalized text (navigation links, guides, featured resources, welcome paragraph)
- Current fetch (2026-07-07): ~850 raw chars (welcome paragraph + contact email only)

**Cause:** Readability extraction artifact. The AI Hub landing page is built on WordPress + Elementor with Premium Addons for navigation (confirmed by 306KB raw HTML). The readability/HTML-extract pipeline now returns less visible text from the Elementor-rendered blocks, but the underlying page has not materially changed. Schema.org structured data confirms `dateModified: 2026-02-09`, which predates the prior snapshot — no fresh content update occurred.

**Policy content check:** No changes to the documented claim candidates. The RAISE principles, Copilot guidance, public-data tools disclaimer, ethical data submission guidance, assessment/academic-integrity stances, AI-detector caution, student AI resources, and responsible-research-AI guidance remain substantiated by the existing staged artifacts (`uapt-queens-university-belfast-20260515`).

## Action taken

- Maintenance note written only (this file)
- No artifact bundle created under `staging/uapt-runs/` — no policy-content update or source repair candidate to capture
- Existing staged artifacts remain valid; no new claims or evidence required
