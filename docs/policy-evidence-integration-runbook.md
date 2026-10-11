# Evidence inventory and audit workflow

本流程实现私有材料整合、单校审计包、范围校验及同步凭据检查。原始材料登记不等于当前政策审核；字符匹配不等于语义核实；发布和上线继续遵守 `release-routing-policy.md`。

## 1. 查找当前材料

入口是 `.local/policy-inventory/current.json`。其 `indexPath` 相对指针文件所在目录解析，`indexSha256` 必须匹配清单实际字节。旧指针及 2026-10-07 基线保留，不改写旧输入哈希。不要把 scene 工作区旧指针或 5 月生成的 `.local/uapt-review.sqlite` 当作当前依据。

```bash
python3 scripts/policy-inventory-status.py --max-age-hours 168
```

这项检查核对当前指针、私有缓存哈希、知识入口和 registry，并区分资料入口时效与政策现行性。默认七天仅是资料诊断阈值，可按任务调整；通过不代表七天内核实过每条政策。新 registry 要重新登记覆盖，旧审核不得继承新增要求。

新库存包含：

| 文件 | 用途 |
| --- | --- |
| `manifest.json`、`implementation.py` | 冻结输出校验和及实际生成程序；不得原地编辑 |
| `archive.json`、`objects/` | 跨工作区逻辑位置、原始字节哈希、可独立读取的对象；同字节复用存储不合并来源身份 |
| `schools.json` | 原始学校键与历史统计；其中旧统计保留历史含义 |
| `records.json`、`inventory.sqlite` | 分层记录和只读查询；记录哈希与原始输入哈希分别保存 |
| `sources.json` | 冻结公开依据，MIT／Imperial 的已发布修复覆盖旧 basic 主张；其他学校仍是历史基线 |
| `delta.json`、`input-drift.json` | 增量和输入漂移，不把文件变化推定为政策变化 |
| `batches.json` | 19 个 V5 批次的冻结／审核／验收资料入口，异构批次仍须按各自格式解释 |
| `public-readback.json` | 实际 tracker JSON 读回及候选 ID/文字对照；不等于官网政策审计 |
| `evidence-bindings.json`、`source-hash-investigations.json` | 原文对象绑定缺口与同哈希多 URL 调查队列 |
| `source-gap-queue.json` | 按精确来源 URL＋版本哈希＋问题类型去重的缺口；先找存档，再决定补抓 |
| `requirements.json`、`requirements-coverage.json` | 本任务要求版本；未独立检查的项目继续标为未检查 |

逻辑工作区映射仅在私有 `.local/policy-inventory/resolver.json`。原工作区移除之后冻结 `objects/` 仍可使用。存档覆盖配置中存在的材料目录与允许文件类型，排除编译产物、依赖、命名明确的凭据/会话文件及 `.log` 文件；不宣称涵盖所有机器文件、完成内容级秘密扫描或包含远程未取回资料。私有包不能直接上传到公开网站。

## 2. 新增材料与要求

使用 Python 3.9 或以上版本。当前机器 `/opt/homebrew/bin/python3` 可用。新增工作区时修改私有 resolver，不把绝对机器路径提交到仓库。新增要求时发布带新版本的 registry，保留稳定 ID；旧审核不会自动获得新要求的完成状态。默认读取 `docs/policy-audit-requirements-v1.json`，可用 resolver 的 `requirementsRegistry` 指向 primary 工作区内的新版本文件，后续任务冻结该版本。

```bash
python3 scripts/policy-inventory.py build \
  --config .local/policy-inventory/resolver.json \
  --output .local/policy-inventory/revisions/<new-revision> --readback
python3 scripts/policy-inventory.py validate .local/policy-inventory/revisions/<new-revision>
```

输出目录必须是新目录。先验证全部冻结文件、原始对象和公开修复 ID，再保留旧指针，原子切换本地指针。`--readback` 仅请求关联 tracker 公共 JSON，不补爬大学官网，也不更新公开数据。

## 3. 存量对账与单校包

对冻结库存生成新叠加层；不得原地修改 A 库存。叠加层的文件及 parentInventoryManifestSha256 必须通过校验。原始对象、派生哈希、元数据引用和政策判定分开保存。

```bash
python3 scripts/policy-evidence-reconcile.py analyze <inventory-directory> --output <new-reconciliation>
python3 scripts/policy-evidence-reconcile.py validate <inventory-directory> <reconciliation-directory>
python3 scripts/policy-evidence-reconcile.py fetch-collisions <inventory-directory> --output <new-investigation>
pnpm exec tsx scripts/reconcile-student-snapshot-bases.ts \
  --packages-root <base-packages-root> --release-id <actual-frozen-release-id> --output <new-report.json>
python3 scripts/policy-evidence-reconcile.py augment-bundle \
  <inventory-directory> <reconciliation-directory> <base-school-package> \
  --snapshot-report <new-report.json> --output <new-enhanced-school-package>
python3 scripts/policy-evidence-reconcile.py validate-bundle <enhanced-school-package>
```

摘要校验使用仓库实际 validator；release-id 必须对应冻结依据，不得用新 ID 掩盖旧 basisFingerprint。源码和诊断随阶段资料冻结；源码后续变化不改写已冻结 implementation.py。`fetch-collisions` 是当前来源健康调查，不是自动 claim 审核；遇 robots 不可确认、访问验证壳、跳转占位或不同传输路径结果时保留限制。

| 对账文件 | 用途与边界 |
| --- | --- |
| `record-coverage.json` | 库存完整记录范围；学生摘要从独立单校包加入增强包覆盖 |
| `source-version-index.json` | URL＋声明版本哈希身份；metadata/citation 不是原文取回证明 |
| `evidence-reconciliation.json` | 原始／显式派生哈希、连续引文字符区间和行号；不等于 PDF 页面、现行版本或语义正确 |
| `representation-relations.json` | 同 ID 的字段差异和重复表示；不自动合并、不判定政策冲突 |
| `json-scan-failures.json` | 保留空文件、错误格式及来源位置，不能作为结构化政策证据加载 |
| `reconciliation.sqlite` | 私有可重建查询缓存，不连接生产 loader |

人工诊断、联网调查、便携包测试及同步事件另存阶段验收包，不能为了通过校验覆写冻结输出。当前 B 结果与缺口见 [报告](policy-evidence-reconciliation-20261011.md)。

## 4. 与 ChatGPT 协作审计

```bash
python3 scripts/policy-inventory.py bundle <inventory-directory> <slug> --output <new-private-package>
python3 scripts/policy-inventory.py validate-audit <package-directory> <report.json>
```

单校包包含完整公开 Claim ID、历史/候选/工具/展示对象、每个不同学生摘要版本及可绑定的冻结原文。摘要不根据所在工作区或旧 `overallStatus` 自动选为当前。相同摘要字节只复用对象，各工作区来源关系仍保留。尚未解析的原文不补造；`sourceObjectGaps` 明确列出缺口。

给 ChatGPT 的任务：每次一所大学，独立联网读取官网最新政策、必要上下文和 PDF 实际页码，主动查找替代来源及遗漏；冻结 tracker 主张是被审计对象。按 `manifest.json` 的完整 `recordKeys` 对账；历史版本可单列为上下文判定，但不可静默省略。公开 Claim ID 在 `publicClaimIds` 中，工具/展示/摘要对象不能伪称公开 Claim。

结构化报告最小合同：

```json
{
  "slug": "example-university",
  "bundleManifestSha256": "<SHA256 of package manifest bytes>",
  "status": "PARTIAL",
  "independentWebVerification": true,
  "results": [
    {
      "recordKey": "<exact package object key>",
      "status": "UNVERIFIED",
      "severity": "P1",
      "officialEvidence": [],
      "scope": "<audience, unit and assessment scope>",
      "temporalBasis": "<retrieval date and version comparison>",
      "explanationZh": "<issue and uncertainty>",
      "suggestedClaimEn": "<source-supported replacement, if established>"
    }
  ],
  "remainingRecordKeys": ["<every object still unchecked>"]
}
```

分类限 VERIFIED / OVERSTATED / UNDERSTATED / STALE / CONTRADICTED / BROKEN_SOURCE / UNVERIFIED。VERIFIED 需要官网证据、适用范围及时间依据；COMPLETED 需要全部对象覆盖、无剩余项且独立联网声明。校验器检查结构、哈希和覆盖，无法替代对引文、来源权威与规则解释的审核；通过校验不自动批准发布。中文报告还应包括完整英文原表述、准确证据位置、修复字段、遗漏规则和 QS 进度标记。

## 5. 每次任务的同步事件

事件类型：inventory_update、crawl_check、source_health、audit、policy_release、index_notification。保存 `eventId`、`requirementsVersion`、`basisSha256`、`basisArtifact` 和 `surfaces`。basis 是事件实际依据的冻结文件；所有更新凭据绑定同一 basis。文件路径相对事件 JSON 所在目录，不得越出事件包。每个 updated 项的 `evidence` 是非空数组：

```json
{"path":"artifacts/receipt.json","sha256":"<raw file SHA256>","basisSha256":"<same event basis>"}
```

14 项必须逐一登记：inventory、knowledge、review_cache、public_data、tools、student_snapshot、mcp、search_coverage、pages、runtime_content、changes、sitemap、notifications、public_readback。未更新项用 `not_required_with_reason` 并说明实际理由；pending/failed 阻止任务记为同步完成。成功无变化采集不制造政策 diff，也不刷新未核查 claims 的日期。

```bash
python3 scripts/policy-inventory.py sync-gate <event.json> --phase candidate
python3 scripts/policy-inventory.py sync-gate <event.json> --phase complete
```

policy_release 的 public_data、changes 必须有更新凭据；candidate 阶段还必须有 candidate_readback 凭据。只有 public_readback 和 notifications 可以在 candidate 阶段标为 `deferred_until_cutover` 并说明原因；complete 阶段必须处理这些项。无授权通知时保留有理由的排除，不自动发通知。

changes 凭据须覆盖对应学校变化页、历史/修订页、索引、latest diff、近期组件、RSS，以及组合部署中的全局/局部版本语义。MCP 凭据须逐 Claim ID 对账，包括 remainingClaimIds；摘要凭据须校验 basisFingerprint 和独立审核状态；runtime 凭据须绑定实际内容包及受影响路径。凭据哈希检查只验证字节和关联关系，凭据所声称的语义仍需验收。

维护候选提升入口已经强制要求精确候选哈希与同步凭据：

```bash
pnpm exec tsx scripts/promote-maintenance-release-candidate.ts \
  --candidate <candidate.json> --sync-ledger <event.json> --confirm
```

这是受明确发布授权时的操作示例，本整合任务不执行它。切换后再保存完成凭据与回滚标识。

### 新操作使用同步合同 2.0.0

历史 A/B 事件保留原格式和原批准状态。当前维护提升、摘要实际 re-pin、IndexNow 实际提交及旧脚本适配器要求 `syncContractVersion: "2.0.0"`，不得用旧版仅哈希凭据绕过新门禁。

事件另外绑定 `scopeArtifact: {path, sha256, basisSha256}`。scope 文件的 schemaVersion 为 `uapt-policy-sync-scope-v1`，包含 `universities: [{slug, publicClaimIds}]` 的完整受影响学校 Claim ID 集合及 `changedUrls`；旧脚本适配还需 `mutationEntry: {sha256, runner}`。相应 proof 路径都相对事件目录，不能越界。

各公开同步面用一份 `uapt-policy-surface-receipt-v1` JSON 凭据，明确 `surface`、`basisSha256`、`checkedAt`、`checkedSlugs` 和 `checks`。事件及凭据须在 72 小时内，不能把补写日期当作重新验收；过期要实际重读相应对象。各面还需原始回读/校验输出，typed receipt 是检查结果索引，不替代语义、官网、浏览器或运行时证据。

| 面 | 机器检查项目 |
| --- | --- |
| public_data | schema/private fields/record counts/claim fingerprints；dataArtifact 指向真实冻结的受影响公开 summaries 数组，逐 ID 核对 scope |
| changes | 对应学校 changes、history、latest diff、changes index、recent changes、RSS 六项均完成 |
| MCP | 全部 observedClaimIdsBySlug 与 scope 一致、remainingClaimIds 为空；published/scope 检查完成，dataBasisSha256 对应真实数据包 |
| student_snapshot | 同一 dataBasisSha256；记录各校 basisFingerprint/expectedBasisFingerprint/reviewState/effectiveStatus/displayEligible；不匹配或 needs_review 的摘要必须继续暂缓显示 |
| runtime_content | 受影响路由读回、内容与数据 expected/observed hashes 一致，数据哈希对应冻结 public_data artifact |
| pages/search/sitemap | 实际受影响语言与对照、身份/排名/搜索、URL/可索引性检查；无影响项仍需排除理由 |
| candidate/public_readback | 实际路径读回与 artifact identity 对应，不能用候选读回代替公网读回 |
| notifications | 保存 URL 请求与返回结果，明确 indexingConfirmed=false；接受通知不代表收录 |

检查字段的精确 camelCase 名称及拒绝场景见 `scripts/policy-inventory.py:sync_gate_v2` 和 `tests/policy-sync-v2.test.py`。机器检查仍不能证明操作员所陈述的语义正确；必须复核引用的原始产物。

```bash
# 只检查，不构建或部署。切换前/实际公网验收后分别执行。
node scripts/uapt-release.mjs verify-sync <event.json> <exact-basis-file> candidate
node scripts/uapt-release.mjs verify-sync <completion-event.json> <exact-basis-file> complete

# 摘要 dry-run 不要求 mutation gate；实际写入要求新合同。
pnpm snapshots:repin-release -- --dry-run
pnpm snapshots:repin-release -- --sync-ledger <event.json>

# 实际通知要求当前公开 release 清单哈希、已完成公网读回及精确 URL 范围。
pnpm indexnow:latest --sync-ledger <event.json>
```

IndexNow 保存新通知结果和完成事件，不覆写输入事件；失败不记为完成。候选清单提升时若 candidateOnly 等元数据发生合法转换，通知事件须绑定实际 current 清单，并保留候选依据关系，不把候选清单 SHA 冒充发布后清单 SHA。

其他工作区中的 MIT/Imperial publisher、工具和内容修复脚本保留为历史实现，不能从旧工作区绕过门禁直接重跑。未来确有执行授权时，从当前规范 checkout 使用适配器，并冻结原脚本哈希：

```bash
pnpm exec tsx scripts/run-synchronized-policy-mutation.ts \
  --entry <legacy-entry-file> --runner tsx --basis <frozen-package-manifest> \
  --sync-ledger <event.json> --receipt <new-private-receipt.json> --confirm
```

适配器只在合同、依据和 entry hash 均通过后执行；退出成功记为 mutation_executed_completion_pending，不能自动宣称上线完成。执行权限、候选审核、备份和回滚、上线后读回仍须单独满足。历史工作区未原地打补丁，生产服务也未升级；没有套用适配器的旧入口仍不满足当前发布规范。准备候选、捕获证据和只读内容 loader 不需要伪造 policy_release 事件，但任务仍登记私有同步事件。

## 6. 当前仍需独立处理的事项

原文对象缺口、未匹配引文、12 组同哈希多 URL 调查中未解决部分、历史工具与已发布修复的差异、异构批次中的未规范化对象，以及 requirements coverage 中未检索项都保留待办。来源归一化哈希与 raw bytes 哈希须另外标注，不能为获得匹配而修改原始证据。按缺口来源级去重安排补抓，连接到冻结来源版本；访问失败单独记录健康事件。A 与 B 对 superseded 证据的覆盖范围不同，不能直接比较缺口总数并宣称改善率。

无需重复抓取已有完整冻结原文；现行版本、替代文件及新增专题仍须联网复核。每次审核停止在当前学校，完成后由用户触发下一所。发布时按当前 runbook 选择范围，保留旧包与回滚路径，不用全站构建代替内容对账。

### 对明确缺口执行一次有限补抓

```bash
python3 scripts/policy-gap-crawl.py <targeted-source-queue.json> \
  --output <new-private-crawl-directory> --workers 8
# 仅在同一未冻结运行被中断时显式恢复；冻结 manifest 存在后拒绝恢复。
python3 scripts/policy-gap-crawl.py <same-queue.json> \
  --output <same-unfinished-directory> --workers 8 --resume
```

sourceLevelId 保持 URL＋声明版本＋问题身份，当前 URL 去重取回后回挂全部版本组。检查 public HTTP(S)、robots、跨域跳转与每 origin 节流；保留原始响应、robots 历史与逐 URL 凭据，不绕过验证壳或登录。JSONL 与原始对象支持断点保留；损坏/重复凭据不静默跳过。当前 raw body 不会覆盖历史 sourceSnapshotHash，不会关闭未做引文或现行版本审核的缺口；retrieved 只是取回成功，软 404 或与政策无关的正文仍须审查。

## 7. OpenClaw scheduled maintenance

现有每日 batch 使用 [维护合同](openclaw-policy-maintenance-contract.md)。扫描器在私有 run 目录保存 HTTP 解码实体字节和单独标识的 Firecrawl markdown，并标注截断；不改写历史基线。每次扫描和审核结果收集自动生成独立同步事件，无公开变更时明确排除公开面。

候选产物改存 maintenance root 的 artifact-runs，collector 兼容只读旧仓库路径。主机本地 user-systemd adapter 通过 infra/openclaw/update-maintenance-contract.py 更新，保留回滚副本，不能改回 sudo 启动。此更新不改变定时频率、模型、并发、通知或发布权限。没有本机私有库存的远程主机必须记录 inventory_not_available_on_host。
