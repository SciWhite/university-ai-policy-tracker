# P2：V6 内嵌记录更新模块（本地验收）

2026-10-23。工作树 `changes-v6-p0`，分支 `codex/changes-v6-p0-20261023`，基准 `49c494ee9c73a646d1c072f5e64605c5da2db651`。本批只进行本地开发，没有推送、生产构建、生产服务操作、切流或搜索通知。P0/P1a 的未提交工作和历史验收材料保留。

## 实际改动

三条 V6 渲染路径（local evidence / bundle / record）统一在 `#claims` 正前方插入 `PolicyV6Changes`。顶部原有 Changes 链接改为页内入口，页内目录只在“已审核条款”前增加“记录更新”。工具、学生指引与提交前检查、条款分类卡及证据弹窗、暂缓记录、官方来源卡的位置和实现保留。非 V6 页面没有插入此模块。

模块默认折叠，服务端一次计算含当天的 90 个 UTC 日期；可切换 30 天和自定义日期。本地筛选遍历本校轻量时间线，匹配总数和最多三条预览分别计算，不按最近一次修订日期替代整段历史。默认类型排除纯来源检查和纯页面更新，保留通往本校全部历史的原链接。

预览最多展示两个主题及其余主题数量。具体修订按需请求，主题内再展开真实文字，避免一次铺开几十条长文。没有显式 V6 主题绑定的历史条目保留原 Claim 分类及其本地化标签，不自动映射成六主题或都挤进“其他”。只有已记录同 Claim ID 精确匹配、且新旧文本确实不同的条目才显示红减绿加；正文保持正常前景色，并有“旧文本／新文本”标签。补录、暂缓与缺少文字对照分别表达，暂缓不等于学校废除规则。证据仍指向官方 URL；本期没有 AI 候选摘要、原文 diff 或比较器。

`loadSelectedChangeOverview` 在服务端复用 P1a 的校验读层，绑定实际页面 record fingerprint、选中投影修订、projection/basis hash 和 rulesVersion。缺包或不兼容时显示不可用；损坏时显示失败，不显示零条。概览和详情重试都不绕过显式修订路径；无匹配、日期非法、完全早于记录起点、部分覆盖、无日期记录分别提示。原生 details/summary 支持键盘；顶部和目录入口、直接 hash、刷新及重复点击同一 hash 均会展开并将焦点置于 summary。

## 本地数据与验证

继续只读 P1a 冻结公开输入导出包 `.local/changes-p1a/candidate-v2-final`，未生成新政策内容或选择生产指针。其投影修订为 `uq-hkust-michigan-v6-r4-20261022`，manifest SHA-256 为 `c534aede21c22aba91991599ae0550caa81e1f733aa087a2c26dc6d77b2bdf0b`。生产仍未接入这一开发覆盖。

- 最终 `pnpm check` 退出 0；独立 zone 类型检查、脚本类型检查、`git diff --check` 通过。
- P2 新增 6 项回归，加 P0/P1a 共 20/20：90 天及 UTC 偏移、闰年/DST 月份、早期事件筛选、总数与三条预览、默认分类、无日期与覆盖边界、非法日期、七语 SSR、不可用与失败不冒充零更新。
- 45 所当前公开 V6 学校的概览均通过实际 loader 读取和 fingerprint 绑定；最大概览 3,334 字节，哈佛 2,223 字节。读文件拦截测试禁止访问历史 objects（包含完整历史、事件索引和投影输入），读取仍成功；概览使用自己的分片元数据与单校叶子。元数据读取不计作单校 JSON 大小，不声称整个页面只有这几 KB。
- 浏览器检查 36 组：三种渲染路径的哈佛/UCL/康奈尔 × EN/ZH × 390/720/1440 × 明暗主题。均为单一模块、紧接 claims、无整页横向溢出、筛选按钮至少 44px，无 pageerror。七种语言另检查实际 UCL 路由、折叠状态、顶部/目录入口及本地化标签；没有宣称其余五语完成全文视觉和政策翻译审核。
- 浏览器实际操作：日期空结果/早于起点/部分覆盖/非法范围；单修订请求注入 503 后提示失败并重试成功；键盘关闭、同 hash 重新打开、直接 hash 与刷新焦点；既有条款弹窗打开、Escape 关闭和焦点返回。英文政策文字保留 `lang="en"`。
- 新增模块首次页面加载没有 Changes 网络请求，展开单次修订后才有显式 package revision + slug + eventRevision 请求。四个代表修订历史链接本地 HTTP 200。现有完整学校历史的浏览器重整仍属 P1b。
- 实测增减符号对背景对比度：浅色红 5.03、绿 4.77；深色红 8.90、绿 11.26。正文分别 13.76 和 14.64。未进行真实屏幕阅读器或实体手机验收。

本地 Turbopack 热更新曾出现长时间编译和恢复缓存 panic；已将旧 dev 缓存保留在 `.local/changes-p2/turbopack-cache-recovery` 并重开本次预览进程，重新读取页面。没有改生产构建输出，不以 dev 耗时作生产性能结论。

当前隔离 dev 的 `/api/internal/analytics/events` 404 是已有边界，另有注入失败测试产生的预期 503，不作为模块运行错误。前批记录的旧回归失败仍保留，本轮没有重跑或宣称修复那些旧测试。

## 复核入口与后续

本地 dev：`http://127.0.0.1:3357/zh/universities/harvard-university#record-changes`。这一地址只反映带 `UAPT_LOCAL_QA_CHANGE_PACKAGE` 的 development 进程，不是公网候选。

截图与原始验证在 `.local/changes-p2/`：

- `screenshots/01-desktop-dark-collapsed.png`：默认折叠及原有页面区块。
- `screenshots/02-desktop-dark-expanded.png`：展开概览、主题精简和原有条款卡。
- `screenshots/03-desktop-dark-diff.png`：真实新旧结论与官方来源链接。
- `screenshots/04-mobile-light-expanded.png`：手机浅色主题。

任务 audit 事件为 `.local/changes-p2/event.json`，绑定本地源码快照和测试/浏览器证据，明确不可用于 promotion。它不是同步合同 2.1 的生产 candidate/complete 凭据。

P1b 单校历史、P1c 全站逐事件浏览仍待实施；P3 已审核摘要与比较器继续保持后续范围。发布前还须核实主站 API 与 zone 精确路由归属、采用正确 OCI 发布方式、完成正式包与同步合同 2.1、candidate/public readback 及生命周期门禁；本地通过不授予生产或政策语义验收。
