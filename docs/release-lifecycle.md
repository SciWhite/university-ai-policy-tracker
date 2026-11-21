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
5. 中断先执行 `recover`，禁止盲目重跑 cutover。开机 recovery oneshot 在 Nginx 之前检查未完成 journal，启动旧服务、还原全部旧配置和 policy。未完成事务阻止下一次发布。恢复入口与候选 TTL guard 均不删除任何产物。计划有效期最长四小时；每五分钟检查，过期未签收自动回滚未完成事务；无事务但已过期的候选须先核对无路由（由 agent 执行并记录）后停止。

计划 JSON 的字段以 Python validator 为准。所有路径须使用实际绝对路径；routingFiles 的 target 仅允许已有 `/etc/nginx/snippets/uapt-*` 文件。receipt 的冻结 hash 不能替代逐文件静态资源和政策语义验收。脚本执行者仍需保存完整 route/public/browser/MCP 凭据，不能只填 contains 标记替代验收。

## 静态迁移和退役

独立复制 `.next/static` 到 `/srv/uapt/static/<asset-prefix>/`；按 URL 前缀独立提供，逐文件 SHA256 校验并实测生产 TLS 路径，检查 MIME、缓存头和旧浏览器引用。只允许静态目录，不把整个 `.next` 或 release 暴露到公网。`/_next/image`、数据和动态请求不得当静态文件处理。

退役前检查完整 Nginx include 图（包括 named fallback/common snippets）、候选监听、systemd/定时任务/env 的内部调用及现有连接。迁移后的生产读回通过才 stop + disable；先一批、观察内存及页面/MCP，再下一批。退役清单保存旧 enable 状态、配置备份、原件/hash、恢复命令及验证路径。不得删除 release、raw evidence、历史批准、快照或私有清单。

### 控制器静态依赖修复

静态依赖迁移使用安装版生命周期控制器的 `static-migrate <plan.json>`；不得用应用 `cutover` 替代。代码变更本身不会更新服务器；该入口已在2026-11-02的受控静态迁移中安装并执行。每次仍须核对当前安装副本、计划及实际生效配置，未确认命令可用前不能执行。计划为 `kind: "static"`，绑定 manifest、7个受控 snippet、逐文件源/目标哈希、public-before 与预览输入、实时增量磁盘预算，且最长4小时。入口持有同一发布锁，拒绝未完成事务、任何路径/哈希漂移、符号链接、目标碰撞或容量不足；只复制 manifest 中已公开的不可变文件并精确替换 `alias` 目标。URL、location、header、include、proxy、服务、policy 和暂留时钟保持不变。

入口先对全部精确公网 URL 做并发不超过2的 GET 基线，再用临时本机 Nginx 配置验证 staged snippets 与响应，之后才原子替换白名单配置、执行 `nginx -t` 并 reload 现有 Nginx，最后对同一 URL 集合做公网回读。状态、body hash/长度、MIME、Cache-Control、ETag、no-transform 必须一致；Expires 按响应 Date 的相对 TTL 比较。任一步失败时由同一 journal 恢复原7个配置并验证/reload，保存实际回执。静态成功直接将该事务标为 `complete`，不调用应用 `complete`、不生成同步合同或应用发布事件。它只修复 held release 的静态引用，不豁免任何应用发布门禁，也不移除原件；原件清理仍需站外完整归档、哈希、隔离恢复和删除前最新引用复查。

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

2026-10-25 补充：`retention` 为只读检查入口。启用 retentionEnforcement 后，发布收据同时覆盖受控临时材料和首次暂留时钟；超过实际阻断期限、缺行动/时区/期限、擅自重置时钟或未分类临时材料均拒绝新发布。规则详见 [磁盘规范](release-storage-policy.md)。没有自动删除或新增应用服务。

用户明确授权的当前处理窗口：暂留复查到期先提醒，首次登记满 7 天才因超期阻断；原始时钟不重写。引用清单仍需 24 小时内更新，实时磁盘/内存与验收检查继续执行。详见磁盘规范的“复查提醒与七天处理窗口”。

## 2026-11-03 固定构建与运行资源预算

用户已授权把本轮资源调整纳入常规发布流程。以下配置取代此前构建与候选共用3GiB、UAPT9GiB和host6GiB的限制；生产生效以安装后的控制器、policy及其核验收据为准，不续期旧R2/R3/R4临时容量租约。

| 对象 | 固定配置 |
| --- | --- |
| `uapt-build.scope` | `MemoryHigh=7.5GiB`、`MemoryMax=8GiB`、Node heap6144MiB |
| 运行候选 | `MemoryHigh=3.5GiB`、`MemoryMax=4GiB`、Node heap3072MiB |
| UAPT实际内存加本阶段剩余峰值 | 最多16GiB |
| 主机实时 `MemAvailable` 保留量 | 至少2GiB |

用户后续明确授权将主机预留量从3GiB适当放宽至2GiB，构建、候选和UAPT总预算保持上表配置。构建期间仍检查实时`MemAvailable`；低于2GiB时中止本次构建，保留现网服务及失败记录。

新policy提供`buildPeakMaxBytes`，新计划分别提供`buildPeakBytes`和`candidatePeakBytes`。`prebuild`命令按完整构建峰值预留容量，构建前固定候选槽位必须冷置；`gate`和`cutover`按运行候选剩余峰值核对共存容量。phase由控制器命令传入，计划JSON中的`phase`或`prebuild`标记不能改变门禁。没有`buildPeakMaxBytes`的旧policy只保留历史计划的共用预算语义，不接受新计划借此绕过独立构建上限。

capacity收据仍保留实际`build/startup/cold_history/steady`全部原始峰值。构建峰值不得超过`buildPeakBytes`，运行阶段峰值不得超过`candidatePeakBytes`；构建8GiB不意味着候选运行预算也要8GiB。两种门禁均检查实时主机余量和UAPT总量，不预支旧服务未来退役释放的内存。候选TTL、固定槽位、串行构建、同步合同和实际退役要求继续生效。

`BUILD_ID`可能在后续类型检查或页面生成失败之前写入。固定构建入口必须确认整个生产构建退出码0、无资源/编译守护失败、无OOM、源码与运行产物身份一致，再生成可部署的artifact依据；退出码非零时即使已有`BUILD_ID`也不得启动候选或切换。普通内容细节可按用户授权在上线后复测，构建兼容失败、候选健康/接口与资源故障、权限和私有内容边界、实际公网回读、事务恢复及旧active退役不能以此豁免。此资源调整本身不授权任何held政策或私有23校材料公开。

## 2026-11-06 complete 自动更新保留登记

`complete` 在退役任何旧 unit 之前计算新的保留登记（存在未分类 release root 时直接拒绝，旧槽位继续运行），在写入 policy 之后写入 `retentionRegister`，并在同目录保留带时间戳的备份。新 release root 记为 `active`（角色取自 `plan.diskBudget.role`）；被退役 unit 的 release root 记为它的 `rollback`；同一角色更早的 `rollback` 转为 `held`：`heldSince` 为完成时间，`reviewBefore` 为 167 小时后（不超过 `maxHoldHours`），并写明具体 `nextAction`。已有的首次暂留时钟原样沿用，不重置、不延长；其他角色的 rollback 和已有 held 不变。新暂留写入 `hold-clocks.json`，随后对结果执行只读 retention 检查，结果记在 `transaction.json` 的 `retentionRegister`。其余门禁不变。一键发布命令与安装步骤见 [程序发布](program-release.md) 第 7 节。

## 2026-11-21 retention `rescan`（陈旧收据的受控刷新）

问题：只有程序发布的 `complete` 会写新的保留收据；内容发布不会。`record-retention` 先校验现有收据，收据超过 24 小时即拒绝（“Retention receipt is stale”），所以上次程序发布 24 小时之后的内容发布会被阻断（2026-11-21 batch-3 当时靠手工原子改写 `checkedAt` 解除）。

新增动作（同一发布锁内执行）：

```bash
sudo /usr/local/libexec/uapt-release-lifecycle.py rescan --dry-run --reason "content release <id>"
sudo /usr/local/libexec/uapt-release-lifecycle.py rescan --reason "content release <id>"
sudo /usr/local/libexec/uapt-release-lifecycle.py retention
```

`rescan` 从 `audit()` 重新读取实际 release 根目录、临时材料和磁盘余量，并只读复查引用：systemd 已加载的全部 `uapt*` unit（含未运行的；未加载的已禁用 unit 文件不在内）、运行进程的 WorkingDirectory/cwd、`nginx -T`、`/srv/uapt` 与 `releases/` 下的符号链接。结果写进收据 `lastRescan`（原因、上次 checkedAt、上次登记 SHA256、引用、磁盘、内容 release 目录登记情况）。它不分类，也不改任何暂留时钟：

- 每个现有 entry、临时材料和 `contentReleaseHolds` 原样复制；`heldSince`、`reviewBefore`、`nextAction` 逐字节不变，写入前自检。新收据先在临时目录用 `validate_retention_receipt`（即 `validate_retention_deadlines` 对照现有登记和 `hold-clocks.json`）校验，通过后才备份（`current-retention.json.before-rescan-<UTC>`）并原子替换，然后执行 `checkpoint_hold_clocks`。只更新 `checkedAt`、`registerUpdatedBy` 和 `lastRescan`。
- 首次暂留时钟：release 根目录和临时材料的 held 项必须已在 `hold-clocks.json` 中（由 `complete`/`record-retention` 登记），`rescan` 不为它们新建时钟，缺时钟即拒绝。`contentReleaseHolds` 的时钟现在也记入 `hold-clocks.json`（`contentReleaseHolds` 字段，按 path，首次见到时登记），以后每次都对照：`heldSince` 不同或 `reviewBefore` 延后即拒绝；有时钟、目录仍在、却既不在 hold 列表也不是 contentActive/contentRollback 的内容 release 视为被删掉的 hold，拒绝。
- 消失项的归档凭据：`archivedOutsideServer` 记录须有 removalReceipt/restoreReceipt/archiveVerification，或 location 加 sha256/verification；记录带 `<receipt>Sha256` 时核对该文件哈希。
- 以下情况拒绝，且不写任何文件：未完成的发布事务；policy 缺 diskCapacity/retentionRegister/retentionEnforcement；可用空间低于 reserveBytes、inode 低于 reserveInodes 或项目占用超过 projectMaxBytes；未登记的 release 根目录或临时材料；已登记材料从磁盘消失却没有带凭据的 `archivedOutsideServer` 记录；`active` 根目录没有运行中的 unit；`rollback` 根目录仍被运行进程使用；登记中残留 `candidate`（没有未完成事务）；held 项缺首次时钟；任何 held（含 `contentReleaseHolds`）超过实际阻断期限、缺行动或期限超界；登记或时钟被改写以延长期限；扫描期间登记被他人修改。写入后的复查失败时，错误信息给出备份路径。
- `--dry-run` 执行全部检查，不写任何文件。`--reason` 必填（1–500 字符）。

`rescan` 只消除“清单陈旧”这一项，不消除归档欠账：过期 hold 仍须归档或解决依赖。`retention` 行为不变。测试：`pnpm test:program-release`（`RescanRetentionTests`、`ReleaseReferencesTests`）。

`record-retention`（以及 `complete` 的时钟登记）现在也会把 `contentReleaseHolds` 记入时钟文件；其余行为不变。

已知范围（安装时）：`retention`/gate 本身仍不检查 `contentReleaseHolds` 的期限（只有 `rescan` 检查）；内容 release 目录只在 `lastRescan.contentReleaseRoots` 报告登记情况（active/rollback/held/unregistered），不作为拒绝条件。下一节补齐。

仓库副本对照：开发前 `scripts/uapt-release-lifecycle.py`（main `b59ae274`）与服务器已安装的 `/usr/local/libexec/uapt-release-lifecycle.py` 逐字节一致（sha256 `e6ef581f4953d1170c09cc1d3a9293fd3431a68c90adc165eaba146ed79da9c5`，1488 行）。所谓“较旧较小”的副本是主工作区（停在 2026-09 的 `main`）里一个未跟踪的 14 KB 旧文件，不是仓库版本。

安装（需 owner 明确同意，属于生产变更）：

1. 无未完成事务时备份：`cp -p /usr/local/libexec/uapt-release-lifecycle.py /srv/uapt/operations/release-lifecycle/controller-before-rescan-e6ef581f.py`。
2. `install -o root -g root -m 0755 scripts/uapt-release-lifecycle.py /usr/local/libexec/uapt-release-lifecycle.py`，核对 SHA256 与已审提交一致，在同目录写安装收据 `rescan-controller-install-<sha8>.json`（前后 SHA256、提交、时间、授权原文）。
3. 只读执行 `retention`，再执行 `rescan --dry-run --reason "install check"`；都通过即完成。回退：用第 1 步备份原样复制回去。

## 2026-11-21 内容 hold 强制检查、内容 release 登记、十四天窗口与提前预警

背景与规则见 [磁盘规范](release-storage-policy.md) 的同名一节。控制器改动：

- `validate_retention_receipt`（`retention`、`record-retention`、`prebuild`/`gate`/`cutover` 的计划校验、内容激活脚本）同时执行 `validate_content_holds_against_clocks`（首次时钟不重置、不延期，已安装目录的 hold 不能从台账删除）、`validate_content_release_holds`（期限、行动、阻断）和 `validate_content_release_classification`（仅当 policy 设置 `retentionEnforcement.contentReleaseRoot` 时：每个已安装内容 release 必须是 contentActive、contentRollback 或 hold）。内容 hold 的未来时间检查改为对照当前时间，因为内容脚本登记 hold 时不刷新 `checkedAt`。
- `hold_limits`：按 hold 的 `heldSince` 选 `maxHoldHours`/`blockAfterHours`；`holdLimitHistory` 记录变更前的限额，变更前开始的 hold 沿用旧限额。程序 hold 与内容 hold 使用同一规则。
- 新动作 `classify-content-releases --reason "<原因>" [--dry-run]`（发布锁内；有未完成事务时拒绝）：登记未分类的内容 release，备份 `current-retention.json.before-classify-<UTC>`，原子写入，再登记首次时钟。不刷新 `checkedAt`；收据超过 24 小时时接着执行 `rescan`。
- 新动作 `hold-status [--write]`：只读、不取发布锁（每日 timer 不会阻塞或被发布阻塞），写 `retentionEnforcement.holdStatusFile`（默认 `release-lifecycle/hold-status.json`）。检查本身失败时写 `status: error` 并以非零退出（只在本机 journal 可见）。
- `record-retention` 建立首次时钟前核对磁盘证据（`HOLD_ADOPTION_GRACE_HOURS = 24`）；`complete` 建立的新 hold 不受影响（其开始时间就是完成时间）。
- policy 新键（安装须所有者同意）：`maxHoldHours`/`blockAfterHours` 336、`holdLimitHistory`、`contentReleaseRoot`、`contentHoldsSince`、`holdStatusFile`（可选）、`warningHours`（可选，默认 48）。

测试：`pnpm test:program-release`（`ContentHoldEnforcementTests`）。
