# Multilingual SEO/GEO implementation review

Audit date: 2026-10-28. Source baseline: `066043ddec0a747acc5f4be47b8fbd896331245e`.
This document records implementation decisions; it is not a production acceptance receipt.

## Current evidence

- Live public catalog: 815 distinct universities in 86 countries/regions. The
  accepted shared page service contains 132 V6 universities. Other templates
  remain in scope for translation, without a layout migration.
- Public records contain 5,997 Claims. Frozen display-source export initially
  found 12,993 unique policy/display strings, 2,301,265 source characters,
  including existing summaries, topic/FAQ projections, actions and tool terms.
  Coverage is measured by source hash, university, field and locale, not routes.
  The expanded display export includes supplementary guide text, deadlines,
  Claim scopes and visible disposition explanations: 16,832 unique strings /
  2,356,899 source characters, with all 5,997 public Claim IDs reconciled.
- Actual private-dashboard readback for September 28–October 27: 4,237 page
  views, 3,746 direct page views, 119 identified AI referrals; Bing 118 clicks /
  4,682 impressions; GSC 3 clicks / 450 impressions. Page language and visitor
  country do not establish a reader's preferred language. Measurement includes
  the existing traffic classification and may still contain unclassified tests.
- Retained Bing AI page export contains 77 foreign-language URL rows. The daily
  export ends October 23; page/query tables have independent, currently
  unspecified export periods. Preserve individually verified cited URL
  exceptions instead of imposing a country-only language policy.
- The running main dashboard reports Bing AI unavailable because its default
  snapshot directory is missing. The actual CSVs exist under the existing
  external content directory. Bind that directory in the frozen candidate
  environment and verify the authenticated dashboard after unified cutover.
- Existing surface translation only visits the returned React tree and selected
  props. Text created inside nested components, V6 summaries and many metadata
  branches still use English. Existing supported routes are not proof of a
  translated policy page. The current locale normalizer also collapses Chinese
  script variants; the switcher exposes only four fixed languages.

## Upstream assessment

Repository metadata, license files, README and source-tree inventories were
read directly. Stars are the observed audit-time values, not adoption criteria.
Last commit dates are distinct from repository push timestamps.

| Project | Observed license; stars; latest default-branch commit | Decision for UAPT |
| --- | --- | --- |
| [OpenSEO](https://github.com/every-app/open-seo) | MIT; 25,464; 2026-10-26 (`99d9a49c`) | Do not install another dashboard. Its DataForSEO-backed keyword, competitor and AI visibility evidence can be useful, but requires separate paid service credentials and does not replace owned Bing/GSC data. Borrow traceable URL-level evidence and distinguish mentions from cited URLs. |
| [SEO Machine](https://github.com/TheCraigHewitt/seomachine) | MIT; 7,550; 2026-10-23 (`120e7b46`) | Do not install the Claude content-production workspace. Long-form article generation, keyword density and readability scores do not validate policy evidence or actual AI citations. Its source/context and review workflow is useful guidance; UAPT already has stronger evidence and release gates. |
| [GEOFlow](https://github.com/yaojingang/GEOFlow) | AGPL-3.0; 3,953; 2026-10-25 (`25e42f07`) | Do not deploy its Laravel CMS, queue, hosted-site and distribution stack. It duplicates existing source review, publishing and analytics infrastructure. Borrow the separation of generation, evidence, review and release receipts; do not import its article scoring as policy approval. Current source is a beta and its current license differs from older Apache releases. |
| [llms-txt](https://github.com/AnswerDotAI/llms-txt) | Apache-2.0; 2,671; 2026-09-24 (`3700a0a6`) | Adopt the concise directory convention in the existing endpoint. Use explicit Markdown links to canonical public retrieval resources and explain original-evidence/translation boundaries. No package, new content platform or claim that llms.txt proves indexing/citation is needed. |
| [Unlighthouse](https://github.com/harlan-zw/unlighthouse) | MIT; 4,922; 2026-10-23 (`9a2147d6`) | Suitable as a bounded, one-off Lighthouse sampler for representative templates and scripts. Do not add a resident service or crawl 26,895 university/locale combinations. It measures technical page quality, not search indexing, policy accuracy or AI citation. Reuse existing browser and route acceptance for release gates. |
| [GEO Optimizer](https://github.com/Auriti-Labs/geo-optimizer-skill) | MIT; 1,210; 2026-10-27 (`259b6293`) | Borrow crawl/access, structured-data and source-linked diagnostics. Do not use its weighted readiness score as actual visibility. Citation mode calls separate model/SERP providers; provider responses differ in whether real source URLs are available. Existing Bing AI imports are a stronger owned signal for this task. No automatic FAQ/schema expansion. |
| [Elmo](https://github.com/elmohq/elmo) | MIT; 517; 2026-10-27 (`a8885744`) | Do not deploy another database/worker/UI stack. It genuinely retains model answers, cited URLs, prompts, model versions and passage-level mention evidence. This is useful for a future controlled prompt experiment, but requires provider credentials/costs and samples prompts rather than measuring total organic citations. Reuse its distinction between mention, citation and referral in the existing backend. |
| [GEORank](https://github.com/yaojingang/GEORank) | Apache-2.0; 525; 2026-08-12 (`424a0cf9`), repository pushed October 28 | Do not install its multi-service diagnostics/content platform. Keyword expansion and model-generated brand diagnoses are not independent search/citation observations. Its backend, queues, stores and model pool duplicate existing capabilities. Recent pushes alone do not establish a recent default-branch implementation. |

## Selected changes and acceptance boundary

1. Reuse owned analytics; expose independent Bing AI file freshness/coverage and
   cited-URL evidence rather than create a parallel reporting platform.
2. Generate translations with the requested Gemini model through Agy or, under
   the user's subsequent authorization, isolated OpenClaw tasks over SSH.
   Prefer the server executor after matched-output and full-batch acceptance;
   it can preserve progress without keeping the Agy page open. A CLI success
   marker is insufficient: complete fields, protected tokens, numeric facts and
   semantic review are separate gates. Keep every candidate private until the
   full language, page and release acceptance is complete.
3. Introduce all requested reading locales with script-aware matching, manual
   selection and explicit URLs. Do not redirect explicit locale links or vary
   canonical body language by browser headers. Isolate URLs/IDs in RTL text and
   preserve original quotation language/direction and bytes.
4. Use one school-level eligibility registry for robots, reciprocal hreflang,
   sitemap and changed-URL notifications. English is the default. Additional
   school languages need school-specific evidence or an explicit retained
   cited-URL exception; completed translation is a separate gate. Montréal
   requires English and French. Do not assign French to every Canadian school.
5. Other reading variants use crawlable `noindex,follow` and stay out of sitemap,
   indexable hreflang and IndexNow scope. Bing documents that noindex affects
   search, Copilot and grounding eligibility; omitted submissions alone do not
   prohibit indexing. See [Bing's robots guidance](https://www.bing.com/webmasters/help/robots-meta-tags-and-attributes-that-bing-supports-5198d240)
   and [Google's localized-page guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).
6. Publish once after the complete selected school/locale corpus, UI, semantic,
   script/mobile, index-set and production-candidate gates pass. Maintain the
   accepted public Claims, held decisions, snapshot eligibility and evidence
   hashes. Translation timestamps never replace policy check dates.

Deployment remains subject to the installed lifecycle controller, actual disk
and memory admission, current retention receipts and synchronization contract.
The initial disk audit exceeded the configured project limit. The separately
authorized exact four-item cleanup was completed after off-server archive,
full hash/restore verification and a final locked reference check. The archive
is retained; no application was restarted by that cleanup. Capacity admission
and retention references must still be checked again for the actual release.

## Translation executor comparison

The four medium tests used identical 69-string inputs for Japanese, Arabic,
French and Traditional Chinese. Both configurations selected
`gemini-3.8-flash-high`; matching configured names do not independently identify
the upstream model implementation. All eight generation outputs contained the
complete expected fields and protected tokens.

| Locale | Agy generation (seconds) | OpenClaw generation (seconds) |
| --- | ---: | ---: |
| Japanese | 158.47 | 181.81 |
| Arabic | 310.69 | 202.62 |
| French | 272.44 | 252.95 |
| Traditional Chinese | 186.47 | 192.33 |

The four-job generation group completed in 310.69 versus 252.95 seconds, about
19% shorter in this sample. The earlier three-string tests favored OpenClaw
per call, but Agy ran those four jobs concurrently and OpenClaw ran them
serially; those short tests do not establish parallel throughput.

Neither executor produced publication-ready prose without review: both left
English tool-condition sentences untranslated, and some outputs strengthened
recommendations into obligations. OpenClaw's high-thinking review returned a
whole JSON code block for Japanese, complete objects for French/Traditional
Chinese, and a truncated Arabic object. Preserve all original outputs. A
single enclosing JSON code block can be parsed only when the entire enclosed
object is complete; partial objects remain rejected.

A fresh lower-thinking review of the same four translation sets returned all
69 checked IDs per locale, no unresolved IDs, in 75.34–78.63 seconds. It detected
the known untranslated tool-condition controls and the Arabic/French
recommendation-to-obligation defects. It also caught other untranslated status
labels. Two corrections incorrectly dropped the literal `conditionally_allowed`
identifier; both were separately regenerated and reviewed by the model, then
all 69 fields per locale passed the stricter invariants. The executor now
mechanically preserves snake_case code markers, while translating surrounding
human-readable text. Original failed and superseded outputs remain retained.

Use the same Gemini identifier with lower-thinking generation and review in a
four-job full-size qualification batch. Continue the full corpus only after
every batch passes complete JSON, protected-token/numeric checks and fresh
semantic review. A failed batch halts further scheduling without automatic
retries or publication. The server queue writes progress and artifacts to disk;
no continuous Agy-page polling is needed. Reported provider `cost.total=0` is
configured usage metadata and does not establish actual cost or free inference.

At 18:17 UTC the matched sample qualification passed and the four full-size
server jobs started. Full-corpus completion, application/browser acceptance and
the unified production release remain pending. Local `pnpm check`, script
typechecking, 19 focused output/locale/index/provenance/bidi tests and
`git diff --check` passed. No full local production build was run.

## 接入方案：后台、评分、V6 校准与网页修改

2026-10-28 后续范围：先确定接入设计。本轮不连接或调整 OpenClaw，
不修改翻译输入、任务队列或定时巡检；也没有安装下列平台或执行新的网站扫描。

| 项目 | 是否接现有后台 | 评分作用 | V6 与网页修改作用 | 本轮选择 |
| --- | --- | --- | --- | --- |
| Unlighthouse | 接入审计报告，不另部署其常驻后台 | 展示 Lighthouse 性能、无障碍、最佳实践、SEO 分项与原始指标 | 找出具体 URL 的资源、渲染、布局偏移与无障碍问题，再定位共享组件修复 | 优先使用固定版本的离线/CI 扫描器，保留逐 URL 原始 Lighthouse 报告；仅汇总 JSON 不足以定位全部问题 |
| GEO Optimizer | 接入 JSON 结果和逐项建议 | 单列 GEO 技术准备度及其分项、规则版本 | 检查 HTML 可读性、标题、canonical、结构化数据、链接和发现入口；建议先评估再形成源码 diff | 优先使用扫描及 JSON 输出；不对生产运行通用自动修复 |
| Elmo | 第二阶段接入受控问答实验结果；需要时作为独立私有服务通过 API 读取 | 显示指定问题/语言/模型下的提及率、真实引用率与样本数 | 用改动前后的同组问题检验哪些页被引用、回答是否保留条件和范围 | 暂不安装 Web/Worker/Postgres 全栈；先确定问题集和结果来源；普通无来源模型回答不能计为真实引用 |
| OpenSEO | 有明确关键词、排名、外链或竞争页面需求时再接其数据；不嵌入整套 UI | 搜索排名/可见性是观测指标，不是模板分数 | 帮助发现用户问题和标题/内链机会，不判断政策正确性 | 本期继续使用现有 GSC/Bing/Bing AI；额外 DataForSEO 接入不是前置依赖 |
| llms-txt | 无需独立后台；现有公开文件即可 | 仅做链接与格式检查，无独立效果分数 | 完善 AI 阅读目录和原文/译文/历史边界 | 已有本地候选修改，等待统一验收发布 |
| SEO Machine | 暂不接 | 文章优化建议不作学校政策质量分数 | 可用于未来月报、科普文案的标题和内链建议 | 不进入当前政策译文或 V6 规则改写流程 |
| GEOFlow | 暂不接 | 不引入它的内容质量总分 | 生成、审核、发布分离的流程可参考；不能校准证据语义 | 现有发布/同步机制已覆盖主要需求 |
| GEORank | 暂不接 | 不增加第二套综合 GEO 分数 | 诊断、问答、拓词平台与现有后台重叠 | 不为本任务引入多数据库与队列平台 |

### 具体接入位置与数据流

采用“扫描器产生报告 → 校验并导入私有结果 → 现有后台展示 → 对应源码修复 →
同组 URL 复测”的路径。后台打开页面时只读取结果，不启动扫描或调用外部模型。
第一次以冻结候选和精确白名单执行，避免自动发现并抓取全部语言/历史组合。

- 后台复用 `/internal/analytics`，展示三个独立视图：技术体检、GEO 检查与修改清单、
  AI 引用实验。增长和现场效果继续由 GSC/Bing/Bing AI/站内数据提供，不混成一个总分。
- 服务端入口复用 `apps/web/lib/private-analytics-dashboard.ts` 和已有
  `/api/internal/analytics/dashboard`，扩展其 types 与
  `apps/web/components/private-analytics-dashboard.tsx`。报告读取使用服务端私有文件，
  初期无需另建数据库。保留现有认证和 `private, no-store`；如果以后增加 API 路由，
  必须同时覆盖 `apps/web/proxy.ts` 的认证 matcher，而非只依赖页面登录。
- 每份结果保留工具/规则版本、运行时间、请求与最终 URL、语言、设备/配置、原始报告哈希、
  代码 SHA 和实际内容依据。候选与公网、历史与当前的结果分开；没有可核实的版本或读取失败时
  标记未知/不可用。GEO 响应的 `error` 非空时，不能把默认 0 分解释为网站质量差。
- 修改清单的每行关联 URL、原始检查 ID、实际证据、预期行为、优先级、对应源码、修复状态
  和复测结果。同一个共享模板问题合并处理；不同语言/内容缺陷保留各自记录。
  不执行外部报告中的命令或任意 HTML；原始回答/来源按不可信内容处理。

### 如何校准 V6 模板

现有 V6 有 record、bundle（含旧适配）、evidence 三种输入路径。
共享修改应覆盖三种路径和非 V6 对照，不能只对一个漂亮样本加分。
选择短/长校名、少/多工具、长引文、held/历史、深链接和不同语言脚本的代表页面；
先跑现有 EN/ZH，新语言尚未接入时明确记录未测试，不能用英文回退代替验收。

1. 技术层：Unlighthouse 逐页报告与 GEO 检查定位可复现问题。
   Lighthouse 的实验室指标与真实用户数据分开；GEO 规则得分不等于搜索收录或 AI 引用。
2. 展示与交互层：复用 `docs/templates/policy-v6-acceptance.md`、
   `scripts/v6-browser-completeness-body.js` 和现有阅读模板测试。
   检查 390/720/1440px、规定的窄屏/断点、焦点、Esc/点外关闭、证据浮层、复制、
   FAQ、深链接和实际正文/状态/范围；新增语言还需长文本及 RTL 混排检查。
   这些截图与交互实测负责视觉校准，外部 SEO 分数不能替代。
3. 数据与证据层：保留 `scripts/lib/v6-release-contract.ts`、
   `apps/web/lib/policy-v6-input.ts` 和完整内容门禁，逐 ID/hash 核对原文、工具条件、
   语言覆盖、held 排除及 snapshot 资格。该层用通过/失败/未验证，不发一个“政策质量分数”。
   通过结构校验仍不等于独立政策语义审计。

文档里提到的 `pnpm test:v6-template` 在本次 checkout 的 `package.json` 中不存在；
现有可运行入口有 `pnpm validate:v6-release`、`pnpm test:v6-reading-preview`
和 `tests/v6-contract-seo.test.ts`。实施前应对齐真实脚本，不能把文档中的命令当作已通过检查。
公开 `/api/public/v1/analysis/page-quality.json` 当前仅描述 Analysis 页面发布就绪度，
不应被改造成包含私有外部审计、模型回答或 V6 视觉总分的公开接口。

### 修改建议怎样落到网页

GEO 的 `recommendations` 和 Lighthouse audit 明细先成为待办，不直接改源码。
例如标题/描述/canonical/JSON-LD 问题落到 `university-policy-seo.ts`、
`policy-v6-seo-title.ts` 与共享 metadata；浮层/焦点/长文溢出问题落到共享 V6
组件和样式；AI 目录问题落到现有 `llms.txt`。修复后使用同一白名单和配置复测。

有意 `noindex` 的阅读语言不作为自动修复目标；不为加分开放所有语言索引、
捏造更新日期、添加不可见 FAQ/schema、删短原文引文或改写批准状态。
Elmo 的回答与引用结果用于验证影响，不能单独证明某项改动造成了流量增长。

### 先后顺序与翻译影响

先跑少量代表页的 Unlighthouse/GEO 基线，形成确切问题清单；然后把报告读取和
证据链接接到现有私有后台，再依据共性问题校准共享 V6；最后用固定问题集做 Elmo
引用验证。OpenSEO 的新增数据按实际缺口再接，SEO Machine/GEOFlow/GEORank 暂缓。
初期分数用于诊断与前后比较，先验证重复测量的波动，再决定回归阈值。

上述扫描、报告接入和 CSS/交互改进可独立推进，不改变冻结政策翻译输入。
既有准确译文继续按源字符串哈希复用。只有实际新增或修改的界面标题、提示或 metadata
需要单独增量翻译；如果建议触及政策陈述、FAQ 结论或证据范围，应先走证据/语义审核，
仅该变更对应的译文失效，不重跑整个语料库。本次设计不向 OpenClaw 发任何指令。

## 2026-10-28 网站侧实现进度（未发布）

已在任务 worktree 接入 `seo-geo-reports.ts`、私有后台三个独立视图与
`scripts/import-seo-geo-report.ts`。配置 `UAPT_SEO_GEO_REPORT_DIR` 指向私有
报告根目录，页面/API 仅读取 `technical.json`、`geo.json`、`citations.json`。
导入验证固定工具/规则版本、请求 URL、代码 SHA、配置、HTML 与原始报告哈希；
缺目录、未运行、未知版本、缺来源、无效格式及读取错误分别表示。失败扫描不显示零分。
沿用原认证 matcher 和 private/no-store API，没有新增公开诊断接口。

固定 `@unlighthouse/cli@0.19.1`，实际执行的嵌套 Lighthouse 是 **13.6.0**
（工具根目录另有 12.6.1，不能据此误记执行版本）。精确白名单覆盖 Harvard
evidence、UCL/Cornell/Alberta bundle、MIT record、UCL ZH 和 Aarhus 非 V6；
保留逐 URL 原始 Lighthouse JSON/HTML、配置与现场 HTML，不爬全站。
GEO Optimizer 使用冻结 `259b6293` 的 4.19.8、规则2、禁用第三方插件，
同组七页 69–73 分。学校详情页的首页 schema/FAQ/作者建议保留为待判断或
有意排除，未据此添加无来源内容。Elmo 只有问题集与结果接入，实际样本数为0，
引用率显示未知；没有安装数据库/worker，也没有把搜索或普通回答伪装成引用实验。

发现并修复 V6 来源卡片的版本展开目标约21px问题：共享阅读 CSS 改为44px，
有键盘焦点。首组五页在本地同配置复测均通过 target-size；本地 dev 性能分数
不与公网 production 分数比较。record/bundle/evidence 的 EN/ZH、390/720/1440
共18个样本实际打开原文浮层、Esc关闭并返回焦点，页面高度保持；另对UCL/Cornell
覆盖320及599/600/601、999/1000/1001断点。历史 bundle 适配由既有SSR/合同测试
覆盖，未宣称独立浏览器全覆盖、真实Safari/iOS或读屏验收。Harvard 本地仍有一项
已发布 compact 校徽资源缺失导致404，不能将通用图标回退记为原图加载成功。

网站侧还加入 `reading-translations.ts` 和 `pack-reading-translations.ts`：
按冻结源文 SHA + locale 读取经过验收的显示译文，核对学校记录与原始引文集合哈希，
保留原文、ID、URL、日期与审核状态；缺译文不得记为完成。打包要求32个目标locale
完整交付、逐语言完整审核回执及原始字节哈希。输出始终是隔离的未批准candidate，
生产loader拒绝候选；self-canonical和crawlable noindex规则有聚焦测试。
这不是33语言路由/选择器/正文已接通的证明，运行时仍主要为原七语言。

导入入口：

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/import-seo-geo-report.ts <private-root> <input.json> <technical|geo|citations>
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/pack-reading-translations.ts <source.json> <source-sha256> <reviewed-delivery.json> <new-candidate-directory>
```

后一个入口读取 `uapt-reviewed-translation-delivery-v1`：顶层sourceSha256、
locales[locale]的accepted状态、strings源hash→译文、receipt相对路径与SHA256。
回执 `uapt-translation-review-receipt-v1` 绑定locale/sourceSha256、accepted状态、
translationsSha256（strings的JSON.stringify UTF-8字节）、完整checkedSourceHashes及
空remainingSourceHashes。普通machine_review_complete或旧/部分批次不能自动变成accepted。
这只是网站侧交付适配契约，不改动原聊天的生成器、冻结输入或既有翻译产物。

全量译文交付、33语言实际路由与选择器、SSR/缓存/metadata/索引集合接通、完整候选
及统一OCI发布仍待完成。当前库存材料时效检查保留失败，不刷新旧资料时间来通过；
没有生产构建、切换或IndexNow。本轮界面增量仅位于私有后台，单列共享增量清单并排除
政策译文队列；公开政策显示原文未因技术修复改变。
