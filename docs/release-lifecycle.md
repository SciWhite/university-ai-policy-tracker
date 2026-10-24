# 快速发布的服务生命周期与容量门禁

2026-10-16 OOM 事故后的强制规则。小规模构建继续使用共享 zone；版本目录用于证据和冷回滚，不能随发布增加常驻服务。本文件与同步合同 2.0.0 同时适用。

## 固定角色和过渡依赖

服务器权威登记：`/srv/uapt/operations/release-lifecycle/policy.json`。稳定角色为 main、shared-web、shared-mcp；每次最多临时启动一组固定 web/MCP candidate 槽位。槽位交替使用，不能命名为学校或发布版本。候选 TTL 最长 4 小时，禁止开机并发预热历史页。新建 service 或扩大 legacy allowlist 不属于普通快速发布，必须另行论证、验收。

事故遗留的动态服务暂列有界 legacyUnits；它们不是下一批发布的模板。其路由、静态资源、内部调用未迁移前不能停止。候选仍须包含旧 active 的历史路由，不能把每次旧 active 再登记成 legacy。完成阶段要求原 active 停止并禁用，legacy 集合不得增长。冷回滚保留目录、unit/env、内容包及 Nginx 配置；不保留旧进程来提供 JS/CSS。

## 发布入口

禁止再运行私有一次性 `cutover.py` 或旧 publisher 绕过门禁。唯一快速切换入口为 `scripts/uapt-release-lifecycle.py`；`scripts/uapt-release.mjs lifecycle ...` 调用相同入口。

1. `audit` 保存运行服务、MemAvailable、实际 UAPT 内存和每个服务的 MemoryHigh/Max。计划绑定 policy 的 SHA256、最长 4 小时有效期、冻结代码/BUILD_ID/内容依据和同步事件，列出固定候选、原 active、保留 active、精确 routingFiles、candidateEndpoints、retiredEndpoints、releaseHelper及其SHA256、静态迁移收据、capacityReceipt、候选及公网语义检查。公网 HTTP 200 本身不能验收。
2. `gate plan.json` 在服务器检查服务集合、内存容量和 candidate 同步门禁。候选最大并存预算不得超过配置值，扣除尚未占用的候选峰值后仍须满足 hostReserveBytes；UAPT 实际内存加剩余候选预算不得超过 uaptPeakMaxBytes。capacityReceipt 绑定实际 build/startup/cold_history/steady 的 peakBytesByStage 及原始采样依据，门禁拒绝缺阶段或低报预算；预算也必须覆盖 OCI build 峰值；build 前先 gate，再在切换前重新 gate，不能把低负载读数当峰值预算。
3. 为固定候选槽位安装生产相同用户/env、健康检查和实测 MemoryHigh/Max；候选配置不接正式路由。`cutover plan.json` 加全局 flock；确认候选已 enable/start 且语义检查通过，保存 fsync 的回滚 journal 后才写精确路由。校验失败立即恢复旧配置。成功选中仍为 selected_pending_acceptance。
4. 公网独立回读完成后，生成实际 completion ledger，再执行 `complete --completion-ledger event.json`。该阶段重新验证合同、精确公网语义、旧 endpoint 已从完整 `nginx -T` 移除，再 stop/disable 原 active 并核对状态，更新固定槽位登记。未退役不算发布完成。
5. 中断先执行 `recover`，禁止盲目重跑 cutover。开机 recovery oneshot 在 Nginx 之前检查未完成 journal，启动旧服务、还原全部旧配置和 policy。未完成事务阻止下一次发布。恢复入口与候选 TTL guard 均不删除任何产物。计划有效期最长四小时；每五分钟检查，过期未签收自动回滚未完成事务；无事务但已过期的候选须人工核对无路由后停止。

计划 JSON 的字段以 Python validator 为准。所有路径须使用实际绝对路径；routingFiles 的 target 仅允许已有 `/etc/nginx/snippets/uapt-*` 文件。receipt 的冻结 hash 不能替代逐文件静态资源和政策语义验收。脚本执行者仍需保存完整 route/public/browser/MCP 凭据，不能只填 contains 标记替代验收。

## 静态迁移和退役

独立复制 `.next/static` 到 `/srv/uapt/static/<asset-prefix>/`；按 URL 前缀独立提供，逐文件 SHA256 校验并实测生产 TLS 路径，检查 MIME、缓存头和旧浏览器引用。只允许静态目录，不把整个 `.next` 或 release 暴露到公网。`/_next/image`、数据和动态请求不得当静态文件处理。

退役前检查完整 Nginx include 图（包括 named fallback/common snippets）、候选监听、systemd/定时任务/env 的内部调用及现有连接。迁移后的生产读回通过才 stop + disable；先一批、观察内存及页面/MCP，再下一批。退役清单保存旧 enable 状态、配置备份、原件/hash、恢复命令及验证路径。不得删除 release、raw evidence、历史批准、快照或私有清单。

## 资源和历史计算

MemoryHigh 用于提前回收，MemoryMax 是最后隔离边界，不能代替容量规划。按主站、共享 zone、MCP 及历史服务实测峰值设置；记录启动/冷历史/稳定请求三个阶段。不能统一设一个低上限造成重启循环。OOM/NRestarts 增长、MemAvailable 跌破保留值、未退役服务或未完成 journal 均阻止快速发布。重启不自动扩大上限。

历史查询优先读冻结的按校/修订产物。尚有全发布遍历和进程级 Map 的旧实现不得并发预热；涉及历史 loader 的新发布必须提供冷/热内存和有界缓存证据。有限 LRU 条目数也不等于字节或并发峰值上界。不能把旧代码的高内存直接称为已经证明的对象泄漏。

## 当前实施边界

脚本在 2026-10-16 增加，拒绝场景与中断恢复通过故障注入单测；本次存量退役由单独冻结、加锁的迁移脚本执行，不把这次退役冒充新控制器的完整生产切换演练。首次新发布仍须验收固定槽位完整切换/签收/恢复路径。现行源码和历史页面没有因本次运维治理重新构建或修改政策。


## 2026-10-16 实际生效配置

- 服务器 23.4 GiB RAM：保留 6 GiB host headroom；UAPT 观测内存＋未占用候选峰值不得超过 9 GiB；候选 web/MCP 合计峰值预算最多 3 GiB。它是 admission 门禁，不是已经配置了 UAPT 聚合 cgroup 硬上限。
- 主站 MemoryHigh/Max：3/4 GiB；共享页面：1.5/2.5 GiB；当前 MCP：384/512 MiB；历史 diff：1/1.5 GiB；其余保留动态服务：512 MiB/1 GiB。已核对原进程未重启。未来需依据冷/热实测调整登记，不得为绕过门禁临时扩大。
- 已停止禁用 11 个仅资源页面服务和 8 个旧 MCP。246 个历史静态文件已独立复制并通过生产 TLS 路由逐文件校验；17 个过期 loopback 候选配置已从加载目录移入备份。没有删除版本目录。
- 尚有 9 个 legacy 动态/历史/资源 fallback 服务，加 main/shared-web/shared-mcp 共 12 个。历史版本对照发现部分正文或 JSON 差异，不能直接换上游后宣称不变；fallback/common include 也不是“无依赖”。这 9 个为冻结过渡清单，不宣称已全部收敛到 3 个角色。
- `/usr/local/libexec/uapt-release-lifecycle.py` 为 root 拥有的安装副本。`uapt-release-recovery.service` 已启用，`uapt-release-ttl.timer` 每五分钟检查。两个固定候选槽位已安装但 disabled/inactive；没有为部署门禁新增常驻应用。

本次实际执行与剩余依赖见 [治理结果](release-lifecycle-20261016-result.md)。


## 首次产物的构建前准入（2026-10-17）

同一控制器新增 `prebuild plan.json`。构建前使用明确 `measured:false` 的
`uapt-prebuild-budget-v1` capacity receipt，声明 `buildScope:uapt-build.scope`
及 `buildMemoryMaxBytes`；它必须不超过计划的候选峰值预算。
执行者必须在该固定 transient scope 中以 MemoryMax 强制预算，并保存实际采样。
prebuild 继续检查固定槽位、全局容量、同步凭据和未完成事务，但不启动候选、不切路由。
它不把尚不存在的 startup/cold_history/steady 数据冒充实测。

构建后更新 capacity receipt，补齐真实 build/startup/cold_history/steady 峰值及原始采样，
再执行原 `gate` 和 `cutover`。这两个入口仍拒绝 provisional receipt；四阶段实测要求不变。
构建 scope 结束后才可启动固定候选，候选运行资源上限不得超过已准入预算。


公网语义 readback 对相同 URL 和相同验收条件最多重试四次，间隔 1/2/3 秒，
记录先前失败尝试的时间及响应 hash。Nginx graceful reload 与既有边缘连接可能短暂
命中旧 worker；持续失败仍自动回滚，不以 HTTP 200 或删除断言放行。


## 2026-10-24 磁盘与保留门禁

新发布同时遵循 [磁盘与版本保留规范](release-storage-policy.md)。服务器 policy 的 diskCapacity 开启实时磁盘/inode、项目总量、每角色产物上限和逐目录保留收据检查；原固定槽位、内存、同步合同和恢复规则继续生效。生产执行已安装控制器，不从历史工作区运行旧副本。
