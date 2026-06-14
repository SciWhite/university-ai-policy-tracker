# Maintenance Note: kaunas-university-of-technology

**Maintenance run:** maintenance-2026-06-06T05-20-38-614Z
**Date:** 2026-06-06
**Source URL:** https://aicentre.ktu.edu/
**Decision:** No policy-content update

## Findings

- **Source reachable:** Yes (HTTP 200, final URL unchanged at `https://aicentre.ktu.edu/`)
- **Core policy text unchanged:** The "About us" section and key functions list remain identical to the prior normalized snapshot (`c50e43be9b7032d7`, fetched 2026-05-24). The critical snippet — *"The KTU Artificial Intelligence Excellence Centre shapes the University's AI development directions and coordinates related activities… Developing and controlling policies for the development of AI at the University"* — is verbatim the same.
- **dateModified signal:** JSON-LD shows `dateModified: 2026-06-03T13:47:26+00:00`, indicating a CMS-level page update since the prior snapshot (2026-05-24). This likely reflects a news-item rotation or minor CMS refresh.
- **No new policy links:** No new hrefs containing "policy", "guideline", "ethic", "rule", "ai-use", or "chatgpt" were found beyond the existing GenAISA project link.
- **News rotation only:** News items shifted (e.g. "NUTRIFEEDS partners" now shows "3 months ago" instead of "2 months ago"; no new policy-related headlines appeared).
- **No new AI use/governance content:** No mentions of "guidelines", "restrictions", "prohibitions", "ban", "code of", "ethics", or "rules" outside the previously tracked "Developing and controlling policies" function statement.

## Conclusion

The dateModified signal is metadata/chrome noise — a CMS refresh with no policy-content delta. No artifact bundle is warranted. Prior staged claims (`claim-ktu-ai-centre-policy-function`, `claim-ktu-general-academic-integrity`) remain current.
