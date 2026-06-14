# Maintenance Note: ahlia-university — assessment-manual source

**Maintenance run:** maintenance-2026-06-06T05-20-38-614Z
**Date:** 2026-06-06
**Entity:** ahlia-university
**Source URL:** https://www.ahlia.edu.bh/resources/assessment-manual/
**Signal type:** source_health_maintenance

## Findings

1. **Source URL still resolves** to the same final PDF:
   - `https://www.ahlia.edu.bh/cms4/wp-content/uploads/2024/07/SM19.23-AU-Assessment-Manual-V.6.pdf`
   - This matches the previously recorded `finalUrl` in snapshot `ahlia-university__ba6e92df35995a2d` (release `public-release-20260524-001`).

2. **No version change detected.** The PDF filename (`SM19.23-AU-Assessment-Manual-V.6.pdf`) and URL path remain unchanged since the last snapshot (fetched 2026-05-25). The Assessment Manual is Version 6.0 (UC/P 715/2024, approved 4 July 2024).

3. **No source relocation.** The resource page URL continues to redirect to the same PDF asset.

4. **No new policy content.** The Assessment Manual V6 was already fully captured in the prior run (`uapt-ahlia-university-20260519`). The AI-relevant content (Plagiarism section mentioning ChatGPT, AI-generated software under tacit personation, similarity tolerance table without explicit Gen AI column) was already recorded and scored at `aiRelevanceScore: 0.56`. The more specific AI policy language lives in the separate Academic Integrity Policy V2.0 (source candidate `sc-ahlia-academic-integrity-2025`), which already has the higher `aiRelevanceScore: 0.94`.

5. **Maintenance signal assessment:** No clear policy-content update, no source relocation, no repair needed. The signal reflects only metadata/chrome — the source is unchanged and healthy.

## Conclusion

**No artifact bundle created.** No directory under `staging/uapt-runs/` was created. Source remains valid; no action required until a version change or relocation is detected.
