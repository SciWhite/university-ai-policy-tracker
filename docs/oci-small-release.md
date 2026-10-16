# 小规模发布：运行时内容包与有界页面服务

小规模更新默认使用此流程。大规模/全站版本更新才使用
[OCI build-once](oci-build-once-release.md)。先按[发布方式选择](release-routing-policy.md)
判定范围，不再因为改动一个页面而默认生成全站。

## 已验证的实现

2026-10-07，Tulsa单校试点及后续九校扩展已真实上线：

- 复用完整V5模板，10校×7语言70正式路由、89展示记录、39关联图片；
- OCI候选420浏览器状态、公网70路由及真实导航验收通过；
- 十校扩展编译3.9秒、TypeScript7.3秒，13个基础静态项生成296ms，
  没有生成全站5487页。初次加载器和白名单扩展是小范围代码构建，
  不是“所有发布都零构建”；
- OCI候选已实际验证内容指针更新/恢复，进程与BUILD_ID保持不变；
- 主站继续服务首页、其他大学和canonical API；精确路径由页面zone接管。

这是有界试点的生产证据，不是不限规模压力测试或七语言全文翻译验收。

## 两种小规模操作

### A. 兼容内容更新：不build、不restart

适用于现有白名单、既有组件/schema/记录数和canonical指纹保持兼容的
文字、场景配置更新。当前十校loader固定记录数量；增删记录或schema
变化尚不属于这条零构建路径。图片必须位于可受控提供的资源目录，不能
假设修改Git中的图片会自动出现在运行中的服务；当前代码release/public
内新增图片仍走B，除非先实现并验收独立版本化图片存储。

1. 导出仅公开白名单字段的新不可变JSON revision；保存源证据、范围和
   缺口，审核来源/翻译hash、引用行号、URL与图片、canonical主张指纹。
   不直接发布私有候选目录，不为通过校验自动重算审核绑定pin。
2. 校验包与应用兼容，校验完整包中所有学校，而不只检查修改的一校。
   包与SHA256、候选/正式指针置于应用release之外；新包用新revision，
   不覆写旧文件。指针更新前完成校验，拒绝坏包而非上线后等500。
3. 候选实例用相同应用artifact、独立loopback端口和候选内容指针。
   不让候选修改正式指针。当前zone的INTERNAL_NEXT_BASE_URL指向原主站
   3100，作为未变canonical API的数据服务；这是多zone共享依赖，区别于
   全站候选的自取基址。记录该依赖及主站SHA，不能引入未验收的新数据。
4. 检查修改学校全部7语言、metadata/正文一致、原文、图画、锚点/展开，
   加未修改学校对照；按实际影响检查列表/API/sitemap/分享图。若这些
   关联面需要应用代码或数据release变化，改走B或大规模流程。
5. 保存已知良好内容指针和hash，使用同目录临时文件+rename原子选择
   新包。一次请求固定一个revision；不能把同一响应混成两包。
6. 当前zone是SSR，下一请求读取新包，页面不使用全站SSG缓存。
   如未来开启Next页面缓存，必须认证、定向revalidate受影响路径；
   仅复制JSON文件不等于缓存失效。当前刷新接口仅供loopback认证调用，
   不经公网代理，不发密钥到浏览器。
7. 做目标URL源站/公网读回，确认release来源、正文/metadata、RSC导航、
   私有内容排除与对照。主张或整份数据版本不变时不宣称API同步新增。
8. 回滚：恢复已知良好内容指针及同一目标缓存，不build、不restart。
   必须保留持久化回滚指针，进程内“last good”不能替代重启后的恢复。
9. 成功后仅通知变更URL与公开sitemap的交集；不提交全站IndexNow。

### B. 局部界面、白名单或代码更新：只build有界页面服务

适用于现有zone的少量模板/布局/组件更改、增加受控学校或不兼容schema。
不直接向旧主站`.next`拷贝页面；新增范围也不等于免代码构建。

1. 本地数据/白名单检查、相关回归、`pnpm check`、zone显式类型检查及
   `git diff --check`。使用干净隔离checkout，保护其他聊天的脏改动。
2. Commit/push完整SHA，冻结到origin/main，新建OCI独立release。
   固定生产公开env、Node/pnpm；仅安装、生成该服务需要的依赖/Prisma。
3. 为候选准备独立内容目录/指针。只构建`@uapt/tulsa-zone`，不执行
   `@uapt/web build`或根目录递归build。应用包名目前保留历史Tulsa名称，
   实际已是十校共享服务；不要给每所大学再复制一个长期进程。
4. 使用空闲loopback候选端口启动，镜像运行用户/env/权限/工作目录。
   旧主站和旧zone继续服务。验证实际候选artifact、完整V5而非简化试验页。
5. 生成学校×语言矩阵，所有受影响路由与必要宽度/明暗/打印状态。
   70/420是本批计数，不是每次固定要求；增删范围后更新清单。
6. 记录SHA、BUILD_ID、完整内容指针/hash、canonical数据基线、路由矩阵、
   图片与原文审核及浏览器证据。接受后不改源码/依赖/build输出。
7. 备份有效nginx规则和服务配置，原子更新精确路径分流，nginx -t后reload。
   直接切到刚测试的同一artifact，不再build。其他路径仍走主站。
8. 公网做较小的代表性浏览器检查及影响路径读回，不重复整个420状态。
   保留旧JS/CSS资源的fallback，避免已打开页面切换时资源404。
9. 回滚：恢复已保存的精确nginx规则并test/reload，再停止失败zone；
   原主站/旧zone必须已保留可用，不重建它们。

## 当前生产锚点（操作前必须重新读取）

政策内容变更还须遵守 [证据同步 runbook](policy-evidence-integration-runbook.md)：使用合同 2.0.0，切换前执行 `node scripts/uapt-release.mjs verify-sync <event.json> <basis-file> candidate`，同一产物上线并实际公网读回后执行 complete 阶段。缺 changes/history/diff、MCP 全 ID、摘要暂缓或运行时一致性凭据不能记为完成。历史脚本通过当前 guarded adapter 执行；这项规范更新没有改动当前生产服务。

| 项目 | 2026-10-07实测值 |
| --- | --- |
| 原主站 | uapt-web.service，127.0.0.1:3100，622e996... |
| 十校zone | uapt-v5-ten.service，127.0.0.1:3121 |
| 应用SHA | ed48e0c0844912d094235b8771a1adac0132f97b |
| BUILD_ID | 7-d6RustjW9Fhc6a1iXyn |
| 代码目录 | /srv/uapt/releases/uapt-ten-ed48e0c/apps/tulsa-zone |
| 内容目录 | /srv/uapt/content/ten-ed48e0c |
| 内容revision | universities-v5-001 |
| 内容hash | 1cc7a21f79ae7ad7dfa49029b09df0d397f21d149238c5253fd043625bf2c49f |
| 旧Tulsa回滚/资源fallback | uapt-tulsa-v5.service，127.0.0.1:3120 |
| nginx分流文件 | /etc/nginx/snippets/uapt-tulsa-locations.conf |
| 新zone proxy | /etc/nginx/snippets/uapt-ten-proxy-common.conf |
| 资源前缀 | /tulsa-v5（历史名称，十校共享） |
| 整批nginx回滚备份 | /etc/nginx/backups/uapt/ten-v5-ed48e0c/ |

旧历史名称保留用于兼容，不是仅Tulsa生效。端口、SHA、路径都是本次
快照，不可直接当成下一次部署目标。不得清理active/rollback/旧资源依赖。

## 必须保留的稳定性措施

- 精确路由白名单、独立assetPrefix、跨zone完整文档导航；禁止泛化nginx
  规则吞掉整个`/universities`、API、私有接口或预览路径。
- 70个SSR页面保持`private, no-store, no-transform`。公网曾因Cloudflare
  邮件混淆改写原文触发hydration错误；局部no-transform修复后源HTML与
  浏览器引用一致。不要为此关闭全站Cloudflare安全设置。
  [Cloudflare官方说明](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/)
- 原主站提供zone所需未变数据。如果大版本更新改变共享组件、数据指纹、
  API契约或语言策略，必须协调zone升级/重新验收或移除覆盖，不可只切
  主站后让zone继续读取不兼容数据。
- canonical政策数据提升、正式审批、证据语义审核与展示发布是不同范围。
  本批只发布网站补充资料，不自动新增API主张或推进整份数据release。
- 五语言英文正文回退仍须明确显示；界面语言可用不等于全文翻译完成。
- 当前月报未接入这个生产loader。少量月报更新优先做有界适配/B，而不
  默认全站build；不能因为已有月报Node原型就宣称可直接走A上线。

## 证据

原始实测报告：[十校上线结果](ten-runtime-zone-release/RESULT.md)。
若当前checkout没有该报告，查看本地保存副本：
`/Users/newvolume/Documents/uapt-tulsa-runtime-zone/docs/ten-runtime-zone-release/RESULT.md`。
报告数据来自真实OCI与公网验收；不覆盖全站压力或长期稳定性结论。

## 2026-10-16 必须通过的生命周期门禁

快速发布还必须遵守 [服务生命周期与容量门禁](release-lifecycle.md)。保留旧 artifact 不等于保留旧进程；固定槽位、容量检查、持久化切换恢复、静态资源迁移和旧 active 退役都是完成条件。禁止继续运行按版本创建常驻服务的一次性 cutover 脚本。事故遗留动态依赖只允许登记并逐项迁移，不得随发布扩张。
