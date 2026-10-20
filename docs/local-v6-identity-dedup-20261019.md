# 大学身份去重（本地候选），2026-10-19

范围：`v6-core-pages-local` 工作区内的本地/候选修改。依据 `.local/v6-directory-identity-audit-20261019/` 的 13 组同 QS 核心身份清单。未推送、未构建全站、未部署、未重启线上服务、未切换内容指针、未重新固定学生快照、未发送 IndexNow 或其他通知。主工作区及本工作区原有未提交修改保留。

## 结果

当前目录由 828 条 slug 记录归并为 815 所大学，每所只出现一次。政策主张 5,506 条、Claim ID 5,463 个、官方来源归属 3,214 条、证据 5,830 条，归并前后一致；任何一侧都没有被丢弃，两侧 Claim ID 无冲突。Unknown 国家 2 条、Unknown 地区 10 条全部属于被退役的别名一侧；规范记录都有 QS 城市，因此当前目录中 Unknown 国家/地区为 0，没有推测任何地点。

## 13 组 alias → canonical

规范 slug 沿用原始单校采集记录：它们有 40 个已发布 release 的历史、已批准补充材料和已收录的公开网址，来源也更完整。别名一侧均来自 2026-07 AI 工具批次，而且其工具主张原文已写明规范校名。

| 退役 slug（308 跳转） | 规范 slug | 主张 | 来源 | 排名系统 |
| --- | --- | --- | --- | --- |
| birkbeck-university-london | birkbeck-university-of-london | 4+1=5 | 2+1=3 | QS/THE/ARWU + U.S. News |
| brunel-university-london | brunel-university-of-london | 5+1=6 | 4+1=5 | QS/THE + ARWU/U.S. News |
| university-of-tuebingen | eberhard-karls-universitat-tubingen | 4+1=5 | 3+1=4 | QS + ARWU |
| university-of-essex | essex-university-of | 6+1=7 | 3+1=4 | QS + THE/ARWU/U.S. News |
| karlsruhe-institute-of-technology-kit | kit-karlsruhe-institute-of-technology | 6+4=10 | 6+2=8 | QS + ARWU |
| lappeenranta-lahti-university-technology-lut | lappeenranta-lahti-university-of-technology-lut | 6+1=7 | 3+1=4 | QS/U.S. News |
| stony-brook-university | stony-brook-university-state-university-of-new-york | 7+1=8 | 5+1=6 | QS + THE/ARWU/U.S. News |
| university-of-sheffield | the-university-of-sheffield | 18+1=19 | 8+1=9 | QS/ARWU + THE/U.S. News/CWTS |
| university-of-warwick | the-university-of-warwick | 10+1=11 | 5+1=6 | QS/ARWU + THE/U.S. News/CWTS |
| university-of-western-australia | the-university-of-western-australia | 13+1=14 | 10+1=11 | QS/THE/ARWU + U.S. News |
| tokyo-institute-of-technology-tokyo-tech | tokyo-institute-of-technology | 7+1=8 | 3+1=4 | QS（同一 QS 行，去重） |
| university-of-pavia | universita-degli-studi-di-pavia | 3+3=6 | 3+1=4 | QS + THE/ARWU/U.S. News/CWTS |
| universitat-politecnica-catalunya | universitat-politecnica-de-catalunya-barcelonatech-upc | 11+4=15 | 9+2=11 | QS |

逐组核对结果：合并后的主张、来源、证据（Claim ID、证据 ID、快照哈希、原文片段）与两侧并集完全相等。同一排名系统两侧排名一致，没有冲突，均以规范一侧的行为准。逐组明细见 `.local/v6-identity-dedup-20261019/reconciliation.json`。

## 实现

- `data/entity-aliases.json`：新增 13 条 slug 别名，`matchReason` 写明 QS 核心身份、共享官方域名或来源以及取舍依据；新增 17 条旧名称/常用名 `name` 检索别名；原先指向退役 slug 的 2 条 QS ranking-label 别名（KIT、The University of Sheffield）改指规范 slug，否则注册表会出现别名链。
- `staged-public-data.ts`：原有机制在分组前把 alias 产物改写为规范 slug。本次新增一项：alias slug 已匹配的排名行并入规范身份，同一系统以规范一侧为准。`name`/`local_name`/`acronym` 注册别名写入 `entity.aliases`，供搜索使用。这条通用规则还恢复了 4 个此前已注册别名的孤立排名行，均为精确同名：Beihang（THE/ARWU/U.S. News/CWTS）、National Taiwan Normal University（THE/U.S. News）、SUSTech（ARWU/U.S. News）、Toronto Metropolitan University（THE/CWTS）。除此之外，没有其他记录变化。
- 跳转：大学页（原有）、`/changes/<slug>`、`/changes/<release>/<slug>` 均做永久跳转并保留语言前缀；API `universities`、`analysis`（原有）以及 `claims`、`changes/latest`、`changes/<release>` 返回 308。widgets 经 universities API 获取数据，会跟随这个跳转。
- `apps/web/lib/university-slug-aliases.json` 是从注册表派生的客户端副本，由 `validate:entity-aliases` 校验与注册表一致。目录、排名和 V6 比较中的 `compare=` 参数先规范化再去重。`UniversityMark` 优先查找规范 slug 的已接受校徽，然后查找同一身份的退役 slug，最后才使用开发期候选图。Tokyo 已接受的标题图/小图登记在退役 slug 下，现在由规范页使用。所有尺寸、背景、原生像素和用途限制保持不变，校徽注册表和素材包均未修改。
- 目录索引记录新增可选字段 `aliases`，目录筛选会同时匹配旧名称。
- Changes：冻结的 `change-index-baseline.json` 未修改。索引构建时去掉 13 条 alias 行，规范身份按与 corrections 相同的方式从当前记录重算（历史 release diff 已包含 alias 侧的行）。随后重新生成 hash 绑定的 `change-cache/index.json` 和 manifest，共 463 → 461 行，只有这 13 行变化；4 个 correction 学校的投影逐字节不变，journal 与 baseline 哈希也不变。

## 东京工业大学（未改变身份范围）

两个 slug 是同一条 QS 2026 第 85 行，标签都是 “Tokyo Institute of Technology (Tokyo Tech)”。两侧证据都来自东京科学大学时期。Institute of Science Tokyo 于 2024-10-01 由东京工业大学与东京医科齿科大学合并成立，规范记录已有主张 `cl-tokyotech-transition-science-tokyo` 记载这一点。本次只合并重复副本，不做以下任何事：改名为后继机构、加入 “Institute of Science Tokyo” 检索别名、并入 U.S. News 的 Institute of Science Tokyo 行、修改任何主张日期。

## 未解决的身份/政策事项

1. Tokyo Tech 记录沿用前身名称，内容却是后继机构的现行政策；U.S. News 的 “Institute of Science Tokyo” 行仍未关联。是否改为后继机构身份，需要人工身份决定。
2. 部分 alias 工具主张与规范一侧的叙述主张涉及同一工具（Sheffield Gemini、LUT Copilot、UPC Copilot/Gemini、KIT KI-Toolbox）。两者是互补的结构化工具记录与政策叙述，未发现矛盾，因此都保留，未做语义去重审核。
3. Essex 的规范显示名仍为 QS 的倒装名 “Essex, University of”；旧名 “University of Essex” 已作为检索别名保留。
4. 合并后的 change 行按现行聚合逻辑重算，事件时间取引入该主张的 release（20260715-005）中的审核时间，例如 2026-07-16。冻结的 alias 行原本显示后续复审时间 2026-07-19。两者都是数据中的真实审核时间，主张和审核日期均未修改。
5. 学生快照：13 所规范学校都没有学生快照，不适用；没有重新固定任何快照。

## 保留的 828

| 位置 | 含义 | 处理 |
| --- | --- | --- |
| README.md:28、:60 | 已发布 release 20260801-001 的规模和状态块 | 保留；在发布新 release 时由 `readme:update-status` 更新 |
| content/reports/2026-07/08/09.mdx，apps/web/lib/monthly-report-drafts.ts | 历史月报当期数据 | 保留 |
| docs/september-2026-report-release-notes.md、student-plugin-release.md、google-index-recovery-p0-review.md、policy-evidence-phase-C-20261011.md | 历史验收或发布记录 | 保留 |
| docs/policy-evidence-integration-plan.md | 已写明 828 → 13 组 → 815 | 保留 |
| knowledge/crawl-runs/current-public-release.md | 绑定 release 20260727-015 的派生快照 | 保留；在发布时随 `knowledge:update` 刷新 |
| data/public-releases/current.json 与 history/* | 冻结的发布清单描述（“828 full audit”） | 保留，不改哈希 |
| data/rankings/*、enforcement-v4-refresh-data.json、staging/ai-tools/audits/* | 排名行号或分数、行号、限流日志 | 与大学数无关 |
| 主工作区 AGENTS.md、docs/university-marks-current.md | 校徽包 828 条目录绑定（815 所） | 保留；属于包结构 |

页面、SEO、API 和 llms 中的大学总数全部由规范集合动态计算，没有硬编码的当前总数。

## 验证

- `pnpm check` 通过：数据集校验显示 815 所大学、5,506 条主张、3,214 条来源；QS 覆盖 815/815（原为 816/828，因为 Tokyo 被重复计数）；全部 typecheck 和 lint 通过。`git diff --check` 通过。
- `tests/university-identity-dedup.test.ts` 4/4 通过；`local-university-marks`、`qs-coverage-identity`、`sitemap-entries` 通过。`record-correction-changes` 中关于身份合并的断言通过，但另有一条已存在的断言（`scopedCorrections` 期望 2，实际 4）在干净的 HEAD 上同样失败。`v6-directory-payload` 中 QS 路由渲染一项在本工作区已存在的 V6 排名改写下失败：撤掉本次组件改动后仍然失败，而在 HEAD 上通过。
- 离线检查：sitemap 的 universities 和语言分区各列出 815 个唯一大学 URL，没有任何 alias slug；HEAD 已有一条硬编码的重复 eth-zurich 条目。用旧名称搜索时，首位结果是规范大学，alias slug 从不出现。
- 本地 3270 HTTP 回读：Birkbeck 的 7 类 alias 路由均返回 308 并指向规范地址，规范页返回 200。单校 change 页面在开发模式下会实时重建全部 release，无论学校是否经过合并都一样（离线每所约 23 秒，对照学校 Aalto 为 25 秒）。

证据目录：`.local/v6-identity-dedup-20261019/`。


## 2026-10-20 本地修复与有效交付凭据

本节是当前本地候选结果；上文保留 2026-10-19 的历史记录与统计口径。现行 V6 开关下为 **815 所大学、5,751 条主张**；完整目录及政策对象与去重验收候选逐字节相同，未改写政策、原文、审核日期或学生快照。

- Changes 普通学校历史不再在请求中重算全部发布。新增 `data/public-change-history`，按学校读取 474 所有历史变化的大学、714 条历史记录，以及 44 个完整发布差异；无历史的目录学校仍保留当前记录。所有公开 JSON 与旧算法重算结果逐项相同。缓存有依赖指纹、逐文件 SHA-256、文件大小上限及共享读取预算；原 V6/已审计纠正学校的专用历史优先级保留。
- 旧 slug 在 metadata 和页面处理前重定向。七语言、13 组新旧地址及发布差异/API、RSS 共 264 项 HTTP 回读通过；Brunel 七语言 × 明暗 × 手机/iPad/桌面 42 项浏览器状态通过。
- sitemap 生成入口统一去重并保留较新的 lastModified。原 XML 出口已有去重，本次消除了其上游生成数组的 ETH Zurich 重复。universities/zh/fr/pl 分区均为 815 个大学 URL、815 个唯一地址，ETH 各出现一次。
- MCP 是独立固定目录，不依赖网页 API 跳转自动同步。已导出并校验本地候选：815 所大学、26 个新旧名称解析通过；没有替换实际 MCP 服务目录。13 所归并学校均无学生快照，没有重设任何审批或快照指针。
- 当前有效事件：`.local/v6-identity-dedup-20261019/sync-event.json`。冻结依据和凭据位于同目录 `completion-20261020/`；旧无效事件及旧 basis 保存在本次修复目录的 `before/`，不删除旧验收记录。

重新生成历史投影时，在本工作区根目录执行：

```bash
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/export-public-change-history.ts
```

别名、排名或发布清单变更后需要重新导出。新代码与完整 `data/public-change-history` 必须一起交付；文件追踪已纳入 Next 配置。此步骤只生成既有公开数据的派生投影，不执行政策提升或通知；私有候选覆盖不能用于导出。以后若发布，仍需按现行发布路由和同步合同独立验收，不能用本地结果替代公网回读。

本轮 `pnpm check`、专项回归及 HTTP/浏览器检查通过。额外运行的旧 V6 全修订兼容套件有两项因缺少未在 HEAD 中存在的 Tsinghua legacy 原件而失败，详见修复记录；未为使该套件变绿伪造原件。上文披露的两个既有扩展回归问题也未纳入本次三项修复。

修复记录：`.local/v6-dedup-fixes-20261020/`。仅本地，未 push、部署、重启线上服务、切换生产指针或发送通知。
