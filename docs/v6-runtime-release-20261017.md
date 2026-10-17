# 2026-10-17 V6 共享运行时局部发布结果

状态：已上线、已公网回读、已完成旧 active 退役。清华未改动，未启动其新爬取或 V6 提升。
本次不是全站构建，没有更新主站或 MCP 运行代码，没有改变政策记录、Claim ID、审批、
held、正式学生摘要 pin 或历史冻结包；没有提交 IndexNow。

## 冻结身份和范围

- 应用源码：`f4347c0d880d3e04c214f9e59ba902b687c1e204`；包括前三次本地修复、
  历史来源哈希合并与冲突门禁、新资源前缀，以及首次构建的明确 prebuild 准入。
- OCI 构建目录：`/srv/uapt/releases/uapt-v6-runtime-f4347c0d`。
- BUILD_ID：`rILV8sOq8A8LHfOQ2huEu`；资源前缀：`/policy-v6-runtime-20261017`。
- 构建后 8,412 个 Git 源文件/符号链接逐项 hash 与冻结清单一致。
- 控制器后续修订：`12ce33af2e60155c7bd664ef405e11a9948e0b0b`；安装脚本 SHA256：
  `a0d84d0b226054a362dd800d754bf802ac8f0f22fbca4e0722d5a9c5647ffb71`。
  仅增加相同语义断言的有界重试，应用产物仍是上面的同一次构建，未混入不同 `.next`。
- 页面/记录内容修订仍为 `cornell-v6-r2-20261016`，全局数据 release 保持原值。
- 复用现有共享 Zone，承接原配置的 450 条精确路径和新增 14 条大学/QS目录路径，
  共 464 条路由配置记录；其中 MCP 路径仍指向原 3118，sitemap alias 等保持原产物。
  16 校×7语言详情、API/changes/history 等按实际清单验收，不扩大成通配代理。
- 主站其他路径保持原服务；主站源代码中的相关 helper 变化未冒称全站运行升级。
  仍在 legacy 服务上的历史路径保留原上游。9 个 legacy 服务清单没有增长。

## 执行和容量

通过 `uapt-release-lifecycle.py` 的 prebuild → gate → cutover → public sync → complete。
固定 web candidate 槽位作为新的 active；未创建学校/版本常驻服务。
构建限定 `@uapt/tulsa-zone`，在 `uapt-build.scope` 内执行，MemoryMax 1.75 GiB。
依赖锁文件及 Prisma schema 与旧服务一致后，复制依赖到独立候选目录，未修改旧产物。
没有执行主站 build、递归 workspace build 或 Mac production build。

实测构建编译约 8.1 秒、类型检查 12.2 秒，生成 68 个 Zone 静态项。
构建产生一个动态文件追踪范围警告，已保留日志；本次用完整冻结 release 运行，
并验证实际 shard 安装和全部源文件，未宣称 standalone 最小追踪包已优化。

| 阶段 | 保守实测峰值字节 |
| --- | ---: |
| OCI build | 1,286,144,000 |
| startup | 417,501,184 |
| cold history | 471,777,280 |
| steady route sweep / 4-request control | 1,011,216,384 |

运行时数值取阶段采样 memory.current 和 kernel memory.peak 的较大值；后者可能带有
前阶段高水位，因此是保守边界。计划预算 1,879,048,192 字节，没有扩大服务器
host reserve/UAPT admission 预算。此为真实候选诊断，不是高并发压力或长期容量承诺。

## 实际验收

- 本地 23 项相关回归、完整 `pnpm check`、Zone typecheck；控制器最终 10 项测试，
  包含 provisional 预算不能进入 cutover、短暂旧响应重试和持续失败拒绝。
- 候选 474 次 HTTP 检查，含完整路由清单、冷/热历史和四请求并发对照。
- 公网 474 次检查：457 个 200、16 个与旧服务相同的预期 404、1 个 MCP GET 405。
  404 是已有未发布/缺失记录的既有行为，未把它们标成成功内容响应。
  新发布路径核对冻结 release header、no-transform、正文完整 Claim 文字、当前与
  历史 JSON Claim 内容、metadata 和唯一 WebPage/Dataset JSON-LD。
- 47 个旧/新 JS/CSS 等静态文件经生产 TLS 逐字节 hash、MIME 和 immutable 缓存头验证，
  退役旧进程后再次通过。旧 `.next/static` 已独立归档到受控 Nginx 静态目录。
- 76 次公网 MCP 调用对齐全部 16 校、507 个 Claim IDs 及原文证据；保留既有服务/catalog。
- 真浏览器：目录 Cornell 47 Claims /17来源、UCL 14/12；中文来源哈希详情；
  390/720/1440 无水平溢出；三校按需对比、差异筛选和 CSV 实际下载；
  Harvard 中文 metadata 和 WebPage/Dataset JSON-LD。首页、清华原页面为未改对照。
- 停止旧 active 后另做 9 条公网语义抽查，47 个资源再次通过。

来源哈希 registry 现在按 URL＋捕获版本追加，未知条目不能覆盖已验证口径；
冲突拒绝。Cornell 已验证口径保留，其他未取得字节凭据的历史来源继续 unknown_legacy。
未发布私有预览保持 noindex，不借用公共 Dataset 为候选背书。

## 回滚与故障记录

首次切流在公网语义检查失败后自动恢复旧路由并停用候选；当次未报告上线完成。
第二次记录到首个响应语义不匹配、同 URL 同断言重试后通过，符合 graceful reload /
边缘既有连接的短暂传播现象。没有删除断言或降低验收标准；持续失败仍自动回滚。
最终控制器签收、原 active 停止禁用后才记录 complete。

验收脚本的初始失败也保留：Python HTTPS 请求被边缘拒绝后用 curl 正常回读；
不属于本次接管范围的旧历史路径作为原上游对照；MCP GET 405 按其真实 POST-only
协议验收，并另用 76 次 POST 证据调用核对。未修改公共路由去迁就测试假设。

旧 active `uapt-shared-v6-r2.service` 已 inactive/disabled；
新 active `uapt-shared-v6-candidate.service` 为 active/enabled，NRestarts=0。
main/MCP 未更换运行产物。服务器事务 stage 为 complete，旧端口 3161 已不在有效
Nginx 配置，内部 env/unit 未发现该 endpoint 引用。

保留原 release、unit/env、原路由和事务备份。已完成事务的 `recover` 不会自动倒退；
如需回滚，按冻结事务的 beforePolicy/files 先启动旧服务并做语义健康检查，再恢复
旧路由、nginx test/reload、核对公网后停用失败服务，恢复角色登记；不需要重建。
未在正式签收后故意切回旧版冒称做过线上灾难演练。

服务器凭据：`/srv/uapt/operations/v6-runtime-20261017/`；
完成同步 ledger：该目录下 `completion/event.json`，合同 2.0.0、要求版本 1.1.0。
本地取回副本及 Gemini 复核入口：`.local/v6-release-20261017/`。
本次网页政策内容没有重新审核；Gemini 尚未对本轮公网发布独立验收。
