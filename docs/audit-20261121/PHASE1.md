# 阶段 1（工具链收敛）实施记录 — 2026-11-21

分支 `claude/clever-shirley-462b54`。以 `origin/main` b59ae274 为基线（已 fetch），未 push、未开 PR、未合并到 main。
没有写服务器，也没有部署、重启或发送通知。owner 授权原话（经协调会话转述）："按照你的建议开始执行，你可以开新赛程进行"。
阶段 2（渲染架构，`apps/web` 和 nginx 页面缓存）由另一个会话负责，本阶段只改 `scripts/`、契约、文档和 CI。

## 1.1 集成线

| 来源 | 处理 |
|---|---|
| `claude/laughing-murdock-3c9e56`（server fixes，包含 `modest-bun` 的 84081739） | 已合并两次（第二次带入 4fb783a2、f4e5dc4d），无冲突 |
| `claude/v6-source-metadata-contract`（fbd8e84e） | 已合并，无冲突 |
| `install-release-tree.py`（`claude/content-9-schools-5fce2c` 168c67e2） | 新增为 `scripts/content-release/install-tree.py`。与服务器 op 目录中的副本逐字节一致（sha256 8afeda9d…），只改了 usage 行 |
| `ea719b70` 双胞胎（`codex/v6-english-first-20261117` 和 `codex/v6-source-metadata-pilot`） | **不合并**，详见下方 |
| `claude/modest-bun-549899` | 已被 laughing-murdock 完全包含，无需单独合并。分支本身未删（它在另一个 worktree 中检出），可在合并后清理 |

`ea719b70` 的决定：两个分支指向同一个提交，内容是"英文专用 V6 展示"能力，基线是 b2f04a48（早于 main）。
线上内容 `c-20261121-v6-batch12-zh` 的 `appCompatibility.schemas` 不含 `uapt-v6-english-only-presentation-v1`，说明线上没有依赖它。
它主要修改 `apps/web`（阶段 2 的范围），且没有在当前 main 上重新测试过。因此不并入。
流水线中 `englishOnlySlugs` 非空时，`assemble.ts` 会拒绝并说明原因。
将来需要时，另开一次合并。两个分支保留其一即可（建议保留 `codex/v6-english-first-20261117`）。

## 1.2 `scripts/v6-pipeline/`

- 以 batch 3 的脚本为超集，全部改为读取工作区的 `batch.json`（`uapt-v6-batch-v1`）。批次目录今后只放数据。
- 新增两道硬门禁：
  - G1"发现完成才能起草"：三层发现，每条官方线索都要已抓取或已处置；
  - G3"中文覆盖"：`/zh/` 显示的每一行都必须有中文。
- 新增 `locale-gate.ts`：
  - 在组装后的页面上再跑一次中文检查；
  - 也可以审计任何一个内容发布。
- 新增 `status.py`，显示批次进度和下一步。
- 提示词移入 `prompts/`，并补了 `batch.example.json`。
- 文档：`docs/v6-pipeline.md`。
- **回归验证**：在 batch 3 数据的硬链接副本上运行移植后的 `finalize.ts`。10 个 `view.json` 和 `selection.json` 与原批次产物**逐字节一致**。
  `packets.ts` 的输出与 batch 3 第一轮 packet 只有数据版本差异：当前 view 已包含 r2 修复（`summaryZh`、更新后的文本），逻辑一致。
- **门禁验证**：
  - batch 3 的 10 所学校在 `c-20261121-v6-batch3-r2` 上通过中文门禁；
  - pilot 学校（补中文之前）按预期失败；
  - 在 `c-20261120-v6-batch-qs145-r2` 全量审计时，150 所 V6 学校报告了 1,526 条问题。其中 904 条是 `summaryZh` 缺失，472 条是工具中文说明缺失。
    较早的 V6 学校可能通过其他机制显示中文，因此**这一数字待核实，不能直接认定为线上缺陷**（见"后续事项"）。
- 未移植：
  - OpenClaw enrollment：它会写入 OpenClaw 主机，需要单独审查；
  - zh-backfill 的一次性脚本：`update` 模式已能覆盖这类场景。

## 1.3 `content-release` 统一命令

- `scripts/release/content-release.py` 取代 9 份 `host-release.py`，阶段为 `check`、`activate`、`refresh`、`complete`、`status`，另有 `remote`。
- 覆盖内容：
  - 页面类 ISR 过期；
  - 已改页面预热；
  - `complete` 之后自动执行 `classify-content-releases`（仅当 policy 设置了 `contentReleaseRoot`；兄弟会话的记录显示 D 步已经应用）；
  - 受控 `rescan`，刷新 `checkedAt`，不再出现"回执过期"阻断；
  - 写入 `hold-status`；
  - `remote` 通过 `remote-bg.sh` 按确切 PID 等待。
- `pnpm content:bundle`（`scripts/content-release/bundle.ts`）在本地生成运维包：
  - 增量对象；
  - 脱水后的同步包；
  - ISR 过期请求；
  - `changed-urls.json`。

  owner 只需批准 `bundle.json` 的 SHA256 一次，`activate` 拒绝任何其他字节。
- **helper 固定到程序 SHA**：`program-build.mjs` 把 `release-helper/` 打进每个程序产物，包括：
  - esbuild 打包的 `switch.mjs` 和投影校验器；
  - 主机端 Python 工具；
  - 带文件哈希的 `HELPER.json`。

  `content-release.py` 只接受当前活动程序自己的 `release-helper/`。在下一次程序发布带上它之前，需要显式传入 `--legacy-helper-reason`，原因会写进回执。
  打包时发现一个隐患并已修正：打包后被导入模块的 CLI 入口判断也会触发（`validate.ts` 曾在 `switch.mjs` 中打印 usage）。
- 给阶段 2 的接口：`refresh` 步骤读取 `changed-urls.json`（`uapt-changed-urls-v1`）。
  若存在 `/usr/local/libexec/uapt-origin-refresh` 钩子则调用它，否则回退到现在的 epoch 全量清除。
  接口约定见 `docs/content-release.md` §5.2。

## 1.4 同步证明改为哈希清单

`scripts/content-release/sync-proof.py` 提供 `dehydrate`、`materialize`、`verify` 三个命令：

- 上传时只带 `proof-manifest.json`；
- 在主机上从内容对象库硬链接回原路径，并校验大小和 SHA256；
- gate 读取的路径和字节与以前完全相同，**合同 2.1.0 不变，无需升级版本**。

每次发布在 `/srv/uapt/operations` 中可省约 2.3 GB。`complete` 之后再次脱水。

## 1.5 PR CI

新增 `.github/workflows/ci.yml`，在 PR 和 main 上运行：

- 发布工具、内容发布、V6 流水线、源元数据的测试，Python 3.10 和 3.12 各跑一遍；
- web 类型检查；
- PR 改动的 `git diff --check`。

不用密钥，不部署。

## 1.6 删除

- 45 个无调用方的一次性脚本。
- 预 R1 的服务器构建路径：
  - `uapt-release.mjs` 只保留 `verify-sync`；
  - 删除 `release-build-pipeline.mjs`、`prepare-web-runtime-data.mjs`、`validate-web-runtime-data.ts` 及其测试；
  - 删除 `infra/oci/uapt-mcp.*`。
- `pnpm build` 改为 `program-build.mjs build --local`（本地诊断，Q9）。
- 两篇旧部署文档标为 superseded；`content-release.md` 中的 3100 端口示例已修正。
- 保留：
  - `apps/tulsa-zone` 与 V4/V5 模块（历史哈希和 54 所执法页依赖它们）；
  - `prepare-candidate-build-inputs.ts`（测试依赖）；
  - 休眠的 maintenance promoter（AGENTS.md 仍提到它，删除需要 owner 决定）。

## 测试

| 套件 | 结果 |
|---|---|
| `pnpm test:program-release`（含新 `test_content_release_host.py`） | 199 OK |
| 同一组 Python 测试加流水线与源元数据，在 Python 3.10（主机版本）上 | 219 OK |
| `pnpm test:program-build`（含 release-helper 打包测试） | 8 pass + 9 OK |
| `pnpm test:content-release`（含 `content-bundle.test.ts`） | 37 pass |
| `pnpm test:v6-pipeline` | tsc 通过；16 OK；4 pass |
| `pnpm test:v6-source-metadata` | 4 OK |
| `pnpm check`（全部数据校验、typecheck、lint） | 通过（exit 0） |
| `git diff --check` | 通过 |

`tests/policy-sync-v2.test.py`（不在任何 npm 脚本中）在基线上就失败：仓库数据已选用 Changes v2，2.0.0 夹具会被 gate 拒绝。这与本阶段无关，记为后续事项。

## 尚未完成和后续事项

1. **合并或开 PR 需要 owner 批准。** 合并后，需要一次**程序发布**把 `release-helper/` 带上线，之后内容发布才能去掉 `--legacy-helper-reason`。
2. 1.7（服务器清理）按指示未做。
3. 移植 OpenClaw enrollment 脚本。
4. 核实旧 V6 学校的 1,526 条中文覆盖问题：是真缺失，还是由其他层提供中文。
5. 把学校本地语言纳入覆盖门禁（目前 V6 输入只有英文和中文）。
6. 修复或删除 `policy-sync-v2.test.py` 的 2.0.0 夹具。
7. 清理分支：`modest-bun` 和 `ea719b70` 的一个双胞胎。
