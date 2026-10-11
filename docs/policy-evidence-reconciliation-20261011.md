# 存量证据对账与单校包验收（B）

日期：2026-10-11。本阶段完成材料对账和可移植审计合同验收。所有对象都有处理结果或明确缺口，但这不是全校政策语义、现行版本或发布验收。没有新增政策正确性判定，没有修改生产数据、批准学生摘要、推送或部署。

当前入口仍为私有 `.local/policy-inventory/current.json`。A 的冻结库存 `20261011-integration-v5` 不变；B 使用独立叠加层 `reconciliations/20261011-B-v4`、来源调查 `source-investigations/20261011-B-v2`、验收包 `phase-B-20261011`。早期试运行目录保留，不能替代指针中的正式版本。

## 全量范围与原文绑定

| 项目 | 本阶段结果 |
| --- | ---: |
| 库存记录覆盖 | 11,767 |
| 证据引用覆盖 | 14,683 |
| 原始对象哈希与连续逐字引文匹配 | 5,361 |
| 可复算的派生哈希或仅空白排版匹配 | 130 |
| 已找到哈希对应对象，但引文未定位 | 207 |
| 未解析出对应原文对象 | 8,985 |
| 非 superseded 证据的来源级待补查组 | 2,936 |

B 将 36 个 superseded 历史证据引用也纳入范围；A 的绑定表未包含它们。因此 A 的 8,963 个未解析项、323 个非逐字匹配项和 3,011 个问题组不能与 B 直接作同口径增减比较。

原始字节始终保留。`raw_bytes`、只去除一个尾部 LF、UTF-8 外缘空白裁剪分别登记，派生哈希不会冒充原始文件哈希。引文位置包含原始文本字符区间及行号；仅允许连续文本中的空白差异，不删除否定词、替换情态动词或拼接远处段落。这里的行号不是 PDF 实际页码，`pdfActualPageVerified` 为 false；PDF 页面及规则上下文仍须在正式单校审计中核实。

扫描了 19,937 个可解析 JSON 原始对象，并保留 7 个解析失败对象及定位信息。空文件和被保存成 JSON 后缀的非 JSON CLI 输出也保留原始字节，不能作为结构化政策证据消费。JSON 中出现 URL/hash 仅登记为 metadata/citation，不推断为已取得原文。

## 版本、身份和摘要

873 组同一学校及 ID 的多个表示中，492 组比较字段相同，381 组不同。后者中 30 组是 published 与 superseded 修复版本的差异；剩余 351 组进入适用范围与内容审查。比较字段包括原文、scope、modality、conditions、exceptions、deadlines、claimValue 等，不把 confidence 差异当作规则变化。这些结果不是 351 个已确认政策错误，也不自动合并历史、工具与展示对象。

191 个记录的原始 entitySlug 与登记 slug 不同，均可追到显式别名映射。映射链可解释存储身份，不能证明校区/学院规则可继承到全校；保留原始键与待审范围。

使用网站实际的 `validatePolicySnapshotAgainstPublicData` 校验两校共 8 个摘要版本：最新 MIT／Imperial 两份 basisFingerprint 与冻结公开依据一致，但仍缺独立批准，保留 needs_review；旧六份存在依据不匹配，不能继承旧 dual_agent_reviewed 状态。这里只输出诊断，没有重写或重新批准任何摘要。

## 12 组同哈希多 URL 调查

对 32 个 URL 做有界联网调查，保存 curl 原始响应、robots 与跳转凭据，并记录 web 工具的独立观察。访问限制不绕过，无法确认 robots 时不继续自动抓取。

| 当前抓取结果 | URL 数 |
| --- | ---: |
| 已取得页面正文 | 10 |
| robots 无法确认，未抓取正文 | 15 |
| 访问验证壳，不能用作政策正文 | 4 |
| 客户端跳转占位页 | 1 |
| 当前传输路径返回 HTTP 错误 | 2 |

4 组可取得的当前页面字节不同，7 组仍受访问或部分取回限制，1 组确认当前重复的是访问验证壳。没有复现这 12 组旧声明哈希；不能据此认定旧哈希造假、历史来源完全相同或不同 URL 均可合并。

具体需要保留的区别：

- CityU 四个当前响应是相同的 Incapsula 加载壳，HTTP 200 不能代表已取得政策。
- Duke 旧入口的 meta refresh 不是政策正文，应继续定位其[当前 AI 服务入口](https://oit.duke.edu/services-tools/artificial-intelligence/)。
- TAMU 两个旧入口在本机 curl 返回 404，但 web 工具解析到[当前 AI 概览](https://www.it.tamu.edu/ai/index.html)。标为访问路径差异，不能仅凭这次 curl 把政策主张判为 BROKEN_SOURCE。
- [UIC 教师公告](https://today.uic.edu/generative-ai-resources-and-guidance-for-faculty/)与 [UIC AI statement](https://it.uic.edu/news-stories/statement-on-responsible-and-acceptable-use-of-ai/)是不同资料，应分别取回和解释。

来源调查没有改变任何 claim 的 lastCheckedAt、语义状态或时效状态。

## 单校包与验收

增强包位于 `.local/policy-inventory/audit-bundles/20261011-B-v2/<slug>`，保留原 A 包。每个增强包含源版本索引、证据位置、记录覆盖、版本关系和学生摘要依据诊断；可定位原文对象复制进包，不依赖原工作区路径。metadata 父对象可能仍须回查库存，这一边界写入 manifest，不假称完整导出了所有元数据父文档。

| 大学 | 全部审计对象 | 公开 Claim ID | 证据引用 | 摘要版本 | 未解析原文引用 |
| --- | ---: | ---: | ---: | ---: | ---: |
| MIT | 101 | 28 | 120 | 4 | 50 |
| Imperial | 68 | 17 | 122 | 4 | 22 |

每份包搬迁到独立临时目录并改名后，校验全部文件、完整对象集合（含学生摘要）、公开 Claim ID、证据引用及引文区间。未解析项包括历史和补充对象，不代表当前公开 claims 有这么多缺口。两校审计状态继续为 PARTIAL，新完成政策判定为 0。

34 项合同及拒绝路径测试通过；摘要校验脚本独立 TypeScript 检查通过。测试覆盖漏掉摘要、重复记录、漏掉证据、重新计算清单后伪造引文位置或原始对象身份等情况。测试凭据和搬迁验收结果随阶段包冻结。

全仓库 `pnpm check` 在 dataset release 时间链校验失败：既有未跟踪的同名 history 清单使当前 release 被选为自己的时间链前项。本阶段保留原文件，没有为了通过检查改写发布历史；后续 typecheck/lint 未由这次全仓库命令完成，不能报告全仓库验收通过。

## 接下来按缺口执行

`targeted-source-queue.json` 列出 2,936 个来源/版本/问题组，`representation-dispositions.json` 列出 351 组待审差异，`collision-findings.json` 保留 12 组调查及未解决原因，`json-scan-failures.json` 在叠加层保留非 JSON 对象。要求 registry 的 25 项仍未因材料对账而自动完成。

下一阶段 C 应先补充缺失原文、重定向和替代版本，再按完整单校包逐项独立审计；同时把其余发布入口接入同步门禁。公开政策变更必须同一发布更新对应 changes/history/diff、摘要依据、API/MCP/工具与适用页面；索引通知只在授权发布后执行并记录实际结果。此次本地对账通过不构成上述发布授权。
