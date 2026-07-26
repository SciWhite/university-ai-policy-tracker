# Full Source Scan 2026-07-26: Repair Queues

Source: `.local/maintenance-runs/maintenance-2026-07-26T16-34-06-573Z` (mode `all`,
3071 targets, first full run of the calibrated scanner: soft-404 fingerprinting,
dead-link classification, JS-render escalation). This run also recorded the first
complete content-hash baseline (2647 sources), so the next scan can do real change
detection. Firecrawl was not enabled (no local `FIRECRAWL_API_KEY`); render-required
rows are queued, not resolved. These are maintenance metadata, not claim evidence.

| Queue | URLs | Claims affected | Priority |
| --- | ---: | ---: | --- |
| Dead links (404/410) | 39 | 81 | P1 relocate or deprecate |
| Suspected soft-404 | 11 | 12 | P1 verify + relocate |
| Render verification needed | 69 | 171 | P2 (13 new; rest have prior Firecrawl verification) |
| HTTP failed (transient/conn) | 142 | 231 | P3 retry from different network, then triage |
| Blocked (401/403/407/429) | 163 | 308 | P3 (7 new; rest have prior Firecrawl verification) |

## P1: Dead links (39 URLs, 81 claims)

- **texas-a-and-m-university** (21 claims)
  - `https://ai.tamu.edu/_files/_documents/tamu-cte-genai-syllabus-statement-considerations.pdf` (HTTP 404, 1 claims)
  - `https://ai.tamu.edu/learn-with-ai/index.html` (HTTP 404, 1 claims)
  - `https://ai.tamu.edu/teach-with-ai/detection.html` (HTTP 404, 1 claims)
  - `https://ai.tamu.edu/teach-with-ai/use-guidelines-and-ethics.html` (HTTP 404, 3 claims)
  - `https://www.it.tamu.edu/ai-services/ai-services-comparison.html` (HTTP 404, 3 claims)
  - `https://www.it.tamu.edu/ai-services/index.html` (HTTP 404, 12 claims)
- **manchester** (8 claims)
  - `https://www.staffnet.manchester.ac.uk/ai-hub/guidelines/` (HTTP 404, 8 claims)
- **tokyo-institute-of-technology** (6 claims)
  - `https://www.isct.ac.jp/plugins/cms/component_download_file.php?type=1&pageId=2886&contentsId=&contentsDataId=&prevId=&key=4901c445de3a749e41bcb8c8b6219bcf.pdf&fileName=%E6%9D%B1%E4%BA%AC%E7%A7%91%E5%AD%A6%E5%A4%A7%E5%AD%A6%20%E7%94%9F%E6%88%90AI%E5%88%A9%E7%94%A8%E3%82%AC%E3%82%A4%E3%83%89%E3%83%A9%E3%82%A4%E3%83%B3` (HTTP 404, 6 claims)
- **university-of-eastern-finland** (6 claims)
  - `https://kamu.uef.fi/en/accordions/38482-definition-of-artificial-intelligence-and-application-of-the-guidelines/` (HTTP 404, 1 claims)
  - `https://kamu.uef.fi/en/tietopankki/students-rights-and-obligations/the-use-of-ai-in-teaching-and-research/` (HTTP 404, 5 claims)
- **gazi-universitesi** (5 claims)
  - `https://aicenter.gazi.edu.tr/files/etik-ilkeler.pdf` (HTTP 404, 5 claims)
- **sultan-qaboos-university** (4 claims)
  - `https://elearn.squ.edu.om/pluginfile.php/2795003/block_html/content/Academic%20Integrity%20Guide%20for%20Students.pdf` (HTTP 404, 4 claims)
- **china-agricultural-university** (3 claims)
  - `https://yz.cau.edu.cn/art/2025/4/7/art_41482_1097933.html` (HTTP 404, 3 claims)
- **missouri-university-of-science-and-technology** (3 claims)
  - `https://it.mst.edu/ai/` (HTTP 404, 3 claims)
- **university-of-wyoming** (3 claims)
  - `https://uwyo.libguides.com/aisupport/faculty` (HTTP 404, 1 claims)
  - `https://uwyo.libguides.com/aisupport/student` (HTTP 404, 1 claims)
  - `https://uwyo.libguides.com/c.php?g=1376980&p=10185887` (HTTP 404, 1 claims)
- **mcgill-university** (2 claims)
  - `https://www.mcgill.ca/it/long-distance-authorization-code/ai-tools-mcgill` (HTTP 404, 2 claims)
- **east-china-university-of-science-and-technology** (2 claims)
  - `https://ecust.edu.cn/2024/0322/c729a178903/page.htm` (HTTP 404, 2 claims)
- **university-of-regina** (2 claims)
  - `https://ctl.uregina.ca/generative-ai-at-the-university-of-regina` (HTTP 404, 2 claims)
- **national-taiwan-university** (1 claims)
  - `https://emha.coph.ntu.edu.tw/uploads/law/tw/%E5%81%A5%E7%AE%A1%E6%89%80%E6%95%99%E5%AD%B8%E7%A0%94%E7%A9%B6%E8%A1%8C%E7%82%BA%E5%AE%88%E5%89%87-20250512%E7%99%BC%E5%B8%83.pdf` (HTTP 404, 1 claims)
- **trinity-college-dublin-the-university-of-dublin** (1 claims)
  - `https://www.tcd.ie/media/tcd/academic-practice/pdfs/college-statement-on-genai.pdf` (HTTP 404, 1 claims)
- **washington-university-in-st-louis** (1 claims)
  - `https://it.wustl.edu/2025/02/specific-guidance-on-the-use-of-generative-ai-deepseek/` (HTTP 404, 1 claims)
- **university-of-california-santa-barbara** (1 claims)
  - `https://www.writing.ucsb.edu/resources/faculty/ai-policy` (HTTP 404, 1 claims)
- **albert-ludwigs-universitaet-freiburg** (1 claims)
  - `https://www.ub.uni-freiburg.de/unterstuetzung/einfuehrungen-und-kurse/ki-im-studium/` (HTTP 404, 1 claims)
- **american-university** (1 claims)
  - `https://kogod.american.edu/news/kogod-school-of-business-partners-with-perplexity-to-expand-ai-access-for-all-students` (HTTP 404, 1 claims)
- **julius-maximilians-universitat-wurzburg** (1 claims)
  - `https://www.rz.uni-wuerzburg.de/fileadmin/42000000/2025/JMU_IT-Servicekatalog_2025.pdf` (HTTP 404, 1 claims)
- **middlesex-university** (1 claims)
  - `https://libguides.mdx.ac.uk/AI/referencing` (HTTP 404, 1 claims)
  - `https://libguides.mdx.ac.uk/c.php?g=721259&p=5304256` (HTTP 404, 0 claims)
- **ulsan-national-institute-of-science-and-technology-unist** (1 claims)
  - `https://news.unist.ac.kr/unist-releases-generative-ai-utilization-guide-to-promote-smart-usage-of-chat-gpt/` (HTTP 404, 1 claims)
- **universite-claude-bernard-lyon-1** (1 claims)
  - `https://icap-formations.univ-lyon1.fr/mod/data/view.php?d=4&rid=207` (HTTP 404, 1 claims)
- **university-of-bordeaux** (1 claims)
  - `https://enseigner.u-bordeaux.fr/outils-et-ressources/IAG` (HTTP 404, 1 claims)
- **university-of-guelph** (1 claims)
  - `https://guides.lib.uoguelph.ca/ld.php?content_id=38392344` (HTTP 404, 1 claims)
- **university-of-miami** (1 claims)
  - `https://petal.miami.edu/teaching-guides-and-policies/teaching-and-learning-with-ai/index.html` (HTTP 404, 1 claims)
- **university-of-salento** (1 claims)
  - `https://www.unisalento.it/it/studenti/offerta-formativa/corsi-internazionali/-/dettaglio/insegnamento/221147/digital-accounting-e-auditing` (HTTP 404, 1 claims)
- **university-of-texas-at-dallas** (1 claims)
  - `https://oit.utdallas.edu/about/gen-ai/` (HTTP 404, 1 claims)
- **vrije-universiteit-brussel-vub** (1 claims)
  - `https://www.vub.be/sites/default/files/2025-07/2025_Reglementen_OER_2025-2026_ENG.pdf` (HTTP 404, 1 claims)
- **korea-university** (0 claims)
  - `https://ctl.korea.ac.kr/ctl/about/notice-common.do?articleNo=805534&attachNo=311772&mode=download&totalBoardNo=&totalNoticeYn=` (HTTP 404, 0 claims)
- **universitat-heidelberg** (0 claims)
  - `https://www.heiskills.uni-heidelberg.de/de/ueber-uns/lehren-und-lernen/fuer-lehrende/kuenstliche-intelligenz-in-der-lehre` (HTTP 404, 0 claims)

Repair rule: same-domain site search / redirect discovery first (see
`docs/crawler-policy.md` link-health calibration); deprecate claims only when the
content is confirmed gone. Known relocations from the 2026-07-26 spot-check:
`libguides.mdx.ac.uk/AI/*` moved to new subpages (e.g. `/AI/mdxaiusage`) after the
2026-07-24 guide restructure; `kamu.uef.fi` content likely moved within the site.

## P1: Suspected soft-404 (11 URLs, 12 claims)

- **university-of-hong-kong**: `https://its.hku.hk/services/research-computing/artificial-intelligence-ai/`
  - final URL: `https://hpc.hku.hk/ai/` (1 claims)
- **university-of-toronto**: `https://www.viceprovostundergrad.utoronto.ca/16072-2/teaching-initiatives/generative-artificial-intelligence/`
  - final URL: `https://www.vptl.utoronto.ca/` (1 claims)
- **georgia-institute-of-technology**: `https://ctl.gatech.edu/resources/syllabus/policies`
  - final URL: `https://ctl.gatech.edu/policies/` (1 claims)
- **michigan-state-university**: `https://teachingcenter.msu.edu/teaching-resources/guidance-on-gen-ai-in-instructional-settings`
  - final URL: `https://ai.msu.edu/` (0 claims)
- **universitas-indonesia**: `https://ppid.ui.ac.id/wp-content/uploads/2025/09/V2DAFT1.pdf`
  - final URL: `https://ppid.ui.ac.id/` (0 claims)
- **addis-ababa-university**: `https://www.aau.edu.et/news/detail?title=AAU~Launches~Orientation~for~Incoming~Students,~Emphasizes~Academic~Discipline`
  - final URL: `https://www.aau.edu.et/news/detail?title=AAU~Launches~Orientation~for~Incoming~Students,~Emphasizes~Academic~Discipline` (1 claims)
- **la-trobe-university**: `https://www.latrobe.edu.au/mylatrobe/using-artificial-intelligence-ai-responsibly/`
  - final URL: `https://www.latrobe.edu.au/mylatrobe/using-artificial-intelligence-ai-responsibly/` (0 claims)
  - triage: Final URL equals source; tombstone wording matched in body. Manual check needed.
- **stellenbosch-university**: `https://libguides.sun.ac.za/education/AI`
  - final URL: `https://libguides.sun.ac.za/c.php?g=1497969&p=11190973` (1 claims)
  - triage: Likely false positive: LibGuides canonical rewrite to c.php?g=... serves the same guide.
- **university-of-szeged**: `https://u-szeged.hu/oktig/mesterseges/mi-tmutato-szte-hallgato`
  - final URL: `https://u-szeged.hu/download.php?docID=173902` (4 claims)
  - triage: Redirects to download.php PDF endpoint; verify content, then update URL if stable.
- **university-of-szeged**: `https://u-szeged.hu/oktig/mesterseges/mi-tmutato-szte-oktato`
  - final URL: `https://u-szeged.hu/download.php?docID=173903` (1 claims)
  - triage: Redirects to download.php PDF endpoint; verify content, then update URL if stable.
- **west-virginia-university**: `https://academicintegrity.wvu.edu/files/d/6f4a1587-ff74-4a15-a2b6-19abcd20c4cb/ai-student-faq.pdf`
  - final URL: `https://provost.wvu.edu/academic-integrity/` (2 claims)

Confirmed relocation from the spot-check: HKU research-computing AI page now lives
at `https://hpc.hku.hk/ai/`. LibGuides `c.php` rewrites are canonical-URL noise, not
removals; a scanner refinement should treat same-host `c.php`/`download.php` targets
as `url_normalization` rather than deep-link collapse.

## P2: New render-verification rows (no prior Firecrawl verification)

- **university-of-chicago**: `https://genai.uchicago.edu/` (1 claims)
- **university-of-chicago**: `https://genai.uchicago.edu/about/generative-ai-guidance` (5 claims)
- **university-of-chicago**: `https://genai.uchicago.edu/about/relevant-policies-for-the-use-of-ai-tools` (4 claims)
- **snu**: `https://health.snu.ac.kr/?kboard_content_redirect=5406` (2 claims)
- **duke-university**: `https://myresearchpath.duke.edu/using-generative-ai-artificial-intelligence-tools-research` (1 claims)
- **city-university-of-hong-kong**: `https://www.cityu.edu.hk/GenAI/guidelines.htm` (1 claims)
- **hanyang-university**: `https://aiguide.hanyang.ac.kr/ethics/precaution` (3 claims)
- **hanyang-university**: `https://aiguide.hanyang.ac.kr/guide/ai-guide` (1 claims)
- **syracuse-university**: `https://library.syracuse.edu/blog/Generative-Artificial-Intelligence-in-the-Libraries/` (1 claims)
- **universidade-federal-do-rio-de-janeiro**: `https://drive.google.com/file/d/1URmmGBDwR5vKudskAzrUKZWHll16j5p1/view?usp=sharing` (2 claims)
- **university-of-aveiro**: `https://www.ua.pt/pt/inovacaopedagogica/academia` (3 claims)
- **university-of-engineering-and-technology-uet-lahore**: `https://admission.uet.edu.pk/privacypoliy.html` (2 claims)
- **university-of-jordan**: `https://engineering.ju.edu.jo/Lists/Courses/Attachments/883/CHE-0905585-Application%20of%20Artificial%20Intelligence%20in%20Chemical%20Engineering-Sep-2025-Fall.pdf` (1 claims)

The remaining 56 render rows already carry Firecrawl verification metadata in the
public source-health dataset; re-verify on the normal cadence once a Firecrawl key is
configured (`FIRECRAWL_API_KEY` is currently absent on both the dev Mac and the
production host, and the `docs/maintenance-oci-runbook.md` OpenClaw host with the key
does not exist on the current production machine).

## P3: New blocked rows (no prior Firecrawl verification)

- **university-of-oxford**: `https://www.it.ox.ac.uk/article/university-ai-provision-2026` (HTTP 403, 1 claims)
- **queens-university-belfast**: `https://www.qub.ac.uk/Research/Governance-ethics-and-integrity/Research-integrity/ArtificialIntelligence/` (HTTP 403, 1 claims)
- **brandeis-university**: `https://www.brandeis.edu/its/software-systems/ai-tools/index.html` (HTTP 403, 3 claims)
- **doshisha-university**: `https://it.doshisha.ac.jp/files/joki/page/Soft_MS_t.pdf` (HTTP 403, 2 claims)
- **la-trobe-university**: `https://www.latrobe.edu.au/library/guides/learning-guides/achieve@uni/artificial-intelligence-ai` (HTTP 403, 1 claims)
- **university-of-porto**: `https://www.up.pt/portal/documents/2090/Codigo_Etica_2026.pdf` (HTTP 403, 3 claims)
- **university-of-porto**: `https://www.up.pt/portal/pt/updigital/software/sistemas-inteligencia-artificial-generativa/` (HTTP 403, 2 claims)

## P3: HTTP failure breakdown (retry before triage)

- connection-level `fetch failed`: 98 (includes hosts that reset bot connections, e.g. cityu.edu.hk)
- timeout aborted: 14
- HTTP 405: 10, 503: 10, 500: 6, 412: 4

Retry these from the OCI host or via Firecrawl before treating them as unhealthy;
a single Mac-side scan cannot distinguish bot-blocking from real outages.

Machine-readable copy: `knowledge/crawl-runs/full-source-scan-20260726-repair-queues.json`.

## Resolution (2026-07-27)

Firecrawl recheck + relocation discovery closed the P1 queues in release
`public-release-20260727-014`:

- 20 of 50 P1 URLs were false deaths: bot-conditional 404s or render-only
  pages, all alive via rendered fetch. Recorded in
  `data/source-health/firecrawl-blocked-source-checks-20260727.json` (the
  review dashboard now merges all dated check files).
- 25 URLs were relocated with fetched-content verification and rewritten
  across 29 staged runs (snapshot hashes and retrievedAt unchanged; only the
  rotted pointers moved). Notable: Manchester AI Hub restructure, CAU grad
  school move to gradsch1.cau.edu.cn, TCD GenAI statement v2 (2026), VUB OER
  re-upload, Wyoming/Middlesex LibGuide renames.
- 4 sources left the public web with no citable replacement: WashU DeepSeek
  advisory (removed), Miami PETAL AI guide (moved behind SharePoint sign-in),
  SQU academic integrity guide PDF, Gazi ethics PDF. Their 11 claims are now
  `needs_review` pending re-sourcing or deprecation.
- 1 low-value URL (Middlesex deleted guide, no claims attached) was left as-is.

Remaining open queues: 13 new render-verification rows, 7 new blocked rows,
142 HTTP-failure retries (run from OCI or via Firecrawl on the normal cadence).

## Queue clearing (2026-07-27, Firecrawl)

The remaining P2/P3 queues were recleared with rendered fetches
(`data/source-health/firecrawl-blocked-source-checks-20260727b.json`, 218 URLs:
all render-verification and HTTP-failure rows plus the 7 new blocked rows):

- 161 verified alive (74%) — plain-HTTP failures were bot-conditional or
  render-related, not real outages; zero newly dead URLs found.
- 10 opened with little extractable content — manual check queue.
- 47 rendered fetches also failed — retry queue (many are hosts that also
  block Firecrawl's egress; retry from OCI or on the next scan cadence).

Re-sourcing outcomes for the four gone-from-public-web sources are recorded in
release `public-release-20260727-015`: Gazi re-sourced from the 2026 usage
guide (3 claims, 5 deprecated), Miami re-sourced verbatim from the public UM
Libraries guide (1 claim, 1 deprecated), WashU DeepSeek claim deprecated
(general guidance already covered), SQU held at needs_review pending a human
decision on the scanned off-domain replacement document.
