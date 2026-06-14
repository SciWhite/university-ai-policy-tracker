# Maintenance Note: osaka-metropolitan-university

**Maintenance run:** maintenance-2026-06-06T05-20-38-614Z
**Date:** 2026-06-06
**Reviewer:** openclaw-crawl-worker

## Target Source

- **Source URL:** https://www.omu.ac.jp/lit/soc/assets/AI%20Guidelines_202403.pdf
- **Source title:** 生成AIの利活用に関する学生向けガイドライン
- **Source type:** university_guidance (student guideline PDF)

## Result: No policy-content change

### Evidence

1. **PDF still live at original URL.** HTTP 200, `application/pdf`, 1 841 761 bytes — identical content-length to the existing snapshot record (`contentLength: 1841761`).

2. **PDF binary hash differs but extracted text matches.** New SHA-256 (`efda7818…`) differs from the stored snapshot hash (`20af6c5d…`), but after normalising whitespace, the extracted text from the fresh download is character-identical to the existing `normalized.md` (normalised length 3 929 chars each; `normalized_match=true`). The ~1-byte raw length delta is a whitespace/extraction artifact, not a content change.

3. **Document metadata unchanged.** Same 9 pages, same title line (生成AIの利活用に関する 学生向けガイドライン 2024年3月4日 DX戦略会議), same section structure (基本的な考え方 / 活用方法 / 禁止事項 / 相談 / 注意事項).

4. **Secondary source (faculty guide) also unchanged.** `https://www.omu.ac.jp/las/highedu/publication/generative_ai/index.html` still returns 200 with the same 2023/5/11 version title and content.

### Classification

- **Not a policy-content update.** The binary hash difference is attributable to PDF-level metadata or re-serialisation, not to any change in policy text, structure, or scope.
- **Not a source relocation.** URL is unchanged and live.
- **Not a source repair candidate.** No broken links, no new public superseding document found.

### Action

- No artifact bundle created under `staging/uapt-runs/`.
- No claim/evidence changes needed.
- Existing snapshot and artifact records remain valid.
