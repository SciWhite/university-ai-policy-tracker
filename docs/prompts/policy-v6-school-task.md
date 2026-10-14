# 可复制给下一线程的 V6 任务

为 `<canonical-slug>` 用最新已验收本地爬取资料制作 V6 **本地预览**。先读取 `docs/policy-v6-integration-guide.md` 和 AGENTS.md，确认 checkout 真正含 V6 实现；只阅读目标单校材料及必要组件，保留共享脏工作树。

使用 `PolicyV6BundlePage`、`PolicyV6Provider`、`PolicyV6RecordTopics`、`UniversityAiTools`、`PolicyV6ClaimGroups` 等现有组件，不根据截图重写前端、不新增学校专属CSS。填单校输入清单和显式mapping，执行 `scripts/prepare-v6-local-bundle.py` 生成新版本private view。未知输入格式先验证适配；不要静默改源包或放宽验收。

重点核对范围、例外、当前性和source/evidence引用。原文保持原语言；已验收更正与原公开表述分开；held保持held。工具获取条件/官方原文两个独立浮层。复用通过图文检查的插画和校徽，后半段不加图。六校历史批准不转给新学校，不把本地view当public strong snapshot或完整QS审计。

先EN/ZH，在390/720/1440px检查；其他启用语言验路由/键/回退。按 `docs/templates/policy-v6-acceptance.md` 保存真实证据，运行相关门禁，报告更改文件、输入hash、剩余项、页面URL和验收范围。

各线程只写自己的private view/mapping/验收目录。共享 gate/route/registry/copy/CSS 由集成线程串行处理，避免互相覆写。不要push、生产build、部署、重启、cutover、snapshot re-pin或IndexNow；不得执行历史publisher。成果交给集成线程后再由用户决定发布。


新任务还需冻结 1.1.0 registry，并完成单校模板的集合、投影、PDF、时间/版本及详情入口检查。保持现有 UI/UX，不把后台修复过程写到主页面；审核细节经既有卡片/证据/changes 入口展开。执行 validate-assessment-evidence.ts 的结构门禁并另审语义；它未自动修复旧生产分析。完整新要求见指南 2026-10-14 补充节。
