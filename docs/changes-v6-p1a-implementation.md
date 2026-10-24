# Changes / V6 P1a 本地实施记录

2026-10-23。状态：**数据层和门禁本地实现，未发布；现有消费者与页面尚未迁移**。承接 P0，使用同一独立工作树和 `codex/changes-v6-p0-20261023` 分支，代码基准 `49c494ee9c73a646d1c072f5e64605c5da2db651`。未推送、构建生产站点、部署、切流、发通知或修改 `data/`。主工作区业务代码未修改。

## 已实现

- 在现有 public-change-history 导出器增加 `--events-output <新的隔离目录>`，输出同一历史体系的 v2 manifest；v1 默认行为和原指针保留。原历史 entry/release 对象逐字节保留，不以全量重建替换冻结内容。
- 事件 ID 为 `slug:revision`，链接沿用 `/changes/{revision}/{slug}`。按每校真实修订链取冻结记录，去除无本校变化的全局 release；先改变再撤回的事件分别保留。
- 显式绑定新旧 Claim、匹配方式、分类规则、原始来源哈希、修订日期、缺口与当前记录 fingerprint。精确 Claim ID 对照、近似关系、补录、本站更正、暂缓、来源更新和原因未分类分开。不自动认定学校发布新规。
- 历史最小行只有 Claim ID/说明时保留记录并标明缺对照字段。缺父修订、旧文本、删除原因均记录缺口；内容冲突或身份不符拒绝导出。
- 主题直接复用对应修订中 V6 已审核页面的 Claim ID 绑定和主题顺序。一个 Claim 可引用多个主题，事件总数不重复累加。
- 新 family `public-v6-change-overviews` 复用原 shard manifest、hash 校验和 `V6ArtifactStore`。每校有轻量时间索引、主题和计数，筛选助手返回数量及最多三条预览；文本详情按需读取。
- 新增明确版本的单校只读 API。概览与详情请求必须指定投影版本；没有匹配版本不回退 latest。包未选中或校验失败为 503，版本不符 409，缺少学校/事件 404，不能把失败当 0 条。
- 四个同步入口支持 2.0.0/2.1.0，拒绝未知版本。2.1 先运行全部 2.0 typed checks，再重建冻结输入核对事件、overview、索引、当前 Claim/fingerprint、scope 和六个消费面的事件身份。recent/RSS 核对明确窗口子集。
- V6 packer 和候选准备入口识别并强制配对新 family；acceptance/ledger 绑定精确投影、概览哈希。缺 family、未知合同、错误 scope/basis、陈旧索引、超限分片均不能通过。
- AGENTS、证据同步 runbook、追踪文件配置和脚本类型检查范围已更新。

## 冻结本地产物

最终隔离包：`.local/changes-p1a/candidate-v2-final/`。

| 项目 | 结果 |
| --- | --- |
| 投影版本 | `uq-hkust-michigan-v6-r4-20261022` |
| 输入 basis | `6531703acfe90217213da93241c4cdbf0c5b700ab018030625a249c6cc00f142` |
| v2 manifest SHA256 | `c534aede21c22aba91991599ae0550caa81e1f733aa087a2c26dc6d77b2bdf0b` |
| overview 包 SHA256 | `6084091725b05755e4e97f63cb896cc2d9e4a9e8108685d7ff3f31b0a09b9477` |
| 历史学校 / 事件 | 475 / 786 |
| 所选记录包中的单校概览 | 45 份 |
| 最大单校概览 | Yale，3,334 字节未压缩 JSON；存储换行亦受 10,240 字节上限约束 |
| Harvard 概览 / 完整事件历史响应 | 2,223 / 55,464 字节 |
| Harvard 事件 | 本校 4 次；不生成无变化的 `v6-hku-…` 事件 |
| 旧历史对象 / 旧 release 对象 | 所有 SHA256、文件和字节数与 v1 相同 |

包总量约 137MB，包含保留的旧 release 及离线校验输入，不是页面载荷。请求概览不读取完整事件输入；完整输入只用于导出和门禁。`recordedFrom` 表示最早保留事件日期，不能证明更早学校没有政策变化或历史覆盖完整。

## 验证

- 最终 `pnpm check` 完整退出 0；zone 类型检查、扩展脚本类型检查和 `git diff --check` 通过。
- P1a 新增 7 项事件测试 + P0 的 7 项测试，共 14/14：同校多次修订、撤回保留、无变化去重、冲突、缺旧文、held、分片体积、错误版本/规则/basis/事件索引/RSS、主题多重归属和 UTC 边界。
- 原同步合同 2.0 测试 11/11；2.1 测试 6/6；旧维护同步测试 3/3。包含 Python gate、Node release helper、共享 mutation helper，以及 packer 的未知版本拒绝。
- 使用当前公开输入完成**合成本地打包测试**：45 校、七语，覆盖 1,247 条 Claim、348 条工具记录、29 条 held 记录。测试凭据明确标为 synthetic，包结果不授予语义批准、不选择生产指针、不发布。
- 缺 overview 和未知合同的负例在创建输出前被拒绝。候选准备 dry-run 明确列出四个 family、返回 `validated_only`；另在隔离夹具验证 v2 prebuild guard，没有暂存到实施工作树的 `data/`。
- 本地 dev API 已读回：overview/history/单事件 200、错误版本 409、未知学校/事件 404，并保存原始 JSON 与 hash。中文 Changes 浏览器搜索 Harvard 的 P0 摘要、布局保持，未出现横向溢出。

额外运行原有分片/SEO 回归共 18 项，14 通过、4 失败；在干净 `49c494ee` 独立 checkout 上重现相同四项：清华旧 aggregate 原件缺失两项、旧冷读大小阈值一项、中文 SEO 标题旧预期一项。没有为通过这些旧测试修改历史数据、源文件或 SEO。P0 报告中的其他遗留问题仍按原记录保留，不宣称全部旧回归通过。

本地 dev 的既有 analytics endpoint 404 仍是隔离运行限制。没有生产候选、官方政策现行性、实际全站消费者同步、真实屏幕阅读器或实体手机验收。

## 接入与边界

接口：

- `/api/public/v1/changes/overview/{projectionRevision}/{slug}.json`
- `/api/public/v1/changes/events/{projectionRevision}/{slug}.json`
- 同一详情接口加 `?eventRevision={revision}` 取单次修订。

本地验证时仅 development 环境允许 `UAPT_LOCAL_QA_CHANGE_PACKAGE` 指向上述**由公开输入生成的隔离包**；生产不读取该开发覆盖或私有库存。生产当前指针仍为 v1，不能因本地 200 声称新数据已上线。

当前全站列表、latest/recent/RSS 和学校历史页面仍使用原消费者。2.1 的六面凭据在本批合成测试中验证了协议，**尚无正式消费者/公网回读凭据**；后续迁移后须由真实返回内容提取事件 ID，不得复制预期列表冒充回读。

纯页面更新条目的来源已登记为 compact、MIT guide、Imperial UX 三个现有组件，并纳入输入 basis。它们尚无统一的逐校历史成员清单，本批保留 `presentation_history_not_normalized` 缺口，不按今天的成员把 10 月 15 日事件回填给后来加入的学校。

下一步可按计划接 P2 的 V6 折叠模块（P1b/P1c 单校历史与全站事件列表仍待实施）。P2 在三条现有渲染路径的 `#claims` 前接同一组件，保留既有条款卡、来源卡、工具和提交检查位置；SSR 计算一次 UTC 90 天窗口。未进入 P3 AI 摘要或比较器。

任何实际发布前仍须重新核实生产 SHA、精确 nginx/API 归属，按 release routing 决定服务依赖和构建范围，并完成真正的 candidate/complete 同步、容量与生命周期门禁。本地 audit 事件不是 promotion ledger。
