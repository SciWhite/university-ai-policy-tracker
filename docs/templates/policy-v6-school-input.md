# V6 单校输入清单

填写后交给集成线程。不是公开 schema，不是审批。

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
| Hero EN/ZH、范围、三条 Do/Don't | 与事实和嵌图文案相符 |
| 既有三图/主题图 | src、尺寸、范围、检查结果；无需新图则不生成 |
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
