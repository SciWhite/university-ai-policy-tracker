# V6 单校输入清单

填写后交给集成线程。不是公开 schema，不是审批；审批由独立 Agent 审核完成，没有人工审核环节。

## 共享阅读模板输入要求（2026-10-26）

复用共享 V6 阅读组件，不复制 Harvard JSX/CSS 或其政策内容。固定学生四问为作业/披露/数据/工具，复用本校对应状态；六核心和补充主题的完整摘要、范围、条件、FAQ 和行动不为布局压缩而改写。

逐条 evidence 提供其原始 `hash` / `sourceSnapshotHash`、URL、原文、语言、定位和取回日期。已绑定版本保留；缺版本只在完整 Claim/evidence 身份与原始记录精确匹配时补齐，不从主题来源列表或同 URL 猜测。完整来源引文与 canonical 分段主张可分别保留其证据身份；未知版本明确记录且不得合并。共享展示改动不重写内容包或批准 hash。

公开页面使用 `/universities/<slug>` 和 `/zh/universities/<slug>`。`?layout=` 仅供本地 `next dev` 预览。自然高度卡片、覆盖阅读面板、来源版本详情、日期、手机单行操作、深链/搜索/打印由共享组件提供。学校只填写真实数据和可选通用模块，HLS/HMS 等例外不得跨校复用。

## 来源元数据（2026-11-19，交付必填）

每所 V6 学校引用的每个官方来源，都要在 `data/public-v6-source-metadata.json` 里有一条记录：

- **文档记录**：文档类型、阶段，发布机构（名称、角色、类别），批准机构，各类日期（effective / approved / adopted / issued_or_published / revised / reviewed / last_updated_page / next_review，带精度），版本、适用范围，抓取哈希和我们的核查日期。每个值都附一段从抓取原文逐字复制的引文。原文没写的字段留空，不推断；没有任何官方日期时，页面显示我们的核查日期，并标明是"核查日期"。
- **`fetch_failed` 缺口**：来源读不到（HTTP 错误、验证页、空页）时，记录原因和尝试日期。不绕过登录、付费墙或验证码。

生成方法统一使用 `scripts/v6-source-metadata.py`：便宜模型独立抽取两次，逐字引文门禁，更强的模型逐条复核，再做确定性规则，可选独立抽样审计。具体步骤见接入规范"来源元数据"一节。没有记录的来源会让 `pnpm validate:v6-source-metadata`、`content:validate` 和 `v6:pack` 失败。2026-11-18 首轮遗留的 126 个未处理来源冻结在 `scripts/content-release/v6-source-metadata-legacy-unprocessed.json`，只能减少，新学校和新来源没有豁免。

```yaml
sourceMetadata:
  run: <private run directory, e.g. .local/v6-source-metadata-<date>/>
  candidateSha256: <SHA256 of run/candidate.json>
  publishedFile: <new public-v6-source-metadata.json>
  publishedFileSha256: <SHA256>
  documented: <count>
  fetchFailed: <count, with reasons>
  verifyModel: <model used for the verify pass>
  audit: <sample size, findings, fixes; or "not run">
```

## 新增或修改内容的强制合同（2026-10-25）

所有新增或修改学校输入必须通过共享 `validateV6Completeness`，由发布打包和实际页面入口共同调用。完整输入必须显式提供九主题的 EN/ZH 摘要、范围、标题、状态和 `studentActions`；不能通过省略可选字段绕开审核。Do/Don't 各 1–3 项，逐项绑定本校有效依据并区分 requirement/source_guidance/site_advice。缺证据写具体 gap，不编许可，也不为凑满三项编动作。

school 的实际渲染字段必须等于该语言映射；FAQ/行动主题必须使用同一摘要与范围。中文状态及快捷入口不能回落为英文审计占位。未翻译官方引文保留原语言，不参与界面中文断言。发布内容还须绑定 `completenessReview` 的实际内容 hash；该 hash 覆盖标题、状态、摘要、范围和行动，原文及 held 状态不因展示批准升级。

`data/policy-v6-legacy-completeness.json` 只冻结原已发布输入用于未变学校和历史回查。编辑任一字段即失去豁免；打包不得重生成豁免表，不得以旧学校验收代替新内容验收。新发布必须重新检查 QS71–90 全集。

```yaml
canonicalSlug: <catalog canonical slug>
name: <actual university name>
qsEdition: 2026
qsRank: <actual rank text; not legacy row number>
sourceBundle: <private current package path>
sourceBundleSha256: <SHA256>
sourceManifestSha256: <SHA256>
acceptanceArtifact: <actual acceptance receipt>
institutionAuditStatus: <PARTIAL or actual status>
remainingRecordKeys: [] # exact held/unchecked IDs; empty only if actually empty
publicationApproved: false
localViewRevision: <new stable revision>
contentCheckedAt: <actual review/check date; not generated date>
languagesFirst: [en, zh]
translationFallbacks: <explicit status for remaining locales>
```

| 必填内容 | 记录 |
| --- | --- |
| 原公开 Claim ID 全集 / 新 draft IDs / held IDs | 不省略；标明展示和排除理由 |
| 六主题摘要、来源状态、展示状态、依据 | 每主题显式映射；缺规则不猜 |
| 三补充主题 | 学术诚信、教学、安全采购，真实证据或明确缺口 |
| 来源与 evidenceIds | URL、真实原文、hash、定位、获取日期/版本 |
| Hero EN/ZH、范围、Do/Don't | 行动各最多三项，每项 kind 与本校 Claim/evidence 绑定；不引用其他学校程序 |
| 历史图资产（仅兼容记录） | 原 src/hash 保留；当前紧凑模板不显示情境图，不添加配图按钮，不生成新图 |
| 工具 | canonical/proposed 产品身份、获取条件、费用、原文、数据和人员范围 |
| 缺口 | 当前性、条例争议、未审核对象、工具未知项 |

mapping 顶层必填键：`slug/name/sourceBundleSha256/revision/checkedAt/claimTypes/additionalTopicKeys/topics/sourceTitles/tools/hero`。topic 每项 `sourceStatus/displayStatus/title{en,zh}/statusLabel{en,zh}`；hero 有 `title/scope/images/actions`；actions 的 do/dont 各三项 `{key,en,zh}`。sourceTitles 只给真实缺标题来源写编辑标题；tools 按原包顺序逐项核对 rawToolName。

当前可执行样例是 V6 checkout 私有 `.local/policy-v6/ucl-pilot-20261013/mapping.json`。复制结构，不复制其学校结论、哈希或审核确认。未知输入格式先独立适配和验证。


2026-10-14 补充（仅交付/审核记录，不改变 public schema）：

```yaml
requirementsRegistry: docs/policy-audit-requirements-v1.1.json
requirementsVersion: 1.1.0
publicClaimIds: []
publishedToolRecordIds: []
sourceVersionKeys: [] # URL + version hash
heldHistoricalIds: []
studentSnapshotVersions: []
uncheckedRequirementIds: []
publicationStage: LOCAL_PREPARED
publishedBasis: <datasetReleaseId / universityRevisionId / pageRevision + exact hashes>
projectionBasis: <topic / quick guide / FAQ / Do-Dont / compare -> evidence + scope>
sourceHashKinds: <raw bytes / extracted text / quote / batch; never interchangeable>
pdfReceipts: <same-file hashes, physical pages, clauses and live-byte gaps>
detailEntryCoverage: <existing card/evidence/changes entry -> full public material; gaps>
```

另外记录 claim-only、tool-only、metadata-only 和实际大学规则变化的范围；日期分别列出，未知不补造。审核信息进入既有详情入口，主页面不增加后台说明。新增表单键是交付要求，不自动改 Python local-view 输入 schema。

2026-10-15 模板补充：页面采用共享 compact-evidence 实现。历史 local-view 转换合同中的 `hero.images` 等字段只在需要维持旧输入兼容时保留原有值，不再作为页面展示或新图生成要求；缺图不得编造资源，新形输入仍须显式适配。当前行动/中文导读投影另绑定学校 fingerprint、recordSha256、英文主题正文和逐项证据，不通过自动重算 pin 获得批准。学校按公开 V6 slugs 接入，V5 slugs 维持原布局。

- 正式首页字段 `officialHomepage`（或 `homepageGap`）按 [V6 pipeline §2.5](../v6-pipeline.md#25-official-university-homepages) 填写到学校输入 JSON。

## 统一校徽角色交付（2026-10-26）

遵循 [校徽合同](../policy-v6-mark-integration.md) 和 [当前入口](../university-marks-current.md)。`universityMarks` 为私有选择记录：canonicalSlug、qsCoreId、manifestSha256、title/compact 各自角色/来源/变体 hash、实际 width/height、CSS slot/DPR、requiredBacking、minimum/maximum/原生限制、publicationApproved、保留现有资源或 fallback 理由。公开资源不因 private available 自动替换；单校任务不写共享注册表。
