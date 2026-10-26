# 暂留材料七天处理窗口实施结果

本次按用户明确要求放宽暂留材料的使用期限，规则源码已合入 main（0e22ea9d），服务器检查器和 policy 已安装并实测通过。

- 复查到期保留提醒；首次 heldSince 后 168 小时才因超期阻止新发布。maxHoldHours、blockAfterHours 均为 168。
- 原始 heldSince、reviewBefore、hold-clocks.json、current-retention.json 和发布事务逐字节保持不变。不是从本次调整重新计时。
- 38 项暂留材料中，21 项复查提醒已到期；新检查允许它们在七天处理窗口内继续保留，真实 retention 命令通过。
- 本地与服务器各 46 项相关测试通过，包括七天内放行、七天后阻断、禁止刷新计时、禁止伪装回滚和临时材料检查。
- 线上进程 InvocationID/PID/NRestarts、完整 nginx 配置和磁盘预算保持不变；没有重启、切流、删除材料或发布待验收内容。
- 检查时服务器约 28.0 GiB 可用，项目占用 67.6 GiB。实时容量检查继续生效，不能据本次通过推定下次构建峰值足够。
- 引用清单仍需 24 小时内复查，运行候选仍最多四小时。完整路由复验、MCP 对象发布与验收仍须由实际发布任务完成，本次规则调整不代表这些已通过。

服务器备份、测试、运行对比和运维同步排除依据：`/srv/uapt/operations/retention-window-20261025/`。控制器 SHA256 `68657d427abe2f63aa2a995741b2d9f87a6890e0df168c9d37cd2d00c14e1af5`。若需撤回规则，先获取发布锁并确认没有进行中的发布，再恢复该目录的 policy.before.json 与 controller.before.py；不要重置保留时钟或覆盖新的发布事务。
