# eduaipolicy.org 全面审计报告（2026-11-21）

状态：只读审计。本报告没有修改生产环境，没有 push、部署、重启，也没有发送通知。
服务器上的所有测量都是只读的（`/proc`、cgroup、systemd、journal、nginx 日志与 `nginx -T`、`du`）。
对公网只发了 3 个串行请求。另一个会话（server-retention-fixes，分支
`claude/laughing-murdock-3c9e56`）正在准备服务器修复，本报告引用它的结论，但不重复它的工作。

附属证据文件（英文）：

- [`incidents.md`](incidents.md)：79 条事故清单，含分类、证据和损失。
- [`tooling-inventory.md`](tooling-inventory.md)：发布工具、脚本副本与漂移清单。

说明：本仓库是公开仓库，本文不含任何密钥、令牌或主机 IP。

---

## 0. 一页结论

**为什么总出问题？** 最根本的原因有两个，其他问题大多由它们引出。

1. **运行架构与数据规模、流量不匹配。** 815 所学校乘以 33 种阅读语言，仅学校页就有约 2.7 万个
   URL，变更页更多。可是线上把每个页面都交给**一个** Node 进程按需渲染（SSR/ISR），
   渲染缓存只放在内存里，容量约 1,300 页，覆盖不到 5%。所以：
   - 爬虫一来就是冷渲染，进程长期吃满约 1 个 CPU 核；
   - 每次重启要预热 23–43 分钟；
   - 每次内容切换泄漏约 0.4 GB 内存；
   - 在没有 swap 的机器上，进程卡在 MemoryHigh，造成 41 分钟的 504（11-21）。

   缓存层还在放大问题：
   - nginx 和 Cloudflare 的缓存键包含无意义的 `?returnTo=` 参数，占源站请求的 18–23%；
   - Cloudflare 边缘缓存只保留 2 小时；
   - 每次发布都清空全部缓存（3 天 8 次）；
   - nginx 每个 worker 只允许 1,024 个文件句柄，仅今天就报了 7,738 次 "Too many open files"。
2. **发布链路不在仓库里，而是按批复制。**
   - V6 流水线有 112 个脚本副本，分散在 3 个批次目录里；`host-release.py` 有 9 份。
   - 服务器上的内容切换工具是 11-09 的旧拷贝，所以 11-19 的修复从未生效，"页面改了但缓存
     没过期"的问题反复出现。
   - 生产控制器和多个关键脚本来自尚未合并的分支。

   结果是修复传不下去，每个批次都要重新踩坑，还要靠手工步骤补救。

再往下的原因依次是：

- 门禁"拒绝了却没有自助修复路径"（陈旧的保留回执、暂留期限、同步证明每次整份复制 2.3 GB）；
- 质量门禁缺"覆盖率"维度（中文覆盖、发现阶段是否做完）；
- 远程手工操作缺工具（`pgrep` 等待死循环损失 17 小时）；
- 与其他应用共享主机，没有 swap，磁盘已用 83%。

**前 5 条建议**（详见 §7 和 §8）：

1. **先止血，1 天内可完成，需要 owner 批准。**
   - 安装兄弟会话已准备好的 A–D 步骤：MemoryHigh 设为等于 MemoryMax、web watchdog、
     控制器、暂留期限 14 天。
   - nginx 加 `worker_rlimit_nofile 65536`。
   - Cloudflare WAF 对两个腾讯云网段（43.172/16、43.173/16）做质询或限速。
   - Cloudflare 和 nginx 的缓存键去掉 `returnTo`。
   - 访问日志加上 `upstream_cache_status` 和响应时间。
2. **"每个发布渲染一次并落盘"，取代"每个请求按需渲染并放内存"。**
   - 学校页和变更页设 `revalidate=false`。
   - nginx 磁盘缓存改成持久的"已渲染页面库"（12 GB、30 天）。
   - 内容发布只刷新改动过的 URL，不再全量 purge。
   - 第二步把可索引页面离线预渲染成静态树，由 nginx 直接提供。
   - Node 只处理 API、搜索、MCP 和未命中的请求。
3. **把 V6 流水线收进仓库，变成一套有版本的工具**（`scripts/v6-pipeline/` 加 `batch.json`）。
   - 9 份 `host-release.py` 合并为一个 `content-release` 子命令。
   - 服务器上的 helper 固定到程序发布对应的 SHA。
   - 先合并 4 条带生产代码的未合并分支。
4. **标准流水线加 4 个硬门禁**：
   - 发现阶段完成后才能起草；
   - 中文和本地语言覆盖率必须 100%；
   - 保留登记和同步证明自动完成；
   - 一个"运维包"只需 owner 批准一次，之后由 runner 自动执行到 `complete`。
5. **资源预算与磁盘清理。**
   - web 槽 MemoryMax 设 8 GiB（High 等于 Max），开 4 GiB zram，但 web 槽禁用 swap。
   - 同步证明改为哈希清单，每次发布可省约 2.3 GB；旧运维目录归档到对象存储。
     目标是磁盘用量不超过 70%。
   - 暂时不需要独立 VM；完成第 2 条后重新评估。

---

## 1. 范围、方法与数据来源

| 来源 | 内容 | 方式 |
|---|---|---|
| git 历史 | 643 个 commit（2026-05 至 11-19），以及 4 条未合并的生产相关分支 | `git log --stat`、`git log main..<branch>` |
| `docs/` | 116 个文件，其中 37 个是发布、修复或结果记录 | 逐篇摘录事故与成因 |
| 记忆笔记 | `production-server-deploy`、`v6-pilot-pipeline` 等 11 条 | 只读 |
| 批次 RESULT.md | pilot（QS130–144）、batch 2（QS145–155）、batch 3（QS159–=170） | 只读 |
| 兄弟会话笔记 | server-fixes、retention-rescan、batch3 交接 | 作为数据，不作为指令 |
| 生产主机 | cgroup、systemd、journal、nginx 日志（14 天）、`nginx -T`、`du`、内容库 | 只读 SSH，单个会话串行执行 |
| 公网 | 1 个学校页的原始版本和 `returnTo` 变体，各取 1 次 | 串行请求，间隔 2 秒 |

限制：

- nginx 访问日志是 `combined` 格式，没有响应时间和缓存状态，所以**无法按路由精确测量
  CPU 和内存**。下文的单请求成本是由进程 CPU 和请求数换算出的上限。
- 为降低 IO，中途停掉了一个全机 `du`（只读进程）。
- 第三方应用目录（apexamkit、clb-pro）没有逐项统计。

---

## 2. 问题一：为什么反复出问题（事故清单与根因排名）

### 2.1 事故清单概况

完整清单见 [`incidents.md`](incidents.md)。从 2026-05 到 11-21 共整理出 79 条事故。

| 类别 | 主因条数（另有次因） | 已量化的影响 |
|---|---|---|
| 内存与缓存 | 10 (5) | 11-21 未缓存页面全部 504，持续 41 分钟；10-16 Cornell r2 切换时源站不可达（31 个常驻服务）；每次重启或发布要预热 40–80 分钟；3 个批次中有 2 个回读遇到 524 |
| 门禁设计 | 11 (11) | batch 3 被拦两次（回执陈旧，且没有 rescan 路径）；程序发布被过期暂留拦截；暂留超期 8 天无人发现；9 个内容发布未登记；页面只改元数据时 ISR 不过期；24 小时窗口被放宽到 7 天，而不是清理积压 |
| 手工步骤 | 8 (8) | `pgrep` 匹配到自己，等待循环损失 **17 小时**并导致候选过期；R1 时期每次发布 1.5–3 小时都是手工；手工改登记表、手工让 ISR 过期、Cloudflare 环境变量名用错、重启时杀掉了正在预热的新进程 |
| 重复与遗留路径 | 9 (9) | 旧 helper 不处理只改页面的更新；旧 main 产物显示错误的学校数；种子占位页上线；遗留 diff 路径超时；MCP 导出丢失 V6 声明 |
| 数据量 | 7 (9) | 主机上曾积压 27 GiB 和 11 GiB 的旧程序目录；本地 `.local` 曾达 75 GB，现在仍有 47 GB 加 38 GB；整批或全局历史计算导致 3 次候选超时 |
| 工具蔓延 | 4 (11) | 流水线复制了 3 份；新发布工具第一次使用就暴露 3 个 bug；nginx 配置在 R1 之前有约 13.4 万行 |
| 翻译与模板缺口 | 4 (3) | 197 条 /zh/ 证据行显示英文，为此多发了 2 次版本；22 个已索引页面缺 canonical/hreflang；机器翻译缺陷需要返工 |
| 环境漂移 | 9 (6) | 生产控制器与 main 不一致；源元数据脚本未合并；主 checkout 落后 291 个 commit；主机 Python 3.10 而本地是 3.15 |
| 爬虫负载 | 2 (1) | 11-06 一次巡检 3,906 个 URL 中 375 个超时；11-19 到 21 有约 11 万次腾讯云请求，伴随约 4.5 万次 504 |
| 其他（来源覆盖与准确性） | 15 | **3 个 V6 批次全部**在 24 小时内需要 r2；10 月有 15 次以上准确性重发 |

两组数字最能说明"反复"：

- 历史上 108 个 commit 以 `fix` 开头，59 个集中在 10 月；能识别的后续修正发布（r2/r3/repair）
  至少 18 次。
- V6 批次中 Opus 审查每批要 3–5 轮；每批上线后，ChatGPT 线上复查都会再找出遗漏，导致 r2。

### 2.2 根因排名（按影响）

| 排名 | 根因 | 它解释了哪些事故 | 影响 |
|---|---|---|---|
| **R1** | **运行架构与数据和流量不匹配。** 所有页面按需 SSR/ISR，缓存放内存，单进程，没有 swap，缓存键会碎片化，每次发布全量清缓存 | 10-16 和 11-21 的两次源站故障；11-20/21 约 4.5 万次 504 和约 1.4 万次 500；回读 524；预热等待；发布前的"容量门禁"摩擦 | **最高**：唯一导致对外故障的根因，而且每次发布都会加重 |
| **R2** | **发布链路在仓库外按批复制，生产依赖未合并的代码** | 页面只改元数据时 ISR 不过期（修了 3 次）；helper 版本漂移；数据被硬编码进脚本；生产控制器漂移；"修好了下批又坏" | 高：问题会系统性复发，手工补救多 |
| **R3** | **门禁只会拒绝，没有自助修复路径；存储门禁设计成本高** | 回执陈旧却无法刷新；暂留时钟需要手工处理；同步证明每次复制 2.3 GB；离线归档只能放 owner 的 Mac | 高：batch 3 停了两次；需要 owner 介入；磁盘持续上涨 |
| **R4** | **质量门禁只查"对不对"，不查"全不全"** | 中文 `summaryZh` 缺失；发现阶段没做完就起草，于是 ChatGPT 线上复查找到遗漏，每批都要 r2 | 中高：每批多一次完整发布 |
| **R5** | **远程手工操作缺少工具** | 17 小时等待循环；pidfile 权限；变量名用错；重启时机错误 | 中：单次损失大，但可以用工具消除 |
| **R6** | **共享主机资源边界不清** | 没有 swap，MemoryHigh 设置不当；磁盘 83%；与其他应用争用 CPU | 中：放大了 R1 |
| R7 | 本地环境漂移 | 主 checkout 落后 291 个 commit，有 139 处脏改动和 90 个 "* 2.*" 重复文件；127 个本地分支 | 低到中：主要是"在旧代码上工作"的风险 |

---

## 3. 问题二：数据与运行时

### 3.1 数据规模（2026-11-21 实测）

| 项 | 数值 | 证据 |
|---|---|---|
| 学校数和声明数 | 约 815 所，约 6 千条声明（来自任务背景；`docs/local-v6-identity-dedup-20261019.md` 记录 828 个 slug 合并为 815 所） | — |
| 阅读语言 | 33 种（英文无前缀，另有 32 个前缀）；其中 26 种阅读语言对变更页 `noindex`，并在 robots 中禁止抓取 | `apps/web/lib/language-catalog.ts`、`apps/web/app/robots.ts` |
| 学校页 URL 空间 | 815 × 33 ≈ **26,900**；变更页是"发布 × 学校 × 语言"，空间更大；`returnTo` 变体还会再乘一次 | — |
| 单个学校页大小 | 原始 HTML **737 KB**，gzip 后 114 KB（测试页为 `/de/universities/ghent-university`） | `curl -D -` |
| Next ISR 内存缓存 | `cacheMaxMemorySize` 2 GiB，约 1,300 页，**不到 5%** 的学校页 | `apps/web/next.config.ts` 注释 |
| 运行时内容库 | `objects/` 有 23,089 个对象，2.3 GB；保留 12 个内容发布，链接树共 101 MB | `du`、`find` |
| 单个内容发布（逻辑大小） | 2.0 GB，22,339 个文件：`data` 1.6 GB（13,958 个）、`translations` 334 MB（4,454 个）、`staging` 91 MB、`mcp` 20 MB | `du -shL` |
| 内容切换次数 | 11-05 起共 12 次，其中 11-19 到 21 有 8 次 | `pointer-history.jsonl` |
| nginx HTML 磁盘缓存 | 3.1 GB，已达 3 GB 上限，59,873 个文件；每次发布换 epoch，旧条目只占空间、不再命中 | `du`、`nginx -T` |
| `/srv/uapt` | `operations` **34.5 GB**（102 个目录）、`content` 3.2 GB、`release-helper` 1.8 GB、`app` 1.3 GB（已停用的 3100 旧服务）、`releases` 553 MB、`evidence` 460 MB | `du -d1` |
| 单个 V6 内容运维目录 | 1.8–2.8 GB，其中 `sync/content-candidate` 和 `sync/content-complete` 各 **1.16 GB**，都是完整拷贝（硬链接数 1） | `du -d2`、`stat -c %h` |

### 3.2 数据如何流入运行时

```
批次工作区 (.local, 仓库外)            GitHub Actions (程序, 不含内容)
  discover → capture → draft → review        program-build.yml → artifact
  → source metadata → assemble                       │
        │                                     program-release.py install/candidate/…/cutover
        ▼                                              │
content release (内容寻址)  ──上传运维目录──▶ /srv/uapt/content/runtime/{objects,releases,current.json}
                                                       │  (switch.ts: 指针原子切换 + ISR tag/path 过期)
                                                       ▼
       ┌──────── Next web 槽 3101（单进程, 内存 ISR LRU 2 GiB, 按 contentId 的 JSON/数据集缓存）
       │                ▲ 按需渲染（SSR/ISR, revalidate=3600）
nginx  uapt_html 磁盘缓存（key 含完整 request_uri + rsc 头, 6 h, 发布时换 epoch）
       ▲
Cloudflare 边缘（Cache Rule 2 h，key 含完整 query，发布后 purge_everything）
       ▲
   浏览器 / 爬虫（腾讯云两个 /16 伪装 Chrome UA，不遵守 robots）

MCP 3161：同一 content root，按需读取（136 MB，CPU 很低）
```

### 3.3 运行时实测（只读）

| 指标 | 数值 | 来源 |
|---|---|---|
| 主机 | 4 核，23,980 MB，**无 swap**，可用 15,000 MB；磁盘 146 G，已用 120 G（**83%**），inode 14% | `free`、`swapon`、`df` |
| web 3101 内存 | 重启 2 小时、经过一次内容切换后，`memory.current` 为 5.15 GB（anon 5.03 GB），`memory.peak` 5.98 GB；MemoryHigh 5.5 GiB，Max 6 GiB | cgroup |
| web 3101 CPU | 10 秒采样用 8.47 CPU·秒，约 **0.85 核**；本次进程平均 0.89 核（含预热）；上一个进程 51.5 小时用了 29.1 CPU·小时，平均 0.56 核 | `/proc/<pid>/stat`、systemd `Consumed` |
| 单请求成本（上限） | 约 0.85 核 ÷ 约 3.6 次源站请求每秒 ≈ **每次源站请求 0.24 CPU·秒**；冷渲染墙钟时间 10–110 秒 | 由日志请求数换算 |
| MCP 3161 | 136 MB，两天共用 22 CPU·秒 | systemd |
| nginx | cgroup 2.2 GB，其中 2.08 GB 是可回收的页缓存，anon 90 MB | cgroup |
| 其他应用 | clb-pro 约 1.5 GB，apexamkit 系列约 1.5 GB，Oracle agent 0.5 GB，journald 0.46 GB | cgroup |
| 预热时长 | 11-19 用 1,370 秒（4,008 个请求）；11-21 用 **2,581 秒**（4,021 个请求） | journal |
| OOM | 11-21 18:21:12 memcg OOM 杀掉 next-server，anon-rss 6.2 GB | `journalctl -k` |

nginx 每日源站请求（Cloudflare 之后）：

| 日期 | 总数 | 带 query | 腾讯云 43.172/16 和 43.173/16 | 504 | 500 |
|---|---|---|---|---|---|
| 11-07 | 166,482 | 65,661 | 234 | 595 | 253 |
| 11-13 | 178,616 | 64,826 | 213 | 6 | 3 |
| 11-17 | 210,344 | 67,771 | 8,689 | 831 | 23 |
| 11-19 | 195,240 | 81,286 | 26,796 | 1,144 | 264 |
| 11-20 | **314,735** | 114,517（其中 `returnTo` 57,586） | **50,166** | **19,256** | 5,473 |
| 11-21（截至 20:29） | 263,687 | 104,183（其中 `returnTo` 60,219） | 36,825 | **26,308** | 8,237 |

更多观察：

- **504 按路径分布（11-21）**：`/<语言>/universities` 12,188 次，`/<语言>/changes` 7,188 次，
  `/universities` 3,313 次。所以压力来自学校页和变更页的长尾。
- **语言分布（11-20）**：32 个语言前缀**每个**约 7.4–10.7 千次，加起来约占源站请求的 80%。
  这是爬虫在遍历整个"学校 × 语言"空间，人类访问不会这样均匀。
- **nginx 错误日志（11-21）**：
  - `upstream timed out` 31,454 次；
  - `socket() failed (24: Too many open files)` **7,738 次**；
  - 打开缓存文件时 `Too many open files` 730 次。

  原因是 worker 的 `nofile` 软限制是 1,024，而 `worker_connections` 是 4,096，
  配置里也没有 `worker_rlimit_nofile`。上游变慢时连接堆积，句柄很快耗尽，故障被进一步放大。
- **遗留静态别名**：`/tulsa-v5/_next`、`/policy-*-v5|v6/_next` 等 9 个静态别名
  在 11-20 **0 次命中**。
- **Cloudflare**：首次请求 `cf-cache-status: MISS`，第二次 HIT。`returnTo` 变体在边缘和
  nginx 都是**单独的缓存键**，同一个 737 KB 页面会被缓存多份。源站返回
  `s-maxage=3600, stale-while-revalidate=31532400`。

### 3.4 内存为什么会涨、会卡

这部分与兄弟会话的 `docs/server-fixes-20261121.md`（分支 laughing-murdock）§1 一致：

1. **基线**：ISR LRU 2 GiB，加上预热的约 4 千页、V8 堆和堆外 RSC Buffer，约 4.5 GB。
2. **增长**：进程内缓存（`readContentJson`、`contentScoped`、`BoundedAsyncCache`）
   按 `contentId` 作键。切换后，旧发布的条目永远不会再命中，但只有 LRU 淘汰时才会释放。
   而 LRU 预算按原始 JSON 字节计算，解析后的对象要大好几倍。所以每次切换约增加 0.4 GB。
3. **卡死而不是重启**：MemoryHigh（5.5 GiB）低于真实占用，又没有 swap，匿名页回收不了，
   进程陷入直接回收（D 状态）。它慢到无法应答，却没有被杀掉，等到 6 GiB OOM 才重启，
   中间是 41 分钟的 504。
4. **CPU**：Node 单线程。爬虫遍历长尾，ISR 命中率低于 5%，再加上 `revalidate=3600` 每小时
   触发后台再生成，所以常年约 1 核。

兄弟分支已经修复第 2、3 点（切换时丢弃旧缓存、MemoryHigh 等于 MemoryMax、watchdog），
尚未安装。**第 1、4 点是架构问题，修内存泄漏解决不了。**

### 3.5 架构判断：每个"学校 × 语言"都 SSR/ISR 对吗？

**不对，至少在这台共享主机上不对。** 理由如下：

- 页面是 `(程序版本, 内容发布, 路径)` 的纯函数。内容**只**在发布时变化，而发布会明确给出
  改动的 URL 列表（switch plan）。这种场景应当"每个发布渲染一次并持久化"，不该"按请求渲染、
  放内存、每小时再生成"。
- URL 空间（约 2.7 万学校页，变更页更多，再乘查询变体）比内存缓存大 20 倍以上。
  任何内存方案都挡不住爬虫遍历。
- 每次发布全量 purge（nginx epoch 加 Cloudflare `purge_everything`），等于每次发布都把
  整站打回冷启动；3 天 8 次发布就是 8 次冷启动。

**推荐的目标形态**（分步走，见 §7 阶段 2）：

| 层 | 现在 | 目标 |
|---|---|---|
| 渲染 | 按需 SSR/ISR，`revalidate=3600`，内存 LRU 2 GiB | `revalidate=false`，内容只随发布变化；内存 LRU 降到 0.5–1 GiB |
| 源站页面库 | nginx 3 GB，6 小时，发布即换 epoch | nginx **12 GB，30 天，持久**；内容发布只**刷新**改动的 URL（用只接受本机的 bypass 头取回并覆盖），不换 epoch；程序发布才换 epoch 并做全量预热 |
| 预渲染 | 无，启动后在线预热约 4 千页（23–43 分钟） | 第二步：离线渲染器（Actions arm runner 或本地）把**可索引集合**（英文、中文、学校本地语言，加上目录页和报告页）渲染成静态树，作为内容寻址对象随发布上传；nginx 用 `try_files` 先找静态文件，再回落到 Next |
| 阅读语言长尾（noindex） | 与可索引页同等对待 | 按需渲染，配长 TTL 缓存；不预渲染 |
| Cloudflare | 2 小时，key 含 `returnTo`，每次全量 purge | 7 天；key 只保留白名单参数；内容发布按 URL purge；Smart Tiered Cache |
| Node 的职责 | 所有页面 | API、搜索、MCP、未命中回落、内部刷新 |

这条路线**不需要**改写成 Next 的 `output: export`：程序仍然不含内容，运行时内容机制、
同步合同和回滚机制都保留。第一步只改 nginx、Cloudflare 和三处页面配置，范围小、可回滚。

---

## 4. 问题三：工具蔓延

完整表格见 [`tooling-inventory.md`](tooling-inventory.md)。

| 维度 | 数量 | 说明 |
|---|---|---|
| 仓库内发布入口 | **11 个在用**，**17 个已死或休眠但仍可运行** | 已死的包括默认的 `pnpm build`（仍走 AGENTS.md 禁止的服务器上构建）、`apps/tulsa-zone`（118 MB）、`infra/oci/uapt-mcp.*`，以及 2 篇与 AGENTS.md 冲突却没标 superseded 的部署文档 |
| `scripts/` | 167 个文件；**53 个没有任何引用**；40 个是绑定某所学校或某个日期的一次性脚本 | — |
| npm scripts | 根目录 85 个，全 workspace 126 个 | — |
| CI | 只有 1 个 workflow，手动触发构建；**PR 和 push 时不跑任何检查** | — |
| 仓库外流水线 | 3 个批次目录共 **112 个脚本副本**（31、34、47 个）；31 个同名文件中只有 5 个完全一致 | `openclaw-enrollment/build.py` 在批次之间差 75 行 |
| `host-release.py` | **9 份**（7 份在批次目录，2 份在主 checkout 的 `.local`），每份都硬编码了运维目录、内容 ID、哈希和学校列表 | 仓库和文档里都没有 |
| 服务器 helper | 3 个硬编码路径：`/srv/uapt/release-helper`、`content-priority-six-20261109/helper`（11-09 的 `switch.ts`，不含 ff3d8218 的修复）、`content-9schools-20261106/tools/install-release-tree.py`（只存在于未合并分支） | 是 R2 的直接证据 |
| 未合并分支里的生产代码 | `laughing-murdock`（watchdog、页面预热、保留期 rescan）、`modest-bun`（被前者完全包含，生产控制器正是它）、`v6-source-metadata-contract`（批次流水线依赖它）、`content-9-schools-5fce2c`（`install-release-tree.py`） | — |
| V4/V5/V6 共存 | V6 是主路径；V4 执法页加 V5 文案仍在服务 54 所非完整 V6 学校；V5 场景本地化仍在 zh 页运行；`/api/public/v1/policy-pages/v5.json` 是公开 API | 54 所学校升级到 V6 之前不能删 |
| 服务器 systemd | 44 个 `uapt*` unit 文件：5 个 enabled（2 个服务在运行，另有 recovery 和 2 个 timer），32 个 disabled 的遗留 unit，5 个 transient，2 个 static；libexec 里还有一份 `uapt-release-lifecycle.py.bak` | `systemctl list-unit-files` |
| 控制器里的历史包袱 | `STATIC_CONFIGS` 硬编码 7 个历史 nginx snippet 和 28 个遗留 unit 或 root 名 | 应移入 `policy.json` |

**结论**：

- 程序发布链路基本收敛到一条（Actions 构建、`program-release.py`、控制器）。
- **内容和批次链路没有收敛**：真正在用的编排器（`host-release.py`）不在仓库里，
  服务器上跑的是过期的 helper 副本。
- 这是 R2 的主体。好在这也是改起来最划算的部分。

---

## 5. 问题四：标准流水线规范（crawl → update → release）

### 5.1 原则

1. **代码只有一份，放在仓库里，带版本**：`scripts/v6-pipeline/`。批次目录只放数据和回执，不放代码。
2. **批次就是一个配置文件**：`.local/policy-v6/<batchId>/batch.json`，包括学校列表、父内容发布、
   运维目录名、发现词表与域名、预算。脚本不再硬编码任何批次常量。
3. **每个阶段幂等、可续跑**：输出写到 `stage-<n>/`，附带 `receipt.json`（输入哈希、工具 SHA、时间）；
   重跑时跳过已完成且输入未变的单元。
4. **门禁是机器检查**：每个门禁输出 `gate-<n>.json`（pass/fail、计数、失败清单）。
   失败时给出**下一步自动动作**，而不是"等人"。
5. **审查只由 agent 完成**（AGENTS.md）：独立的更强模型审查，加上逐字引文门禁和校验器。
6. **一次批准**：发布阶段打包成一个"运维包"，owner 说一次"发布 <batchId>"，
   runner 就执行到 `complete`；中途任何门禁失败都自动回滚或停在安全点。

### 5.2 阶段与门禁

| 阶段 | 工具（目标位置） | 产出 | 门禁（全部机器检查） |
|---|---|---|---|
| S0 计划 | `v6:plan --batch batch.json` | 冻结父内容发布（manifest 哈希）、学校清单、预算 | G0：父发布就是当前线上发布；学校不在其他未完成批次中；`retention` 检查通过（提前发现陈旧回执和过期暂留） |
| S1 发现 | `v6:discover`（Crawl4AI 加 Firecrawl），`v6:chatgpt-audit`（ChatGPT Pro 当作发现和审计层，每校一个对话） | 每校的候选来源清单、访问缺口分类 | **G1 发现完成**：每校三路来源（爬取、Firecrawl、ChatGPT）都有回执，或记录了带类型的缺口；ChatGPT 列出的每个官方 URL 都已归类（采用、已覆盖、不重要、访问缺口）。**G1 不通过就不准起草** |
| S2 采集 | `v6:capture`（原始字节、带行号的文本、sha256；仅在普通浏览器无挑战时才渲染采集） | 证据库 | G2：每个将被引用的 URL 都已采集，或有缺口类型（反爬、403、404、无法读取的 PDF）；不绕过任何 bot 检查 |
| S3 起草 | Sonnet 研究 agent 按 `INPUT-SPEC` 写 inputs JSON，**必须同时包含 en、zh 和学校本地语言**（含 `zh.claims` 和 `summaryZh`） | inputs、view | **G3 结构与覆盖率**：schema 通过；逐字引文门禁通过；**语言覆盖门禁**要求每条已链接引用都有 `summaryZh`，标题、摘要、Do/Don't、复核与申诉都有中文，学校本地语言字段齐全；33 种阅读语言的翻译增量由 `reading-delta` 生成，并检查不存在缺键或回落到英文的情况 |
| S4 审查 | Opus 独立审查，循环到没有 blocker 和 fix；并行做 ChatGPT 预发布复核 | `review/independent-review.json` | G4：每校 accept；`fix` 只用于会误导读者的问题；轮数超过 5 时标记为"该校难度高"，可以拆出去，不阻塞全批 |
| S5 源元数据 | 两次独立运行一致，加更强模型裁决（`scripts/v6-source-metadata.py`，合并后） | `source-metadata/*.json` | G5：每个来源都有日期、发布机构，或带类型的缺口；不编造日期；日本年号等非公历日期允许保留原文，并换算成公历 |
| S6 组装 | `v6:assemble`，接着 `content:validate`，然后本地候选回读，最后同步事件 2.1.0 | content release、manifest、改动 URL 清单（含所有语言路径） | G6：校验器通过；**改动页面摘要覆盖所有影响页面的数据文件**（不只看声明）；本地回读 100%；MCP 回读 100% |
| S7 运维包 | `content:bundle` 生成 `/srv/uapt/operations/<op>/`：只含**增量对象**、命令清单、预期哈希、回滚步骤、预期回读集合 | `bundle.json`（带签名哈希） | G7：包内工具 SHA 等于程序发布 SHA（helper 固定）；磁盘余量足够 |
| S8 发布（一次批准） | `content-release.py run --op <op>`：`retention` → `activate` → 预热改动页 → 刷新 nginx 改动 URL → 按 URL purge Cloudflare → 公网回读（1 个 worker） → `complete` → `classify` 和 `record-retention` → OpenClaw 登记 | 回执 | G8：公网回读 100%（524 自动重试 3 次）；完成事件；保留登记新鲜 |
| S9 线上复查 | ChatGPT 对线上页做复查，结果写成**下一批的输入**（`followups.json`） | — | 只有 high 级发现才触发 r2；low 级合入下一批 |

### 5.3 自动处理保留期

- 每个内容 `complete` 之后自动运行：
  - `classify-content-releases`；
  - `record-retention`（刷新 `checkedAt`，保留暂留时钟）；
  - `hold-status --write`。

  这些已在兄弟分支实现。
- 每日 timer 运行 `hold-status`，提前 48 小时预警。超过 7 天的暂留由 runner **自动**处理：
  归档到对象存储、做恢复校验、删除链接树。不再依赖 owner 的 Mac。
- 同步证明（`sync/content-candidate`、`sync/content-complete`）改成**哈希清单加硬链接**，
  不再整份复制 1.16 GB。

### 5.4 预先批准的运维包（一次批准）

- 运维包在本地生成，包含：
  - 需要执行的命令序列；
  - 每一步的前置条件；
  - 回滚命令；
  - 预期哈希；
  - 预计耗时；
  - 会触碰的对外面（Cloudflare purge 的 URL 列表、是否涉及 IndexNow）。
- owner 只批准一次，批准原文写入回执（AGENTS.md 已允许："explicit request to publish
  authorizes the requested release"）。
- runner 在服务器上用 `remote-bg.sh`（兄弟分支）托管，写 pid、退出码和日志。本地只按**确切 PID**
  轮询，禁止用 `pgrep -f`。
- IndexNow 仍需单独授权，不包含在运维包里。

---

## 6. 问题五：资源方案

### 6.1 现状预算（24 GB 共享主机）

| 消耗方 | 当前 | 备注 |
|---|---|---|
| UAPT web 槽 | 5.15 GB（上限 6 GiB） | 程序发布期间另一个槽同时预热 |
| UAPT MCP | 0.14 GB（上限 2.5 GiB） | 上限过宽 |
| nginx | 0.09 GB anon，加 2 GB 可回收页缓存 | — |
| 其他应用 | 约 4–5 GB | clb-pro、apexamkit、监控 agent |
| 可用 | 约 15 GB（含页缓存） | — |

### 6.2 目标预算

| 项 | 目标 | 理由 |
|---|---|---|
| web 槽 | **MemoryMax 8 GiB，MemoryHigh 等于 MemoryMax**；`--max-old-space-size=4096`；`MALLOC_ARENA_MAX=2`；ISR LRU 1 GiB（完成阶段 2 后改为 512 MiB）；`MemorySwapMax=0` | 没有"节流区"：超限就被杀，几秒内由 systemd 重启，watchdog 兜底。修复泄漏后的稳态目标是 4.5 GB 以下，6 GB 告警 |
| 程序发布期间的候选槽 | 上限 6 GiB，预热只覆盖可索引集合 | 峰值是 8 + 6 + 0.3 ≈ 14.3 GiB，加上其他应用约 5 GiB，仍有约 4 GiB 余量。capacity 门禁要求 `MemAvailable` 不小于候选上限加 2 GiB |
| MCP | MemoryMax 1 GiB | 实际只用 136 MB |
| swap 和 zram | **开 4 GiB zram（zstd），不开磁盘 swap**；UAPT web 槽设 `MemorySwapMax=0` | zram 给全机（尤其是其他应用）一点突发缓冲，CPU 开销小。web 槽禁止换出，避免"慢死"。OCI 块存储做 swap 会抖动，不建议 |
| CPU | web 槽 `CPUQuota=200%`；运维任务（tar、du、预热、归档）用 `systemd-run -p CPUWeight=20 -p IOWeight=20` | 完成阶段 1 和 2 后目标：稳态低于 0.3 核 |
| 磁盘 | 用量 **不超过 70%**（约 102 GB）；UAPT 项目预算按控制器的 `projectMaxBytes` 执行 | 可回收约 20–25 GB，见下表 |
| nginx HTML 磁盘缓存 | 腾出空间后从 3 GB 提到 12 GB，`inactive=30d` | 作为持久页面库 |

磁盘回收清单（都要先归档并做恢复校验，再走控制器的白名单）：

| 项 | 约可回收 | 方式 |
|---|---|---|
| 内容运维目录中的同步证明副本（8 个 V6 运维目录） | 约 15–18 GB | 改为哈希清单后，旧证明打包归档 |
| 10 月前后的旧运维目录（如 security-20261023 2.1 GB、prisma7 1.6 GB、berkeley 三个约 1.6 GB） | 约 6–8 GB | 只保留 JSON 回执，大文件归档 |
| `/srv/uapt/app`（3100 旧服务，R1 后已停） | 1.3 GB | 确认冷回滚窗口已过后归档 |
| `/srv/uapt/release-helper` 加 `content-priority-six/helper` | 约 2.9 GB | 用固定到程序 SHA 的单一 helper 替换 |
| 32 个 disabled 遗留 unit 及其 env、drop-in | 小 | 让配置干净，降低控制器复杂度 |

离线归档目标：从 owner 的 Mac（`~/Documents/uapt-offhost-archive`，12 GB）改为对象存储，
例如 OCI Object Storage 或 Cloudflare R2。是否落在免费额度内需要核实。这样 runner 才能自动归档。

### 6.3 要不要独立 VM？

**暂不需要。** 理由：

- 当前的瓶颈不是机器小，而是缓存命中率低于 5%，同时每次发布都全量冷启动。阶段 1 和 2 完成后，
  预期源站 Node 负载会下降一个数量级（多数请求由 nginx 或 Cloudflare 直接返回）。
- 独立 VM 要付费，迁移本身也是一次大发布；而本项目是免费项目。

**触发重新评估的条件**（满足任一即可）：

- 阶段 2 之后 web 槽稳态仍超过 6 GB，或持续超过 1.5 核；
- 其他应用增长，使 `MemAvailable` 经常低于 6 GB；
- 磁盘回收之后仍超过 75%。

那时优先考虑把静态树放到 Cloudflare（R2 或 Pages），让源站只剩 API 和 MCP，
其次再考虑独立 VM。

### 6.4 Cloudflare 缓存策略

1. **缓存键**：
   - HTML 路径只保留白名单 query：`_rsc`，以及列表页真正用到的 `page`、`sort`、`scope`、
     `edition`、`q`。学校页和变更页忽略其余参数。
   - 同时在代码里把 `returnTo` 从 URL 中拿掉，改用 sessionStorage；`saveDiscoveryPosition` 已有基础。
   - nginx 的 `uapt_html` 缓存键做同样的规范化。
2. **TTL**：HTML 边缘 TTL 从 2 小时改为 **7 天**。反正每次发布都会 purge，长 TTL 对内容
   新鲜度没有损失。浏览器端维持 `no-store`。
3. **Smart Tiered Cache**：开启，让同一 URL 只有一个上层节点回源。
4. **purge**：
   - 内容发布只按 URL purge，列表由 switch plan 生成，包含所有语言路径。
   - `_rsc` 请求在边缘直接 bypass，交给 nginx 缓存，这样 URL purge 才精确。
   - 只有程序发布才用 `purge_everything`。
5. **WAF**：
   - 对 Tencent Cloud（AS132203）中观测到的 43.172/16 和 43.173/16 做 managed challenge。
     它们伪装成 Chrome UA，并且无视 robots 的 `/<语言>/changes/` 禁令。
   - 用免费套餐的 1 条限速规则，对 `/*/universities/*` 和 `/*/changes/*` 设单 IP 阈值，
     例如 10 秒超过 60 次就质询。
   - 已验证的搜索引擎 bot 放行。
6. 保持现有排除（`/internal`、`/api/`、`/mcp`、`/search`、`/_next/static/`）。

---

## 7. 重构计划（分阶段）

所有涉及服务器、nginx、Cloudflare、push 或部署的步骤都需要 owner 单独批准。
下文"工作量"按 agent 工作量估算。

### 阶段 0：止血（1 天，低风险，主要是配置）

| # | 动作 | 工作量 | 风险 | 回滚 |
|---|---|---|---|---|
| 0.1 | 按兄弟会话 `docs/server-fixes-20261121.md` §3 安装 A（MemoryHigh 等于 Max）、B（watchdog）、C（控制器和 program-release）、D（14 天暂留、classify、hold-status timer）；预算按 owner 授权提到 8 GiB | 已准备好 | 低到中（C、D 会写登记表） | 文档内已有 |
| 0.2 | nginx `worker_rlimit_nofile 65536;`，并 `nginx -t` 后 reload | 15 分钟 | 低 | 删掉这一行 |
| 0.3 | 访问日志改为带 `$upstream_cache_status $upstream_response_time $request_time` 的 uapt 专用格式 | 15 分钟 | 低 | 换回原格式 |
| 0.4 | Cloudflare WAF：质询腾讯云两个网段，加 1 条限速规则 | 30 分钟 | 低（可能误伤这两个网段里的真实用户，概率很低） | 关掉规则 |
| 0.5 | Cloudflare 和 nginx 缓存键忽略 `returnTo`；边缘 TTL 改为 7 天；开启 Tiered Cache | 1 小时 | 低 | 改回原规则 |

### 阶段 1：收敛工具链（约 1 周，中风险，主要是代码）

| # | 动作 | 工作量 | 风险 |
|---|---|---|---|
| 1.1 | 合并 `laughing-murdock`，删除 `modest-bun` 的分支和 worktree；合并 `v6-source-metadata-contract`；把 `install-release-tree.py` 作为 `scripts/content-release/install-tree.py` 并入；处理 `ea719b70` 双胞胎分支 | 1 天 | 中（需要重跑测试） |
| 1.2 | 新建 `scripts/v6-pipeline/`：以 batch 3 的版本为超集，参数化为 `batch.json`，补 package.json 入口和测试；批次目录只留数据 | 2–3 天 | 中 |
| 1.3 | `scripts/release/content-release.py`（或作为 program-release 的子命令）取代 9 份 `host-release.py`；服务器 helper 固定到程序发布 SHA，作为程序产物的一部分，不再单独 checkout | 1–2 天 | 中 |
| 1.4 | 同步证明改为哈希清单；内容运维包只上传增量对象 | 1 天 | 中（涉及同步合同，需要在 2.1.0 之内保持兼容，或升级到 2.2.0） |
| 1.5 | 新增 CI：PR 时跑 `pnpm check`、`test:program-release`、`test:content-release`、v6-pipeline 测试 | 0.5 天 | 低 |
| 1.6 | 删除：17 个死入口；53 个无引用脚本中的一次性脚本；`apps/tulsa-zone`（先冻结 3 个组件哈希）；`infra/oci/uapt-mcp.*`；把 `pnpm build` 改指向 `program-build.mjs`；2 篇旧部署文档标为 superseded | 1 天 | 低到中 |
| 1.7 | 控制器里的 `STATIC_CONFIGS` 和遗留名移入 `policy.json`；在服务器上清理 32 个 disabled unit、9 个零命中静态别名和 `.bak` 控制器（需批准） | 1 天 | 中 |

### 阶段 2：渲染架构（1–2 周，中风险）

| # | 动作 | 工作量 | 风险 |
|---|---|---|---|
| 2.1 | 代码：学校页和变更页 `revalidate=false`；`returnTo` 改用 sessionStorage；ISR LRU 降到 1 GiB | 1 天加一次程序发布 | 低到中 |
| 2.2 | nginx 持久页面库：`max_size=12g inactive=30d`；内容发布用只接受本机的 `X-UAPT-Refresh` 头 bypass 并覆盖改动 URL（`warm-changed-pages.py` 扩展）；只在程序发布时换 epoch | 2 天 | 中（需要 purge 语义测试） |
| 2.3 | 离线预渲染可索引集合，生成静态树（HTML 加 RSC），作为内容寻址对象；nginx `try_files` 优先静态文件。先验证 HTML 不内嵌 contentId 或时间戳，否则无法跨发布去重 | 1 周 | 中 |
| 2.4 | 预热只覆盖可索引集合；候选槽预热时间目标低于 10 分钟 | 随 2.3 | 低 |

### 阶段 3：遗留退出与可选迁移（之后）

- 把 54 所 V4/V5 执法页学校升级到 V6，然后删除 V4/V5 模块。`v5.json` API 要先有公告期。
- 视 §6.3 的触发条件决定：静态树上 Cloudflare R2 或 Pages，或者独立 VM。
- 本地环境整理：
  - 主 checkout 快进 `main`；
  - 删除 90 个 "* 2.*" 文件；
  - 清理分支（127 个本地分支，其中 10 个按版本建的 security 分支和若干双胞胎分支）；
  - 把明文凭据文件移入 `.local/secrets`；
  - 打包归档 `.local` 中 47 GB 和 38 GB 的历史运行目录（保留 `local-storage-cleanup` 记忆中列出的依赖）。

### 保留不动

- 内容寻址的运行时内容发布（objects 加 releases 加原子指针）。这部分设计是对的：
  12 个发布只占 2.3 GB。
- Actions 构建的、不含内容的程序产物；两个固定槽；最小化 nginx 路由。
- 生命周期控制器的容量、磁盘、journal、恢复门禁；同步合同 2.1.0；逐字引文和哈希门禁；
  只由 agent 审查的政策。
- 历史数据（`data/public-v6-*` 的修订、`public-releases/history`），以及被冻结历史哈希依赖的文件。
- V4/V5 模块：在 54 所学校升级之前保留。

---

## 8. 快速见效清单（Quick wins）

按"收益除以风险"排序。凡是动服务器的，都要 owner 先批准。

| # | 动作 | 预期收益 | 时间 |
|---|---|---|---|
| Q1 | 安装兄弟会话的 A 步（MemoryHigh 等于 Max） | 立刻消除"卡死 41 分钟"的失效模式 | 5 分钟 |
| Q2 | nginx `worker_rlimit_nofile 65536` | 消除每天约 8 千次 "Too many open files" | 15 分钟 |
| Q3 | Cloudflare WAF 质询腾讯云两个网段 | 源站请求预计减少约 14–16%，504 风暴来源被切断 | 30 分钟 |
| Q4 | Cloudflare 和 nginx 缓存键忽略 `returnTo` | 约 20% 的源站请求变成缓存命中 | 1 小时 |
| Q5 | Cloudflare HTML 边缘 TTL 改为 7 天，并开启 Tiered Cache | 爬虫回访不再回源 | 15 分钟 |
| Q6 | 访问日志加缓存状态和响应时间 | 之后能按路由量化，验证 Q3–Q5 的效果 | 15 分钟 |
| Q7 | 安装 watchdog 和 hold-status timer（兄弟会话的 B、D 步） | 卡死自动恢复；暂留提前 48 小时预警 | 30 分钟 |
| Q8 | 合并 4 条带生产代码的分支，删除 `modest-bun` | 结束"生产不等于 main" | 半天 |
| Q9 | `pnpm build` 改指向 `program-build.mjs`；旧部署文档标为 superseded | 防止 agent 误用旧路径 | 30 分钟 |
| Q10 | 在 V6 的 `INPUT-SPEC` 加中文覆盖门禁（`summaryZh` 必填并有校验） | 不会再出现中文页显示英文 | 半天 |
| Q11 | 主 checkout 删除 "* 2.*" 文件并快进 `main`；移走明文凭据文件 | 消除在旧代码上工作的风险 | 15 分钟 |

---

## 9. 证据索引（命令）

服务器命令（只读，均在 `ssh hermes-agent-prod` 中执行）：

```bash
free -m; swapon --show; df -h /; df -i /
systemctl show uapt-mcp-v6-candidate -p MainPID -p ActiveEnterTimestamp -p MemoryHigh -p MemoryMax -p MemoryCurrent -p CPUUsageNSec
cat /sys/fs/cgroup/system.slice/uapt-mcp-v6-candidate.service/{memory.current,memory.peak,memory.stat,cpu.stat}
awk '{print $14+$15}' /proc/<pid>/stat     # 间隔 10 s 采样两次
sudo journalctl -u uapt-mcp-v6-candidate --since 2026-11-05 | grep -E 'warm-up finished|oom|Consumed'
sudo journalctl -k --since 2026-11-01 | grep 'Memory cgroup out of memory'
zcat /var/log/nginx/uapt-access.log.N.gz | awk '...'   # 每日总数 / 状态 / 网段 / query / returnTo
grep -c 'Too many open files' /var/log/nginx/uapt-error.log
grep 'open files' /proc/$(pgrep -f 'nginx: worker' | head -1)/limits
sudo nginx -T | grep -nE 'proxy_cache_path|proxy_cache_key|limit_req|worker_'
sudo du -x -d1 -m /srv/uapt/operations | sort -rn | head
sudo du -shL /srv/uapt/content/runtime/releases/<id>/tree/*
systemctl list-unit-files 'uapt*'
```

仓库内：

- `apps/web/next.config.ts`：`cacheMaxMemorySize`、`isrFlushToDisk: false`。
- `apps/web/app/[locale]/universities/[slug]/page.tsx`：`revalidate = 3600`。
- `apps/web/components/discovery-ui.tsx:174`、`discovery-results.tsx:135`：生成 `?returnTo=`。
- `apps/web/app/robots.ts`：阅读语言的变更页禁止抓取。
- 兄弟分支的 `docs/server-fixes-20261121.md`：`git show claude/laughing-murdock-3c9e56:docs/server-fixes-20261121.md`。

---

## Appendix A (English, for agents)

### A.1 Facts to rely on (measured 2026-11-21, read-only)

- Host `hermes-agent-prod` (shared with other apps):
  - 4 cores, 23,980 MB RAM, **no swap**.
  - Disk 146 G with 120 G used (83%).
- Web slot 3101 (`uapt-mcp-v6-candidate`):
  - Memory: 5.15 GB current (anon 5.03 GB), peak 5.98 GB.
  - Limits: MemoryHigh 5.5 GiB, MemoryMax 6 GiB.
  - CPU: steady ~0.85 core, single Node thread.
  - Warm-up: 1,370–2,581 s per start.
  - Leaks ~0.4 GB per content switch. The fix is on branch `claude/laughing-murdock-3c9e56`, not installed.
- MCP 3161: 136 MB, negligible CPU.
- Origin traffic per day (after Cloudflare):
  - Requests: 166–210k before 11-19, 315k on 11-20.
  - Query strings: 36–40% of requests. `?returnTo=` alone: 18–23%.
  - Tencent Cloud 43.172/16 + 43.173/16: 37–50k/day since 11-19. Spoofed Chrome UA; ignores robots.
  - Errors: 504 19–26k/day, 500 5–8k/day.
  - Every one of the 32 locale prefixes gets ~8k/day, i.e. crawler sweep.
- nginx:
  - Workers have `nofile` 1024 with `worker_connections 4096` and no `worker_rlimit_nofile`.
    That gave 7,738 "Too many open files" on 11-21.
  - The `uapt_html` cache is full at 3 GB (59,873 files). Its key includes the full `request_uri`.
    The epoch changes on every content switch.
- Cloudflare:
  - Edge TTL is 2 h. The cache key includes all query params. Every release does `purge_everything`.
  - A school page is 737 KB raw HTML (114 KB gzip).
- Next:
  - The ISR LRU is 2 GiB in memory (~1,300 pages, <5% of ~26,900 school×locale URLs).
  - School pages have `revalidate = 3600`.
- Content root: 23,089 objects, 2.3 GB.
  - One release is 2.0 GB logical, 22,339 files.
  - 12 releases are kept. 8 switches happened on 11-19..21.
- `/srv/uapt/operations`: 34.5 GB.
  - Each V6 content op is 1.8–2.8 GB.
  - Of that, `sync/content-candidate` + `sync/content-complete` are 1.16 GB each, as full copies with link count 1.
- systemd: 44 `uapt*` unit files: 5 enabled (2 running services, recovery, 2 timers), 32 disabled legacy, 5 transient, 2 static.
  9 legacy static `_next` aliases got 0 hits on 11-20.

### A.2 Root causes, ranked

1. **R1 Runtime architecture vs. data and traffic.**
   - On-demand SSR/ISR with an in-memory cache, one process, no swap.
   - Fragmented cache keys, full purges on every release.
2. **R2 Release path outside the repo, copied per batch.**
   - 112 script copies, 9 `host-release.py`.
   - The host runs the 11-09 `switch.ts`.
   - Production code sits on unmerged branches.
3. **R3 Gates fail closed with no self-service remediation.**
   - Stale retention receipt, hold clocks.
   - Sync proofs copy 2.3 GB per release.
   - Off-host archive lives on the owner's laptop.
4. **R4 Quality gates check correctness, not completeness.**
   - zh coverage is not checked.
   - Discovery is not finished before drafting, so 3/3 batches needed an r2.
5. **R5 Remote manual operations without tooling.** The `pgrep -f` loop cost 17 h.
6. **R6 Shared host without explicit budgets** (no swap, disk 83%).
7. **R7 Local environment drift.** Main checkout 291 commits behind, 90 `* 2.*` files, 127 branches.

### A.3 Standard V6 pipeline contract (target: `scripts/v6-pipeline/`)

- **Config.** `.local/policy-v6/<batchId>/batch.json` holds:
  `batchId`, `schools[]`, `parentContentId`, `parentManifestSha256`, `opDir`,
  `discovery.{vocab,domains}` and `budgets`. Scripts read it and never hard-code batch constants.
- **Stage receipts.** Each stage writes `stage-<n>/receipt.json` with:
  `inputsSha256`, `toolCommit`, `startedAt`, `finishedAt`, `units[]`.
  Reruns skip completed units whose inputs are unchanged.
- **Gates.** Each gate writes `gate-<n>.json` with:
  `{status: pass|fail, counts, failures[], nextAction}`.
  `nextAction` is an agent action, never "wait for a human".

| Stage | Command | Gate (all machine-checked) |
|---|---|---|
| S0 plan | `pnpm v6:plan --batch <batch.json>` | G0: parent equals the live pointer; `uapt-release-lifecycle.py retention` passes; no overlapping open batch |
| S1 discover | `v6:discover` (Crawl4AI + Firecrawl) and `v6:chatgpt-audit` | **G1 discovery complete**: 3 source receipts per school or typed gaps; every ChatGPT-listed official URL classified. **No drafting before G1.** |
| S2 capture | `v6:capture` | G2: every cited URL captured (raw bytes + line text + sha256) or typed gap. Never bypass bot checks. |
| S3 draft | research agent → inputs JSON incl. `zh.claims`/`summaryZh` and school-language fields | **G3 schema + verbatim quote + locale coverage**: 100% `summaryZh` on linked refs; zh title/summary/do-don't/appeals; school-language fields; `reading-delta` has no missing keys or English fallbacks across 33 locales |
| S4 review | Opus independent review loop + ChatGPT pre-release pass | G4: all schools `accept`; `fix` only for misleading problems; >5 rounds → split the school out |
| S5 source metadata | `scripts/v6-source-metadata.py` (two runs + tie-break) | G5: date/issuer or typed gap; no invented dates; keep non-Gregorian originals with a Gregorian conversion |
| S6 assemble | `v6:assemble` → `content:validate` → local candidate readback → sync event 2.1.0 | G6: validators pass; **page digest covers every page-rendering data file** (not just claims); local + MCP readback 100%; changed-URL list includes all locale paths |
| S7 bundle | `content:bundle --op <op>` (delta objects only, commands, expected hashes, rollback, readback set) | G7: bundled tool SHA equals the installed program SHA; disk headroom ok |
| S8 release (**one owner approval**) | `content-release.py run --op <op>`, hosted by `remote-bg.sh`; poll the exact PID only | G8: `retention` → activate → warm changed → refresh nginx changed URLs → Cloudflare purge by URL → public readback 1 worker (retry 524 ×3) → `complete` → `classify-content-releases` + `record-retention` + `hold-status --write` → OpenClaw enrollment |
| S9 live check | ChatGPT live check → `followups.json` | Only `high` findings trigger an r2. Others go to the next batch. |

IndexNow stays outside the bundle and needs its own authorization.

### A.4 Do / don't for agents (until the refactor lands)

**Do:**
- Run `sudo /usr/local/libexec/uapt-release-lifecycle.py retention` before uploading any content op.
- Use 1 worker for public readback.
- Poll host jobs by exact PID from a pidfile.
- Warm changed pages over loopback before purging Cloudflare.

**Don't:**
- Don't create a new `host-release.py` copy. Extend the repo tool, or wait for `scripts/v6-pipeline/`
  and record the gap.
- Don't build helpers early. A helper directory starts a hold clock.
- Don't restart 3101 while systemd's own restart is warming up. Check `ActiveEnterTimestamp` first.
- Don't add per-page nginx locations.
- Don't purge Cloudflare before the nginx refresh.
- Don't publish V6 inputs without zh coverage.

### A.5 Refactor phases (summary)

- **P0 stabilize (1 day, config).**
  - Sibling plan steps A–D, with 8 GiB and MemoryHigh = MemoryMax.
  - `worker_rlimit_nofile 65536`.
  - Access log with `$upstream_cache_status $upstream_response_time $request_time`.
  - Cloudflare WAF challenge for the Tencent ranges plus 1 rate-limit rule.
  - Cache key without `returnTo`. Edge TTL 7 d. Smart Tiered Cache.
- **P1 consolidate (≈1 week, code).**
  - Merge `laughing-murdock`, `v6-source-metadata-contract` and `install-release-tree.py`.
    Drop `modest-bun`.
  - `scripts/v6-pipeline/` driven by `batch.json`.
  - `content-release.py` replaces the 9 `host-release.py` copies. The helper is pinned to the program SHA.
  - Sync proofs become hash manifests.
  - CI on PRs.
  - Delete the 17 dead entry points, the one-offs and `apps/tulsa-zone`.
  - Move the controller's legacy constants into `policy.json`.
- **P2 render once (1–2 weeks).**
  - `revalidate=false`. `returnTo` moves to sessionStorage. ISR LRU 1 GiB.
  - nginx becomes a persistent page store (12 GB, 30 d) with targeted refresh. The epoch changes only on program releases.
  - Offline pre-render of the indexable set into a static tree served by nginx `try_files`.
- **P3 later.**
  - Move the 54 V4/V5 enforcement schools to V6, then remove V4/V5.
  - Consider static on Cloudflare R2/Pages or a separate VM only if the §6.3 triggers fire.
  - Clean up the local environment.

### A.6 Resource targets

| Component | Target |
|---|---|
| Web slot | MemoryMax 8 GiB with MemoryHigh = MemoryMax. Heap 4096 MB, `MALLOC_ARENA_MAX=2`, `MemorySwapMax=0`, `CPUQuota=200%`. Steady state < 4.5 GB, alert at 6 GB |
| Candidate slot | ≤ 6 GiB. The capacity gate requires MemAvailable ≥ cap + 2 GiB |
| MCP | MemoryMax 1 GiB |
| Swap | 4 GiB zram (zstd) host-wide; no disk swap |
| Ops jobs | Run under `systemd-run -p CPUWeight=20 -p IOWeight=20` |
| Disk | ≤ 70%. Reclaim about 20–25 GB: sync-proof copies, pre-November op dirs, `/srv/uapt/app`, duplicate helpers. Archive to object storage, not to the owner's laptop |
| nginx page store | 12 GB after reclaim |
| Separate VM | Not now. Re-evaluate if, after P2, the web slot stays > 6 GB or > 1.5 cores, MemAvailable is often < 6 GB, or disk stays > 75% |
