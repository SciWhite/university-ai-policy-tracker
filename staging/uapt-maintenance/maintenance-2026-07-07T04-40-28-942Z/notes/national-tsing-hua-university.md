# Maintenance Note: national-tsing-hua-university

**Run:** maintenance-2026-07-07T04-40-28-942Z
**Entity slug:** national-tsing-hua-university
**Target source URL:** https://ctld.site.nthu.edu.tw/p/412-1217-20815.php?Lang=zh-tw
**Target source title:** 人工智慧、磨課師與數位學習 AI, MOOCs, and Digital Learning
**Verifier:** openclaw-agent (crawl-worker)

## Verdict: No policy-content update — metadata/chrome/noise only

The target source is an official NTHU Center for Teaching and Learning Development (CTLD) index page that catalogs AI, MOOCs, and digital-learning documents. It is a document listing/link index, not a policy-content page itself.

### Comparison summary

| Aspect | Old snapshot (2026-05-15) | Current (2026-07-07) | Change? |
|---|---|---|---|
| HTTP status | 200 | 200 | No |
| Page structure | CMS list/gallery index with 15 PDF links | Same CMS list/gallery index with 15 PDF links | No |
| AI-relevant PDF links | 712376723.pdf, 679599291.pdf, 0613...pdf, 664798971.pdf | Same 4 AI PDFs present | No |
| All PDF link filenames | 15 PDFs (see list below) | Same 15 PDFs | No |
| PDF link titles/labels | Same bilingual labels | Same bilingual labels | No |
| CSS cache-buster param | `?t=237dd1c7cb` | `?t=237dd1c7cb` | No (unchanged) |
| HTML body hash (raw) | `63a302208fe6bb202849b666a55dfae1ac28db6894bca0913311b6c1cf0dc432` | `4f1b27f3697c69fbe01d98427d8f8d61009e326980ecdd6049b9cc2538d76533` | Minor (likely dynamic nav/ads) |

The raw HTML hash differs slightly, but this is attributable to dynamic elements (banner image timestamp, session cookie checks, injected JavaScript timestamps, navigation state). **No policy-relevant content has changed.**

### Complete PDF link inventory (identical across snapshots)

1. `0613IntegratingEthicalGuidelinesforGenerativeAIintoNTHUCourseSyllabi.pdf` — AI syllabus ethics guidance
2. `664798971.pdf` — 清華教學大綱AIGC倫理聲明指引 (was previously rejected as low_policy_specificity)
3. `483675222.pdf` — 清華線上課程設計與發展五階段指引 (online course design)
4. `803298168.pdf` — 獎勵學生數位自學試行計畫 (digital self-learning)
5. `181850880.pdf` — 數位課程施行細則_20241204 (digital course execution)
6. `896901127.pdf` — 多元課程比較表 (course comparison table)
7. `753032438.pdf` — 磨課師課程實施要點 (MOOCs implementation)
8. `389383753.pdf` — 獎勵教師深化數位教學試行方案 (digital teaching incentive)
9. `679599291.pdf` — NTHU Guidelines for Collaboration, Co-learning, and Cultivation of AI Competencies (English)
10. `712376723.pdf` — 大學教育場域 AI 協作、共學與素養培養指引 (Chinese AI guidelines)
11. `211204799.pdf` — 多媒體素材授權契約 (multimedia license)
12. `273106300.pdf` — 著作財產權讓與契約 (IP assignment)
13. `794802897.pdf` — 圖書出版授權契約 (publishing license)
14. `366216836.pdf` — 遠距教學授權契約 (distance education license)
15. `579610690.pdf` — 數位學習教材授權契約 (e-learning content license)

### No artifact bundle created

There is no real policy-content update. The prior staged claims (announcement, transparency/responsibility, course AI rules, assessment guidance, syllabus AIGC options, etc.) remain supported by their original evidence and unchanged sources. No new artifact bundle was needed.

### No-blocker note

No issues preventing future maintenance; source remains accessible, stable, and on the same URL under the same domain (ctld.site.nthu.edu.tw).
