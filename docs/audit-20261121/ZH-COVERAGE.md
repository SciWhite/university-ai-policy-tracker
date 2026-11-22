# 旧 V6 学校中文覆盖核查（PHASE1 后续事项 4）— 2026-11-22

阶段 1 用 G3 中文门禁（`scripts/v6-pipeline/locale-gate.ts`）审计 `c-20261120-v6-batch-qs145-r2`，报告 150 所 V6 学校共 1,526 条"/zh/ 无中文"问题。
本次逐行核实：这些行在线上 `/zh/` 页面是否真的显示英文。没有发布、部署或改动任何内容数据。

## 结论

**线上真实缺口：0 条。** 1,526 条中：

| 结论 | 行数 | 说明 |
|---|---:|---|
| 已修复 | 197 | 批次 1–2 的 20 所学校证据行，确为当时的真实缺口；2026-11-21 由 `c-20261121-v6-batch12-zh` 补 `summaryZh`，线上已核实为中文 |
| 误报 | 1,329 | 线上 `/zh/` 已显示中文，或该行根本不在页面上显示 |

误报原因是门禁只看 V6 页面视图自带的中文，而线上页面还有两条门禁没算到的路径：

| 类别 | 行数 | 学校 | 为什么是误报 |
|---|---:|---:|---|
| 证据行缺 `summaryZh` | 707 | 92 | 这些学校属于 132 所旧 V6 队列，`/zh/` 页面使用已批准的中文阅读翻译包（`translations/current.json`，`readingDisplayView`），把英文行文替换为中文。6 所学校（EPFL、HKUST、UIUC、UWA、Adelaide、Exeter）经由翻译包的 record delta 链（release manifest 已固定其审核回执）达到当前记录版本 |
| 工具缺 `toolDisplayCopy.zh` | 472 | 91 | 427 条由同一翻译包译成中文（其中 98 条属 `historical_discovery` 工具列表）；40 条工具记录本身没有描述/获取/费用文字，页面只显示工具名、中文标签和官方原文引文；5 条不在页面上显示 |
| `hero.title` / `hero.scope` | 74 | 50 | `v6_presentation_integration` 页面不渲染 hero（只有旧版 `policy-v6-bundle-page-legacy.tsx` 用它），标题来自目录中的校名 |
| 主题摘要/范围 | 72 | 4 | ETH、NUS、UCL、HKU 是 `scoped_record_correction` 视图，没有单独的主题中文条目；页面回退到学校主题本身的文字，由翻译包译成中文（NUS 的范围本身就是中文） |
| 无 zh 视图 | 4 | 4 | MIT、Imperial、Oxford、Cambridge 不由 `public-v6-pages` 渲染，任何语言都没有页面视图；线上 `/zh/` 页面为中文 |

另：当前线上 `c-20261122-v6-batch5-r1` 的旧门禁计数为 1,329（=1,526−197），与上表一致。

## 方法

1. **复现**：`pnpm v6:zh-gate`（旧版门禁）对 `c-20261120-v6-batch-qs145-r2` 得 1,526 条（150 所），对当前线上 `c-20261122-v6-batch5-r1` 得 1,329 条（130 所）。
2. **读代码**：`apps/web/app/(default)/universities/[slug]/page.tsx`（阅读翻译包是否完整 → `readingDisplayView`）、`policy-v6-compact-guide.tsx`（证据行显示 `summaryZh` 或已翻译的 `text`）、`policy-v6-bundle-page.tsx`（工具、hero）、`policy-v6-public-tool-context.tsx`（`historical_discovery` 工具不读 `toolDisplayCopy`）、`reading-translations.ts`（record delta 组合）。
3. **线上核查**：对全部 150 所学校各读 1 次 `/zh/universities/<slug>` 和 1 次 `/api/public/v1/universities/<slug>.json`，共 300 次请求，单线程，经 `scripts/release/content-release.py` 的 `PublicReader` 限速（≥0.2 s 间隔，任意 10 s 内最多 38 次），全部 HTTP 200，无 429。
   逐行判定：证据行取 `data-guide-evidence-id` 对应的首段文字，工具取工具卡（去掉官方原文引文），主题与 hero 在去掉原文引文后的页面文字中查找英文原句。页面显示英文原句即判为真实缺口。
4. **全站抽查**：150 个 `/zh/` 页面共 1,392 条证据行、785 条行动建议和全部工具摘要，没有一条完全不含中文。
5. 逐行结果：`side-session-notes/local_a5356c28-…/zh-coverage-rows.json`（`uapt-zh-coverage-audit-rows-v1`，1,526 行，含每行的判定依据和线上首句）。

官方原文引文（`blockquote`、`data-i18n="preserve"`）按设计保留原语言，不算缺口。

## 门禁修正（本 PR）

`scripts/v6-pipeline/locale-gate.ts`，测试见 `tests/v6-pipeline-locale.test.ts`（新增 6 个用例，10/10 通过）：

- **发布审计（CLI）读取阅读翻译包**：校验 `translations/current.json`、selection 和每个 bundle 的 SHA256；学校 bundle 的 `recordSha256` 必须等于当前 V6 记录版本，或经由 manifest 固定的 record delta 链到达该版本。只有翻译包中确有这条英文原句的已批准译文，才算覆盖。输出同时给出 `ownChineseMissing`（视图自带中文缺失数）和 `coveredOnlyByReadingPackage`，并提示：页面只在翻译包覆盖全部显示文字时才使用它，需线上 `/zh/` 回读确认。`--no-reading-package` 给出严格计数。
- **不渲染的行不计**：`v6_presentation_integration` 页面的 hero；没有任何描述/获取/费用文字的工具；`historical_discovery` 工具改查其记录文字本身（该组件从不读 `toolDisplayCopy`，补 `toolDisplayCopy` 无效），提示语改为 `tool discovery prose without Chinese (historical_discovery)`。
- **主题回退**：没有视图主题条目时，按页面规则检查学校主题本身的文字（中文即覆盖，英文仍报错）。
- **无视图学校**：审计模式下，任何语言都没有页面视图的学校列入 `slugsWithoutV6PageViews`，不报错。
- **不放宽组装门禁**：`assemble.ts` 不传翻译包，新学校仍须自带中文（`summaryZh`、行动建议、工具中文、主题中文）；缺 zh 视图仍报错。

修正后：`c-20261120-v6-batch-qs145-r2` 报 197 条（恰为批次 1–2 当时的真实缺口），`c-20261121-v6-batch12-zh` 和 `c-20261122-v6-batch5-r1` 报 0 条，与线上一致。

## 后续计划

- **无需中文补译发布**：没有真实缺口，不安排内容发布。
- **风险提示（未改）**：132 所旧学校的中文依赖阅读翻译包。若将来对其中某校做记录更正而没有同时提供 record delta，页面会整页回退到视图自带文字，上述 1,200 行会变成英文。建议：(a) 每次旧校记录更正都附 zh record delta（现有做法），且发布回读必须读该校 `/zh/` 页；或 (b) 以后用 update 模式逐批把译文写入视图（`summaryZh`、`toolDisplayCopy.zh`），去掉这层依赖。是否做 (b) 需 owner 决定，工作量约 1,200 行、120 所学校，翻译可直接取自已批准的翻译包，仍需 agent 复核。
- **小问题（未改，属 `apps/web`）**：工具卡在翻译后的中文文字上仍标 `lang="en"`（`university-ai-tools.tsx` 的 `proseLanguage` 取 `sourceLanguage`），读屏软件会按英文朗读。
- 本地语言（学校所在国语言）覆盖仍未纳入门禁（PHASE1 后续事项 5）。

## 每校明细（审计基线 `c-20261120-v6-batch-qs145-r2`）

| 学校 | 合计 | 证据行 | 工具 | hero | 主题 | 无视图 | 结论 |
|---|---:|---:|---:|---:|---:|---:|---|
| aalto-university | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| aarhus-university | 7 | 7 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| adelaide-university | 8 | 5 | 2 | 1 |  |  | 误报：线上已显示中文 |
| alma-mater-studiorum-universita-di-bologna | 7 | 7 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| anu | 13 | 10 | 3 |  |  |  | 误报：线上已显示中文 |
| boston-university | 13 | 5 | 8 |  |  |  | 误报：线上已显示中文 |
| brown-university | 6 | 5 |  | 1 |  |  | 误报：线上已显示中文 |
| california-institute-of-technology | 18 | 9 | 9 |  |  |  | 误报：线上已显示中文 |
| cardiff-university | 3 | 2 |  | 1 |  |  | 误报：线上已显示中文 |
| carnegie-mellon-university | 6 | 5 |  | 1 |  |  | 误报：线上已显示中文 |
| city-university-of-hong-kong | 5 | 4 |  | 1 |  |  | 误报：线上已显示中文 |
| columbia | 25 | 18 | 7 |  |  |  | 误报：线上已显示中文 |
| cornell-university | 25 | 19 | 4 | 2 |  |  | 误报：线上已显示中文 |
| cuhk | 22 | 16 | 6 |  |  |  | 误报：线上已显示中文 |
| de-la-salle-university | 3 | 2 |  | 1 |  |  | 误报：线上已显示中文 |
| deakin-university | 3 | 2 |  | 1 |  |  | 误报：线上已显示中文 |
| delft-university-of-technology | 6 | 5 | 1 |  |  |  | 误报：线上已显示中文 |
| duke-university | 7 | 6 |  | 1 |  |  | 误报：线上已显示中文 |
| durham-university | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| edinburgh | 21 | 17 | 4 |  |  |  | 误报：线上已显示中文 |
| epfl | 15 | 9 | 4 | 2 |  |  | 误报：线上已显示中文 |
| erasmus-university-rotterdam | 6 | 6 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| eth-zurich | 30 |  | 12 |  | 18 |  | 误报：线上已显示中文 |
| freie-universitaet-berlin | 7 | 6 | 1 |  |  |  | 误报：线上已显示中文 |
| fudan-university | 12 | 6 | 4 | 2 |  |  | 误报：线上已显示中文 |
| harvard-university | 30 | 6 | 24 |  |  |  | 误报：线上已显示中文 |
| hkust | 16 | 9 | 7 |  |  |  | 误报：线上已显示中文 |
| imperial-college-london | 1 |  |  |  |  | 1 | 误报：线上已显示中文 |
| institut-polytechnique-de-paris | 9 | 7 |  | 2 |  |  | 误报：线上已显示中文 |
| jhu | 16 | 8 | 6 | 2 |  |  | 误报：线上已显示中文 |
| kcl | 15 | 12 | 1 | 2 |  |  | 误报：线上已显示中文 |
| keele-university | 3 | 2 |  | 1 |  |  | 误报：线上已显示中文 |
| kfupm | 4 | 3 |  | 1 |  |  | 误报：线上已显示中文 |
| kit-karlsruhe-institute-of-technology | 3 |  | 3 |  |  |  | 误报：线上已显示中文 |
| korea-university | 7 | 6 |  | 1 |  |  | 误报：线上已显示中文 |
| kth-royal-institute-of-technology | 8 | 5 | 3 |  |  |  | 误报：线上已显示中文 |
| ku-leuven | 7 | 6 |  | 1 |  |  | 误报：线上已显示中文 |
| kyoto-university | 6 | 5 |  | 1 |  |  | 误报：线上已显示中文 |
| leiden-university | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| lomonosov-moscow-state-university | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| ludwig-maximilians-universitat-munchen | 6 | 5 |  | 1 |  |  | 误报：线上已显示中文 |
| lund-university | 8 | 4 | 4 |  |  |  | 误报：线上已显示中文 |
| macquarie-university | 8 | 8 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| manchester | 27 | 24 | 3 |  |  |  | 误报：线上已显示中文 |
| massachusetts-institute-of-technology | 1 |  |  |  |  | 1 | 误报：线上已显示中文 |
| mcgill-university | 12 | 8 | 2 | 2 |  |  | 误报：线上已显示中文 |
| monash | 22 | 18 | 4 |  |  |  | 误报：线上已显示中文 |
| nanjing-university | 6 |  | 6 |  |  |  | 误报：线上已显示中文 |
| nanyang-technological-university | 11 | 7 | 4 |  |  |  | 误报：线上已显示中文 |
| national-taiwan-university | 7 | 6 |  | 1 |  |  | 误报：线上已显示中文 |
| national-university-of-singapore | 27 |  | 9 |  | 18 |  | 误报：线上已显示中文 |
| new-york-university | 5 | 4 |  | 1 |  |  | 误报：线上已显示中文 |
| northwestern-university | 19 | 10 | 7 | 2 |  |  | 误报：线上已显示中文 |
| osaka-university | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| peking-university | 53 | 18 | 33 | 2 |  |  | 误报：线上已显示中文 |
| pennsylvania-state-university | 6 | 5 |  | 1 |  |  | 误报：线上已显示中文 |
| pohang-university-of-science-and-technology | 4 |  | 4 |  |  |  | 误报：线上已显示中文 |
| politecnico-di-milano | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| pontificia-universidad-catolica-de-chile | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| princeton-university | 19 | 8 | 9 | 2 |  |  | 误报：线上已显示中文 |
| purdue-university | 12 | 6 | 6 |  |  |  | 误报：线上已显示中文 |
| qatar-university | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| queen-mary-university-of-london | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| rice-university | 12 |  | 12 |  |  |  | 误报：线上已显示中文 |
| rwth-aachen-university | 2 |  | 2 |  |  |  | 误报：线上已显示中文 |
| shanghai-jiao-tong-university | 7 | 6 | 1 |  |  |  | 误报：线上已显示中文 |
| snu | 22 | 20 | 2 |  |  |  | 误报：线上已显示中文 |
| sorbonne-university | 5 | 3 | 2 |  |  |  | 误报：线上已显示中文 |
| stanford-university | 8 | 5 | 3 |  |  |  | 误报：线上已显示中文 |
| stockholm-university | 13 | 13 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| technical-university-of-denmark | 4 |  | 4 |  |  |  | 误报：线上已显示中文 |
| technical-university-of-munich | 15 | 10 | 3 | 2 |  |  | 误报：线上已显示中文 |
| texas-a-and-m-university | 9 | 9 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| the-hong-kong-polytechnic-university | 5 | 4 |  | 1 |  |  | 误报：线上已显示中文 |
| the-london-school-of-economics-and-political-science | 7 | 6 |  | 1 |  |  | 误报：线上已显示中文 |
| the-university-of-sheffield | 2 |  | 2 |  |  |  | 误报：线上已显示中文 |
| the-university-of-warwick | 8 | 7 | 1 |  |  |  | 误报：线上已显示中文 |
| the-university-of-western-australia | 7 | 5 | 2 |  |  |  | 误报：线上已显示中文 |
| tohoku-university | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| tokyo-institute-of-technology | 4 | 3 | 1 |  |  |  | 误报：线上已显示中文 |
| trinity-college-dublin-the-university-of-dublin | 5 | 5 |  |  |  |  | 误报：线上已显示中文 |
| tsinghua-university | 37 | 34 | 1 | 2 |  |  | 误报：线上已显示中文 |
| u-tokyo | 29 | 23 | 6 |  |  |  | 误报：线上已显示中文 |
| ubc | 26 | 22 | 4 |  |  |  | 误报：线上已显示中文 |
| ucl | 20 |  | 2 |  | 18 |  | 误报：线上已显示中文 |
| ucla | 10 | 4 | 6 |  |  |  | 误报：线上已显示中文 |
| universidad-de-buenos-aires | 7 | 5 | 1 | 1 |  |  | 误报：线上已显示中文 |
| universidad-nacional-autonoma-de-mexico | 11 | 11 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| universitat-heidelberg | 9 | 5 | 4 |  |  |  | 误报：线上已显示中文 |
| universite-paris-saclay | 3 | 3 |  |  |  |  | 误报：线上已显示中文 |
| universite-psl | 6 | 4 |  | 2 |  |  | 误报：线上已显示中文 |
| universiti-malaya | 5 | 4 |  | 1 |  |  | 误报：线上已显示中文 |
| universiti-putra-malaysia | 6 | 6 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| universiti-sains-malaysia | 6 | 5 |  | 1 |  |  | 误报：线上已显示中文 |
| universiti-teknologi-malaysia | 7 | 7 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| university-college-dublin | 4 |  | 4 |  |  |  | 误报：线上已显示中文 |
| university-of-alberta | 2 |  | 2 |  |  |  | 误报：线上已显示中文 |
| university-of-amsterdam | 5 | 4 |  | 1 |  |  | 误报：线上已显示中文 |
| university-of-auckland | 7 | 6 |  | 1 |  |  | 误报：线上已显示中文 |
| university-of-basel | 16 | 16 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| university-of-bath | 6 | 6 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| university-of-birmingham | 5 | 4 | 1 |  |  |  | 误报：线上已显示中文 |
| university-of-bristol | 4 | 3 |  | 1 |  |  | 误报：线上已显示中文 |
| university-of-california-berkeley | 30 | 20 | 8 | 2 |  |  | 误报：线上已显示中文 |
| university-of-california-davis | 8 |  | 8 |  |  |  | 误报：线上已显示中文 |
| university-of-california-san-diego | 5 | 4 |  | 1 |  |  | 误报：线上已显示中文 |
| university-of-cambridge | 1 |  |  |  |  | 1 | 误报：线上已显示中文 |
| university-of-cape-town | 11 | 11 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| university-of-chicago | 72 | 14 | 58 |  |  |  | 误报：线上已显示中文 |
| university-of-copenhagen | 4 |  | 4 |  |  |  | 误报：线上已显示中文 |
| university-of-exeter | 4 | 2 | 1 | 1 |  |  | 误报：线上已显示中文 |
| university-of-geneva | 18 | 18 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| university-of-glasgow | 5 | 4 | 1 |  |  |  | 误报：线上已显示中文 |
| university-of-groningen | 11 | 11 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| university-of-guelph | 3 | 2 |  | 1 |  |  | 误报：线上已显示中文 |
| university-of-helsinki | 6 |  | 6 |  |  |  | 误报：线上已显示中文 |
| university-of-hong-kong | 28 |  | 10 |  | 18 |  | 误报：线上已显示中文 |
| university-of-illinois-urbana-champaign | 7 | 6 |  | 1 |  |  | 误报：线上已显示中文 |
| university-of-johannesburg | 3 | 2 |  | 1 |  |  | 误报：线上已显示中文 |
| university-of-leeds | 5 | 4 | 1 |  |  |  | 误报：线上已显示中文 |
| university-of-limerick | 3 | 2 |  | 1 |  |  | 误报：线上已显示中文 |
| university-of-liverpool | 13 | 13 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| university-of-melbourne | 20 | 14 | 4 | 2 |  |  | 误报：线上已显示中文 |
| university-of-michigan-ann-arbor | 17 | 11 | 6 |  |  |  | 误报：线上已显示中文 |
| university-of-north-carolina-at-chapel-hill | 12 | 12 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| university-of-nottingham | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| university-of-oslo | 4 |  | 4 |  |  |  | 误报：线上已显示中文 |
| university-of-oxford | 1 |  |  |  |  | 1 | 误报：线上已显示中文 |
| university-of-pennsylvania | 26 | 12 | 12 | 2 |  |  | 误报：线上已显示中文 |
| university-of-queensland | 7 | 6 | 1 |  |  |  | 误报：线上已显示中文 |
| university-of-science-and-technology-of-china | 7 | 7 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| university-of-southampton | 9 | 6 | 3 |  |  |  | 误报：线上已显示中文 |
| university-of-southern-california | 10 | 10 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| university-of-st-andrews | 3 |  | 3 |  |  |  | 误报：线上已显示中文 |
| university-of-sydney | 16 | 10 | 4 | 2 |  |  | 误报：线上已显示中文 |
| university-of-technology-sydney | 4 |  | 4 |  |  |  | 误报：线上已显示中文 |
| university-of-texas-at-austin | 7 | 6 |  | 1 |  |  | 误报：线上已显示中文 |
| university-of-toronto | 24 | 7 | 15 | 2 |  |  | 误报：线上已显示中文 |
| university-of-twente | 3 | 2 |  | 1 |  |  | 误报：线上已显示中文 |
| university-of-vienna | 10 | 10 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| university-of-washington | 10 | 6 | 3 | 1 |  |  | 误报：线上已显示中文 |
| university-of-waterloo | 1 |  | 1 |  |  |  | 误报：线上已显示中文 |
| university-of-wisconsin-madison | 10 |  | 10 |  |  |  | 误报：线上已显示中文 |
| university-of-zurich | 3 |  | 3 |  |  |  | 误报：线上已显示中文 |
| unsw-sydney | 14 | 8 | 4 | 2 |  |  | 误报：线上已显示中文 |
| uppsala-university | 2 |  | 2 |  |  |  | 误报：线上已显示中文 |
| wageningen-university-and-research | 9 | 9 |  |  |  |  | 已修复（2026-11-21 batch12-zh） |
| yale-university | 25 | 5 | 18 | 2 |  |  | 误报：线上已显示中文 |
| yonsei-university | 5 | 5 |  |  |  |  | 误报：线上已显示中文 |
| zhejiang-university | 7 | 6 | 1 |  |  |  | 误报：线上已显示中文 |
