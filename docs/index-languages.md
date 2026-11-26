# Languages a school page is indexed in

Rule (owner, 2026-11-23; AGENTS.md "Locales"). A school page is indexed (robots, hreflang, sitemap)
in:

1. **English**, always.
2. **Simplified Chinese** (`/zh/`), for every school; what must be Chinese depends on the tier (below).
3. **The school's own language**, when complete accepted prose exists in it. The institution's language
   wins over its place: Université de Montréal → French; McGill and Concordia → none (English);
   Åbo Akademi → Swedish; Université Saint-Joseph (Beirut) → French; University of Ottawa → French.
   Otherwise the region, then the country (`apps/web/lib/school-languages.ts`).

It does not depend on the tier (base or full V6). One function decides:
`universityReadingIndexLocales` (`apps/web/lib/university-reading-metadata.ts`).

| Content | Indexed when |
|---|---|
| `zh`, base tier | always (unchanged; its prose is English, see below) |
| `zh`, full V6 | the published V6 view passes the pipeline's G3 rule (`apps/web/lib/v6-zh-coverage.ts`, shared with `scripts/v6-pipeline/locale-gate.ts`), or the accepted zh reading package covers every display string |
| own language, any tier | the accepted reading package covers every display string for the current record |
| languages the reviewed registry adds | registry + exact record hash + complete package, as before |

**What "Chinese" means on an indexed `/zh/` page** (reviewer's measurement, 2026-11-23; tracker text only,
official quotations and source titles excluded):

- The V6 schools decided by a reading package (112; 108 have a published view): the display strings the
  package gate checks are Chinese. Median English tracker words in the claim cards: 0. Excluded or held
  public records stay English on some pages (Uppsala, MIT's held claims).
- The 71 V6 schools decided by their own view (batches 1-7 and Wuhan): topic cards, Do/Don't, evidence
  summaries and tool descriptions, access and cost notes are Chinese. Claim cards and gaps are English:
  median 276 English words in the claim cards (UBC 2,270, Manchester 1,257, Caltech 1,113) and 395 in gaps.
  `ZH-COVERAGE.md` counted only the G3 rows, so its "0 real gaps" does not cover these.
- The 632 base schools: Chinese interface, English record prose. They were indexed before and are unchanged.

Own-language pages are indexed only when the reading package covers every display string it checks.
Titles, descriptions, tool-context notes, source-metadata notes and excluded records can still be
English there (seen on Aalto, KTH, Qatar, Copenhagen and KFUPM). Chinese is looser, as above. The owner
asked for Chinese pages to be indexed (2026-11-23, speech to text: "是的，绿叶也应该那个，嗯、进行收录…",
answering whether to hold batch 8 and fix Chinese indexing first). Whether the 71 should wait until
their claim cards and gaps are translated was put to the owner the same day; the code indexes them.
Translating them, or the base records, is content work; no rule here does it.

## The problem found on 2026-11-23

A base-tier school was indexed in English and Chinese. A full V6 school was indexed only in the
languages of the reviewed registry (`locale-index/university-locale-index-policy.json` in the content
release), and **no pipeline step writes that registry**. So each base → full upgrade dropped `/zh/`,
and the region and institution rules above (Montréal included) never applied to V6 schools.

Measured on `c-20261122-v6-wuhan-r2`. "Before" is the old code on a local copy of that release; it
gives the same counts as the public sitemaps.

| | Before | After |
|---|---:|---:|
| V6 schools indexed in zh | 13 / 183 | 183 / 183 |
| Base schools indexed in zh | 632 / 632 | 632 / 632 |
| Other-language school pages | 53 | 68 |
| Languages lost by any school | | 0 |

- The registry has 132 schools, 18 of them with zh; 51 V6 schools were not in it.
- Update-mode batch 7 rewrote the V6 display text of its 20 schools, so their older reading packages no
  longer cover it (Peking 584 of 625 strings missing, CUHK 359 of 370, Stanford 333 of 345, PSL 253 of
  264). The records and registry hashes still match; updating hashes would fix nothing. All 9
  registry languages among them were dropped: zh for CUHK, Edinburgh, Peking, Stanford and Queensland;
  own or cited languages for UNSW (`nl`), PSL (`fr`), Toronto (`ms`) and Manchester (`pl`). No registry
  language outside batch 7 was dropped. The fix restores the five zh pages (their views carry their
  own Chinese). The other four are not restored; of them only PSL's is the school's own language.
- Batch 8 would have dropped zh for 20 more: with the old code `content:index-locales` refuses it
  and names them; with the fix it reports 203 / 203.
- Why it was missed: the gates checked that Chinese exists, not that it is indexed; and the R2
  candidate acceptance was rerun with the zh `noindex` and zh hreflang assertions removed
  (`docs/render-once.md` §8). "Same as the live version" is not a pass.
- Page-only releases did not expire the sitemap, although page text decides index languages. They do now
  (`switch.ts`, `bundle.ts`).

## Still missing: 32 V6 schools without prose in their own language

Indexing cannot fix these; the text has to be written, reviewed and published first. The V6 pipeline
authors en and zh only (every other locale part is a copy of the English view).

- **No translation of any kind (30):** da Aarhus · de Basel, Bern, Hamburg, Vienna · es UNAM, Barcelona,
  UAB, Universidad de Chile · fr Geneva, Louvain (UCLouvain), **Montréal** · hi IIT Madras · id Universitas
  Indonesia · it Bologna · ja Hokkaido, Kyushu, Nagoya · ko Hanyang · ms UPM, UTM · nl Erasmus, Ghent,
  Groningen, VU Amsterdam, Wageningen · sv Chalmers, Stockholm · ar Khalifa · zh-Hant NTHU.
- **A package exists but no longer covers the text batch 7 rewrote (2):** fr PSL, zh-Hant CUHK. They need
  new translations.
- Since 2026-11-26 the reading package can carry these as record deltas from the empty basis or on the same
  record (`docs/content-release.md` §12.4); the 71 view-decided zh pages use the same route.

## Open for the owner

- The registry also keeps pages in a language that is not the school's (for example `pl` Purdue, `nl`
  NYU, `fr` McGill), kept because they were cited. They are unchanged.
- American University of Beirut, Cairo, Sharjah and Dubai follow their country (Arabic) although
  they teach in English; nothing is indexed until Arabic prose exists.

- A page-only release now expires the sitemap by tag only. The first render of `/sitemaps/zh.xml` is slow on the
  host (60-110 s recorded in `docs/program-release.md`; the new decision took 5.1 s against 2.2 s on a laptop), so warm it after a release.
- `scripts/v6-pipeline/gates.py` (draft G3) still accepts any Chinese character; `assemble.ts` applies the stricter rule.
- Not changed here: own-language pages still have an English title, description and `og:url`; the language
  switcher of V6 pages links them as `#ui=<locale>` instead of their URL, so only hreflang and the
  sitemap lead to them; `index-recovery-pilot.ts` still says its 10 schools' bodies are English on every locale.

## Release check

```bash
UAPT_V6_PUBLISHED_PAGES=1 UAPT_CONTENT_ALLOW_UNSYNCHRONIZED=1 UAPT_CONTENT_ROOT=<parent runtime> \
  pnpm content:index-locales --out parent.json
UAPT_V6_PUBLISHED_PAGES=1 UAPT_CONTENT_ALLOW_UNSYNCHRONIZED=1 UAPT_CONTENT_ROOT=<candidate runtime> \
  pnpm content:index-locales --out candidate.json --against parent.json
```

Run the code of the live program, or the result describes a program that is not serving. Exit 1 = a
school would lose a language. An intended loss needs `--accept-loss` with a reason per school and
language. After the release, read `/zh/` robots and the zh sitemap for every school in scope.
