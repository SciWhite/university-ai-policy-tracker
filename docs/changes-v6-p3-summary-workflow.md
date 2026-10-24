# P3：独立摘要与三校候选试点

2026-10-23 用户授权：处理 Opus 两项意见后直接进入 P3。本轮完成工程流程、结构化兜底及三校六份中英文候选；**没有独立摘要批准，也没有上线**。实际执行日志为 2026-10-24 UTC，用户侧日期使用 America/Toronto。

## 先修两项意见

1. 总数统一用“涉及 N 条”，分列“更正／调整、补录、暂缓”，不把补录计入更正。Harvard 实际显示“涉及 35 条（更正／调整 30、补录 5）”。主题内按明确 Claim ID 去重；无 Claim ID 的元数据条目显示类型，不冒充零条或一条 Claim 修改。七语同口径，overview、学校历史、全站详情及共享文字组件一致。
2. 权威 Python sync gate 检查实际已选历史指针／overview family、事件包以及待发布 basis／changes receipt 的投影引用。policy release 或 IndexNow 使用 v2 时拒绝 2.0.0 降级；Node release helper、公用 requirePolicySync、promote／repin／通知调用均必须经过此 gate。纯 v1 的 2.0.0 兼容保留。不是只增加一个可由调用方省略的布尔声明。packer 原有配对检查保留。

## 摘要与历史分离

冻结 `ChangeEvent`、历史投影、overview 及其 hashes 未改。摘要属于独立 `public-change-summaries` family，draft／review inbox 不属于 runtime loader。

每个候选绑定：学校、事件 ID、原修订对（缺父版本保留 null）、package revision、projection hash、input basis、rulesVersion、完整事件 fingerprint；并逐条绑定 Claim ID、类别、显式主题、旧／新文本哈希、原证据 URL 与条目 fingerprint。全局包、事件、文字、范围或证据任一绑定改变，摘要均失效，不能自动继承审核。

本期只接收完整事件中 **1–5 个有证据的 Claim 条目**，不抽取大事件的片段伪装为完整摘要。不回溯推断历史原因，也不重新爬取或批准学校当前政策。

## 候选、独立审核、打包

实现位于 `scripts/change-summary-workflow.ts`，只有 prepare、draft、package 三个命令，没有自动 approve 命令。

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/change-summary-workflow.ts prepare <public-history-root> <slug> <event-revision> <NEW-private-output>
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/change-summary-workflow.ts draft <packet.json> <en|zh> <text.json> <generator-id> <NEW-private-output>
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/change-summary-workflow.ts package <public-history-root> <frozen-review-inputs.json> <NEW-private-output>
```

prepare 输出冻结绑定、完整实际事件与生成约束；draft 将提供的 AI 候选文字固化为不可变文件，并输出 `decision: pending` 的审核模板。CLI 不调用第三方模型服务，本轮候选由当前 Codex 会话按冻结记录撰写，作者标识为 `codex-changes-p3-author`。

EN/ZH 分别审核。独立审核人应核对学校／单位／课程范围、历史时间、暂缓含义、证据、语言及不得新增学生权限等六项检查，提供具体 reviewerId、reviewedAt、精确 draft/binding hash 和批准／拒绝决定。审核记录与草稿分开，修改候选后旧审核不再有效。作者不能用自己的 ID 批准。

package 输入为 `[{draft:{path,sha256},review:{path,sha256}}]`，hash 是文件原始 UTF-8 字节 SHA-256；审核文件内 draftSha256/bindingSha256 则使用 `summaryHash`，即解析对象的 `JSON.stringify` 字节。两者用途不同。必须使用全部准备好的确切文件，禁止修改后沿用旧 hash。

所有审核均通过后才在新的私有 staging 目录输出独立 manifest 和已审核叶子；拒绝 pending、缺检查、自己审核、错误时序、重复语言、输入 hash 改变或陈旧依据。输出不包含作者／审核人身份、私有路径、候选或完整旧新文字；保留公开证据 URL 和 draft/review hashes，原审核凭据私下保留。

ID 不同和检查字段只能验证工程合同，不能自动证明审核人的身份真实性或审核质量。独立语义审核必须来自实际获授权的审核者，发布时仍需冻结并接受其凭据。测试中的 fixture reviewer 只是合成验证，不授予真实候选批准。

## 显示与失效

V6 修订详情、单校历史、全站详情及独立事件页共用 `ChangeStudentSummary`，放在真实文字对照之前：

- 有匹配、独立审核的摘要时显示“本站更新了什么／学生需注意什么／依据与适用范围”、审核日期和证据链接。
- 缺少审核时只显示结构化计数与精简主题；待审核候选正文不进入页面或公共 API。
- 所选摘要依据变化显示 stale，读取损坏显示 failed；都回到模板，实际历史差异继续可读。
- 各语言界面标签保留本地语言。先选本语言 EN/ZH，其他语言优先使用已审核 EN，再回退已审核 ZH，并明确标记正文语言和 `lang`；不会因 EN 获批而自动批准 ZH。
- 类型／主题筛选只展示部分事件时使用筛选范围的模板，完整已审核摘要在原修订页查看，避免把整次摘要说成当前子集。主题预览最多两个，其余显示数量。
- 原红绿区始终保留真实文字，摘要不替代原文；全部历史文本仍保留，暂缓不等于学校废除规则。

事件 API 的 `studentSummary` 是运行时附加字段，不写回投影对象；学校历史 loader 也在校验后对读取副本附加。未选独立摘要包时为 missing。loader 不读取候选目录或全站事件 index；摘要 family 的 manifest 上限 1 MiB、每语言叶子上限 16 KiB，并校验内容 hash。

开发时可用 `UAPT_LOCAL_QA_CHANGE_SUMMARIES` 选择专门的已审核 staging 包；普通开发／生产缺少包时正常兜底。本次未设置该变量，也未产出含真实批准摘要的公开包。生产 tracing 已登记独立 family，统一 release packer 的正式摘要配对／同步适配与公网回读仍待后续发布任务，不能仅复制目录便宣称上线。

## 三校候选

私有目录 `.local/changes-p3/pilot/`：

| 学校 | 原事件 | 条目 | 类型 |
| --- | --- | --- | --- |
| EPFL | `qs20-24-v6-r6-20261020` | 1 | 工具入口与课程适用范围更正 |
| Cornell | `cornell-v6-r2-20261016` | 2 | 学术诚信实施范围与内部登记补录 |
| MIT | `v6-audit-fix-20261014` | 2 | 当前适用性未确认的历史 IS&T 条款暂缓 |

每校有 `packet.json`、`generation-prompt.txt`、EN/ZH 候选和各自 pending review 模板。没有为三校出具 approved review。reviewer 应特别检查 Cornell 的资格／校区／学院例外与登记含义，以及 MIT 的“未重现”不能推出“废止”。候选不等于政策建议或现行规则认定。

## 本地验证及边界

本期相关 TypeScript/React 回归 40 项；v2.1 合同 9 项与旧 v2.0 合同 11 项分别验证 v2 不可降级和旧流程兼容。包括真实 Node 入口的降级拒绝、审核文本修改／自审／缺检查拒绝、事件与来源变化失效、待审核不泄漏、七语模板与已审核 EN 正文回退、精确计数、临时合成包的审核导出及损坏回退。合成审核产物全部为测试，不能当三校批准。

浏览器检查包括三校修订页 × EN/ZH × 390/1440 × 明暗共 24 组，以及七语模板、Harvard 35 条拆分、实际 EPFL V6 内嵌和 API 的 missing 状态。没有真实审核包，未声称浏览器完成真实批准摘要或生产发布验收。实际结果、截图、最终检查与本地 audit 事件见 `.local/changes-p3/`。

本轮没有改生产 data 指针、历史政策、Claim IDs、PARTIAL/UNVERIFIED、held 或批准状态。P0/P1a/P2/P1b/P1c 的冻结验收包保留原样。下一项是独立审核六份候选并定点修订；未获批准前页面继续模板。正式发布仍需合同 2.1 的真实六面观测、主站与 zone 协调、OCI 产物和生命周期门禁；比较器另期。

## 全批阶段补充（2026-10-24）

上述 1–5 条和 16 KiB 为原三校阶段限制。用户授权其余 42 校后，当前完整事件绑定上限为 128 条，叶子上限为 128 KiB；当前实测最大 39,879 字节。prepare 增加同事件证据片段及词语筛查，确切冲突／缺引文的候选携带 generationHold，公开打包拒绝。当前全部 90 份仍未批准，原三校开发白名单不扩大。详见[全批阶段](changes-v6-cohort-local.md)，不要将本页的旧阶段未实施项或旧候选当作最新结果。
