# Maintenance Note: university-of-helsinki
**Date:** 2026-07-07
**Run:** maintenance-2026-07-07T04-40-28-942Z
**Target source URL:** https://helpdesk.it.helsinki.fi/en/instructions/information-security-and-cloud-services/cloud-services/generative-ai-university
**Target source title:** Generative AI at the University
**Existing snapshot hash:** f84abbd1cd7c2ac590de45196bc184eedd35dede6c7463d17b33dda7d57ef655 (2026-05-14)

## Decision: No policy-content update

The live source was fetched and compared with the existing snapshot (public-release-20260524-001, snapshot `b0e69c0d383d4211`). All core policy passages are substantively unchanged:

- **Supported tools:** University still lists Microsoft Copilot (commercial data protection) and CurreChat as the two general-purpose GenAI solutions.
- **Data boundaries:** Copilot for public/open data only, no personal data; CurreChat for public/open/internal but not confidential/secret.
- **External AI services:** University does not support or recommend external AI services (ChatGPT, Google Gemini, etc.) for university work; users who do so act as private individuals.
- **Kontra translation service:** Still listed as a university-hosted machine translation service for work documents.
- **FAQ section:** All 7 FAQ questions present with identical policy framing.
- **"Hallucinate" warning:** Still present — user is responsible for verifying AI-generated outputs.

The observed SHA-256 difference between the live extraction and the snapshot normalized text is attributable to:
1. Different text extraction tools (readability-markdown now vs. firecrawl during original snapshot)
2. Navigation chrome and footer updates (e.g. "Follow us" links, feedback form URLs)
3. Whitespace normalization differences

No source relocation, no URL change detected. The page URL resolves to the same final URL with HTTP 200.

## Actions taken

- [x] Repo refreshed (git pull --ff-only, already up to date)
- [x] Existing public/staged data inspected (5 sources for this entity)
- [x] Live source fetched and compared
- [x] No artifact bundle created (no policy-content update)

## Next steps

- No further action required for this source at this time.
- Recommend re-checking on next scheduled maintenance cycle.
