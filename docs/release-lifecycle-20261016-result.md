# 2026-10-16 发布生命周期治理结果

本次执行存量退役和以后快速上线的约束。没有重新构建站点、修改大学政策、提升旧快照批准或删除 release/原始证据。

## 实际完成

- 11 个仅供旧 JS/CSS 的 Next.js 服务停止并禁用。246 个静态文件复制到独立 `/srv/uapt/static/<prefix>/`，保留原 URL，逐文件 SHA256 与生产 TLS 返回字节一致；版本目录和 unit 保留冷回滚。
- 8 个无现行公网／内部连接依赖的旧 MCP 停止并禁用。17 个过期 loopback candidate Nginx 配置移入备份，不再加载；现行 `/api/mcp` 保留在 3118。
- 应用常驻数量从 31 降到 12（11 个 Next.js、1 个 MCP）。主机内存从排查时约 50% 降到约 26–29%，实际读数随负载变化，Swap 为 0。现行主站、共享页面和 MCP 的 NRestarts 为 0，资源限制生效时 PID 保持不变。
- 全部 12 个应用服务安装 MemoryHigh/Max；没有靠重启清缓存。主站 3/4 GiB，共享页面 1.5/2.5 GiB，MCP 384/512 MiB，旧历史 diff 1/1.5 GiB，其他保留服务 512 MiB/1 GiB。
- 固定候选 web/MCP 槽位已安装但 disabled/inactive。部署登记冻结 active 和 9 个 legacy 服务，禁止普通发布扩大集合。6 GiB 主机保留量、9 GiB UAPT 并存 admission 预算和至多 3 GiB 候选预算已登记。9 GiB 是检查门槛，不是聚合 cgroup 硬上限。
- 安装 root 拥有的 `/usr/local/libexec/uapt-release-lifecycle.py`、Nginx 前开机 recovery oneshot、五分钟候选 TTL 检查 timer；没有新增常驻应用进程。锁、最多四小时计划、持久化 journal、失败恢复、完成前旧 active 退役成为统一入口要求。主工作区与发布工作树的 AGENTS/规范均更新。

## 验收

- 246/246 历史静态资源通过原生产 TLS 路径字节验证；公网另抽查每版 JS/CSS 的 MIME 和 immutable 缓存头。
- 49 项公网检查通过，覆盖旧资源、主站、Cornell/Penn 七语言页、工具／搜索、当前 JSON，以及 Cornell/Penn/PKU 历史入口。
- 公网 MCP 全 16 校 507 Claim IDs 对账通过，79 次调用；独立工具对象保持现行内容。
- EN/ZH ×390/1440 浏览器通过工具条件、Zoom 待评估、搜索摘要、引用详情和新增程序入口；没有将 HTTP200 当成交互验收。
- 6 项生命周期单测通过，包括未登记服务、容量不足、过期、无内存上限、缺退休清单，以及部分路由写入后的恢复（包含 boot 路径停用无路由候选）。Python/Node 语法和 git diff 检查通过。没有修改站点运行代码，因此未跑整站 build。
- 服务器实际 admission 探针拒绝按学校创建服务；第一轮探针对 3 GiB 新候选预算出现容量拒绝，后续负载下降后的探针允许同一预算；说明门禁依据实际时刻的余量重新计算，不能扩大预算绕过。TTL/no-op recovery 执行成功；没有在生产故意断电或切换新业务版本来声称完整故障演练。

## 保留的依赖与下一步

9 个 legacy 服务仍承担动态、历史或 named fallback/common include 依赖：identity、policy zone、PKU diff、PKU V6、Penn V6、Cornell 前版、Tulsa V5、十校 V5、HKU 版本。它们保留在服务器 `legacy-dependencies.json`，不再默认随新发布增加。

对旧历史版本与现行共享服务做了对照：部分 Cornell/Penn JSON 或 PKU 历史正文不同。不能仅更换 upstream 再宣称历史响应不变。后续应先制作可追溯的冻结按修订 JSON／历史页产物或兼容路由适配，再逐路径接受和退役。Tulsa/十校/HKU 还要核对整个资源前缀及 fallback 链，不能把整段 `/_next/` 当 JS/CSS。

全发布遍历、进程级历史缓存的源代码尚未在本轮替换；通过退役两个高占用旧服务、禁止并发预热、内存隔离及新发布的冷历史 peak receipt 门禁降低风险。不宣称已经证明或彻底修复对象泄漏，也不宣称所有旧动态服务已收敛至三角色。

## 恢复与证据

服务器运维目录 `/srv/uapt/operations/lifecycle-20261016/` 保存 static-plan、逐服务原状态／退役状态、静态配置备份、mcp-plan／候选配置备份、resource-limits 和探针结果。原 unit/env/release 均保留。恢复时先启动所需旧服务，再恢复对应已保存配置，`nginx -t` 后 reload，并回读目标资源／路由；不需重新 build。

本地私有证据：`.local/release-lifecycle-20261016/`；已取回服务器收据。新控制器未来首次实际发布仍须验证完整 gate → cutover → public sync → complete → retirement 流程。实际运维与政策发布同步分开；这轮未发送 IndexNow。
