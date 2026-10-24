# Changes P0 本地实施与验收

日期：2026-10-23。状态：**P0 本地实现，未发布**。分支 `codex/changes-v6-p0-20261023`，基准 `49c494ee9c73a646d1c072f5e64605c5da2db651`。主工作区原有业务代码未改动；实现位于独立工作树。后续范围见 [开发计划](changes-v6-development-plan.md)。

## 本批行为

- 七语 Changes 显示“本站结论文字变化”，既有 API 字段名、历史分类原值和冻结文件保留。
- 当前记录没有实际对比时不生成绿色新增。学校历史页区分“没有更新记录”和“有更新但暂无文字对照”。
- 红绿预览仅取已记录、同 Claim ID、匹配方法为 `claim_id` 的修改；不使用近似配对或缓存 diffLines 兜底，不重建 scoped correction diff。v1 index 不含 ID/匹配证据，因此列表预览不直接配对旧新文，仍可查看完整历史和证据。
- V6 更正计数按 ID 去重，新增与修改不重复统计；更正摘要可用确定性计数模板。无逐条计数的元数据修订保留其已有说明，不显示虚假的全零更新摘要。
- 原有带双语摘要按请求语言优先选择；没有已审核译文时保留英文、标注 `lang`，界面和回退说明保持本地化。增加七语静态标题、动态计数、held 与前后标签文案。
- 本地化只操作读副本，不覆写公开包、历史字节、政策依据、held 决定或审核状态。旧 artifact 路由未接管。

## 检查结果

| 检查 | 实际结果 |
| --- | --- |
| `pnpm check` | 最终完整运行退出 0；未执行全站生产 build |
| `pnpm exec tsc --noEmit -p apps/tulsa-zone/tsconfig.json` | 退出 0 |
| `tests/changes-p0.test.tsx` | 7/7 通过：去重、语言选择/回退、精确对比、七语模板、冻结材料不变、真实学校页、zone 附加组件 |
| 历史 shape/候选预检及相关回归 | 首轮 41 项：35 通过、6 失败；修正展示标签不应进入历史序列化后复验，下述 5 项与干净基准相同；原冷读耗时失败串行复验通过 |
| 最终 P0 + history + build-order 串行复验 | 15 项：13 通过；2 项失败均在干净基准重现，见下表；之后增加的第 7 项 P0 测试单独通过 |
| `git diff --check` | 通过 |
| 政策/历史冻结数据 | `data/` 无修改，未重导出、重爬或切指针 |

干净基准在独立临时 checkout 复验，没有把当前实现撤回或覆写。未为通过测试而补造私有文件或修改旧审核数据。

| 旧测试问题 | 当前与基准的相同失败 |
| --- | --- |
| historical reconstruction | Stanford 的既有冻结投影与全量重建的 summary/claimChanges 不同 |
| candidate build-order preservation | 非目标 ANU 历史与重建结果字节不同 |
| record-correction-changes | 测试期待 scopedCorrections 为 2，当前基准已有 4 |
| scoped-record-diffs student actions | UNSW 当前 guide 对象不满足旧 fixture 预期 |
| v6-audit-correction MCP | 独立 checkout 缺 `.local/v6-audit-fix/mcp-corrected-catalog.json` 私有材料 |

这五项是公开发布前需要单列处理的遗留项，本批没有宣称全回归通过。

## 本地浏览器与接口回读

浏览器针对独立 zone dev `http://127.0.0.1:3357`，不是生产候选或公网验收。

- EN/ZH/FR/PL/ES/NL/MS 的 `/changes`：实际搜索 Harvard，计数摘要均使用当前语言，未出现未经验证的旧新文字块；1440px 无横向溢出。
- 七语 `/changes/harvard-university`：标题、无文字对照提示本地化；没有“无更新”矛盾。1200px 无横向溢出。
- 中文列表在桌面明暗主题及 390px 手机检查；手机先展开原有筛选，再搜索与预览，页面无横向溢出。
- 中文学校历史页手机端按 Enter 展开既有 Claim details，前后标签为中文，原英文 Claim 文本保留并标注语言。
- 截图在 `output/playwright/changes-p0/`；本地 index、latest、latest/Harvard、recent-changes 和 RSS 五个接口均 HTTP 200，原始响应及字节 hash 在 `.local/changes-p0/`。仅状态码不视为语义验收。
- 浏览器最终无本批新增的 Link locale 警告或 hydration 错误。独立 zone 的既有 `/api/internal/analytics/events` 404（早期还见 favicon 404、CSS preload 提示）保留为本地隔离运行限制，未扩展修复采集系统。

没有完成真实屏幕阅读器、Safari/实体手机、全部学校、生产路由/服务映射、冷回滚或生产容量验收。未改变 metadata/索引策略；既有学校历史页的英文 SEO 标题亦未在本批扩展处理。

## 同步与下一批

私有任务同步事件位于 `.local/changes-p0/event.json`，登记本地代码、文案、测试和回读证据；它不是发布事件，不可用于 promotion。库存入口沿用主工作区私有指针，未刷新旧库存；资料时间诊断不建立当前学校政策。

P1a 尚未实现：升级现有 public-change-history v2、V6 有界 overview family、显式版本门禁。P1b/P1c 尚未重排历史或改逐事件日期筛选。P2 尚未插入 V6 的 90 天折叠模块。P3 摘要审核和比较器继续留在后续。

发布须另获授权，重新核实实际生产 SHA 和 nginx 精确路径，按 release routing/lifecycle 选择 zone 发布并提供 candidate/complete 同步及公网回读。没有推送、部署、重启、切流、IndexNow 或重新生成 sitemap。
