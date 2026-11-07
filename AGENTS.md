# Agent Notes

## Policy Evidence Inventory and Synchronization

- Use `docs/policy-evidence-integration-runbook.md` and the versioned audit
  requirements registry for policy crawl, review, repair and indexing tasks.
  Read the private current inventory pointer before starting; preserve its
  frozen parent, raw evidence, historical versions and all held decisions.
- On remote maintenance hosts without the private inventory, record
  `inventory_not_available_on_host`. Source-health scans may continue, but this
  is a material gap and cannot support a COMPLETED university audit.
- Audit complete public Claim ID sets, plus explicitly listed supplementary,
  tool and student-summary objects. Record remaining IDs and requirement gaps;
  retrieval failure does not establish absence of a policy. Quote matching
  does not establish semantic accuracy, temporal validity or approval.
- Every task records a synchronization event. Each applicable surface needs
  artifact evidence; exclusions need a reason. A public policy change must
  update the corresponding university changes/history/diff surfaces in the
  same release. Check APIs, tools, student snapshots, MCP, search, runtime,
  sitemap and notification eligibility rather than assuming regeneration.
- Verify the candidate event before promotion and the completion event after
  authorized cutover. Candidate readback cannot stand in for public readback;
  notification acceptance cannot stand in for indexing. Keep explicit holds.
  The maintenance promoter requires `--sync-ledger`; other release entry
  points require the same event checks until their adapters are implemented.
- New promotions, actual snapshot re-pins and live IndexNow submissions require
  synchronization contract 2.0.0. Releases carrying public-change-history v2 or
  V6 change-overview packages require contract 2.1.0, which includes all 2.0.0
  checks plus deterministic event artifact validation. Unknown versions fail
  closed; historical unversioned audit receipts remain audit-only. Legacy repair/content scripts must run through
  `scripts/run-synchronized-policy-mutation.ts` with a frozen entry hash and
  exact basis; process success remains completion-pending until public readback.
  Use `scripts/policy-inventory-status.py` to check the pointer, cache, knowledge
  and requirement version. Fresh material metadata does not establish current
  university policy. Do not rerun legacy workspace publishers outside the adapter.
- Private inventory/bundles are not production loaders or publishable data.
  Integration, local validation or documentation work does not authorize
  push, deployment, restart, cutover or search notifications.

## Website Release Method (since R1, 2026-11-06)

Production is one Next.js web service plus one MCP service on host
`hermes-agent-prod`. Two fixed web slots alternate per release
(`uapt-mcp-v6-candidate` on 127.0.0.1:3101 and `uapt-mcp-v6-r2` on 3102, names
historical); MCP is `uapt-shared-v6-r2` on 3161. Check `systemctl is-active`
for the active slot; never assume it. Program (code) and content ship
separately. Read the doc for the kind of change before starting:

| Change | Path | Doc |
|---|---|---|
| Policy claims, school pages, reports, translations, history (data only) | Runtime **content release**: `pnpm content:correct` (claim corrections) or `content:build`, then `content:validate`, sync contract 2.1.0 event, `content:switch --sync-ledger` on the host. No build, no restart: web and MCP follow the pointer. | `docs/content-release.md` |
| Code, UI, routes, dependencies, schemas, aliases, marks, UI copy | **Program release**: build once in GitHub Actions (`program-build.yml`, frozen 40-hex SHA, `ubuntu-24.04-arm`), then on the host run `/usr/local/libexec/uapt-program-release.py` steps in order: `install` → `candidate` (warm-up) → `static` → `capacity` → `routing` → `ledger` → `plan` → `cutover` → `mcp` → `complete`. | `docs/program-release.md` §2–§7 |

Rules:

- Never build on the server and never run `next build` as a release. The
  artifact is content-free; content comes only from the runtime content root
  `/srv/uapt/content/runtime` (`current.json` with a 2.1.0 sync receipt).
- The release command only prepares inputs; the installed lifecycle controller
  `/usr/local/libexec/uapt-release-lifecycle.py` keeps every gate (capacity,
  disk, retention register, sync contract, journal, recovery) and updates the
  retention register at `complete`. Do not hand-run cutovers, hand-edit routing
  outside `routing`, or call historical controllers or per-zone scripts.
- Every program release runs the `mcp` step between `cutover` and `complete` (trial on 3162, then one MCP
  restart with automatic restore). `plan` refuses if MCP was left on a
  program root that `complete` would hold.
- nginx is the minimal routing (`docs/program-release.md` §6): static aliases,
  redirects, MCP, cached prefixes and one `location /` → `upstream
  uapt_next_backend`. A cutover only retargets `uapt-main-upstream.conf`. Do not
  add per-page `location =` entries or per-school zones again.
- Wait for the candidate's warm-up (`Runtime warm-up finished`, 25–45 min on
  this host) before cutover when possible; cold renders take 10–110 s.
- nginx keeps a disk HTML cache in front of the app (`docs/program-release.md` §6.1).
  `cutover` purges it; after a content switch run
  `uapt-program-release.py purge-html-cache --reason "content switch <id>"` first.
- Cloudflare caches public HTML for 2 h (Cache Rule; `/internal`, `/api/`,
  `/mcp`, `/search`, `/_next/static/` excluded). After every content switch or
  program cutover, purge the whole zone (`{"purge_everything": true}`, token
  in `.env.agents.local`, never printed). A URL purge misses `?_rsc=` variants.
- Local gates: `pnpm check`, the affected test suites, `git diff --check`, and
  useful dev/browser QA. Do not build all pages locally.
- Keep source, public content and private candidate inventories separate.
  Preserve original quotations, scope, language fallbacks, gaps and held
  decisions; exclude private fields from public packages. English is required,
  Simplified Chinese second, plus the school's country language.
- After acceptance: public readback, then purge, then (separately authorized)
  IndexNow for the changed URLs. Old releases stay as `rollback`/`held` in the
  register until the storage rules archive them.

Authorization: a documentation, review or local-validation request never
authorizes a push, merge, build, deployment, restart, cutover, Cloudflare purge
or search notification. Ask, then quote the user's approval in the receipts.

Historical (before 2026-11-05, kept for old receipts only): per-zone OCI
builds, `docs/release-routing-policy.md`, `docs/oci-small-release.md`,
`docs/oci-build-once-release.md`, the 3100 main service and exact-URL nginx
switching. Do not use them for new releases.

## Google Search Console Access

Agents can pull Google Search Console data for `https://eduaipolicy.org`
through a local service-account credential. The credential is intentionally
stored outside Git:

- env file: `.env.agents.local`
- key file: `.local/secrets/gsc-eduaipolicy-service-account.json`
- property: `sc-domain:eduaipolicy.org`

Before querying GSC, load the local env file:

```bash
set -a
source .env.agents.local
set +a
```

Do not print or commit the JSON key. Confirm the local files are ignored before
using or modifying them:

```bash
git check-ignore -v .env.agents.local .local/secrets/gsc-eduaipolicy-service-account.json
```

Use the readonly Search Console scope:

```text
https://www.googleapis.com/auth/webmasters.readonly
```

Minimal Node query, with no extra packages:

```bash
set -a
source .env.agents.local
set +a

node <<'JS'
const fs = require("fs");
const crypto = require("crypto");

const creds = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
const site = process.env.GSC_SITE_URL;
const b64url = (value) =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const assertionInput = [
  b64url({ alg: "RS256", typ: "JWT" }),
  b64url({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }),
].join(".");
const assertion = [
  assertionInput,
  crypto.sign("RSA-SHA256", Buffer.from(assertionInput), creds.private_key).toString("base64url"),
].join(".");

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  }),
});
const token = await tokenRes.json();
if (!tokenRes.ok) throw new Error(JSON.stringify(token));

const gscRes = await fetch(
  `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
  {
    method: "POST",
    headers: {
      authorization: `Bearer ${token.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      startDate: "2026-05-10",
      endDate: "2026-05-17",
      dimensions: ["date"],
      rowLimit: 25,
      dataState: "all",
    }),
  },
);
const data = await gscRes.json();
console.log(JSON.stringify({ ok: gscRes.ok, status: gscRes.status, rows: data.rows ?? [] }, null, 2));
JS
```

For analysis, separate GSC search visibility metrics from onsite analytics.
GSC rows provide search-side `clicks`, `impressions`, `ctr`, and `position`;
they do not explain onsite engagement by themselves.

## Microsoft IndexNow Integration

IndexNow notifies Microsoft Bing, Yandex, Seznam, and partner engines about URL changes immediately.

- Host: `eduaipolicy.org`
- Key file: `apps/web/public/8373fa05a76a4d59abadbe13a617acb0.txt`
- Verification URL: `https://eduaipolicy.org/8373fa05a76a4d59abadbe13a617acb0.txt`
- CLI tool: `scripts/submit-indexnow.ts`

### Commands

The basis is the selected runtime content release (`--content-root` or
`UAPT_CONTENT_ROOT`; see `docs/content-release.md`): its `manifest.json` binds
the sync ledger and its content switch plan lists the changed URLs.

Preview the selected release's changed URLs without sending network requests:

```bash
pnpm indexnow:dry-run --content-root <content-root>
```

Submit them after public readback:

```bash
pnpm indexnow:latest --content-root <content-root> --sync-ledger <event.json>
```

Submit all URLs from site sitemaps (full site indexing):

```bash
pnpm indexnow:all --content-root <content-root> --sync-ledger <event.json>
```

Run test suite:

```bash
pnpm test:indexnow
```

## 快速上线生命周期硬约束（2026-10-16）

- 先读 `docs/release-lifecycle.md` 与 `docs/program-release.md` §7。快速发布必须通过服务器固定服务登记、容量门禁和同步合同；程序发布入口为 `/usr/local/libexec/uapt-program-release.py`（它调用已安装的 `uapt-release-lifecycle.py` 控制器），内容发布入口为 `pnpm content:*`。禁止新建按学校/版本常驻的 service，禁止绕过入口重跑私有 cutover/旧脚本。
- 版本目录/旧 unit/env/内容/Nginx 配置保留用于冷回滚；旧 JS/CSS 迁移到受控 Nginx 静态目录，逐字节验证后原服务 stop + disable。旧进程仍有动态/内部依赖则登记有界迁移缺口，不可只按旧名称停止，也不可随下一次发布扩大 legacy 集合。
- 固定 active/candidate 槽位最多并存一组候选，候选最长 8 小时（2026-11-03 授权）；发布前和切换前均检查 MemAvailable、UAPT 总预算、build/候选峰值及 MemoryHigh/Max。禁止并发历史预热，未完成事务或未退役旧 active 阻止下一次上线。
- 候选必须先 enable/start 并通过语义健康检查，再写持久化 journal 和切换路由。中断/开机先恢复一致状态；公网回读与 complete 同步门禁后必须完成旧 active 退役，才可报告发布完成。静态、动态、API、MCP、历史版本和 held 审批边界继续保留。

## 发布磁盘与版本保留硬约束（2026-10-24）

- 先读 `docs/release-storage-policy.md`。以最新已验收线上基线整合 main；禁止用主工作区旧分支覆盖新学校、安全修复或其他聊天的未提交改动。
- 固定服务角色保留当前、明确的上一已验收回滚与有界候选。V4/V5 功能保留不等于保留每次完整程序发布；政策历史和证据独立保留。
- Changes v2/overview 发布须用同步合同 2.1.0；保留旧 2.0.0 历史依据，不把本地 45 校包覆盖最新已发布学校。
- 使用服务器已安装生命周期控制器与含 diskCapacity 的当前 policy。计划必须绑定磁盘各阶段峰值预算、每角色包体上限及 24 小时内逐版本保留收据；缺项、空间/inode不足、超项目预算或未分类旧目录均阻止上线。不得调用历史控制器绕过新门禁，也不得自动上调预算。
- 生产包仅带该次运行/构建必需文件，不上传完整工作区、私有审核包、截图或旧归档。每次上线后更新版本保留台账，旧目录不能无期限累积。
- 清理只能使用精确白名单；服务器外完整归档、哈希/内容校验、隔离恢复检查和删除前最新引用复查通过后才移除原件。保护运行 catalog、有效配置、历史、held、证据及回滚；禁止按年龄或布局版本自动删除。
- 暂留不得无期限续期：启用 retentionEnforcement 的服务器上，held 和 temporaryArtifacts 必须保留首次 heldSince、原始 reviewBefore、具体 nextAction；当前用户明确授权 24 小时复查提醒、首次暂留满 7 天阻断（maxHoldHours/blockAfterHours=168）。刷新清单不得重置时钟、延长期限或伪装成回滚；超过实际阻断期限阻止新发布，不自动删除证据。引用收据仍须 24 小时内复查，空间与验收门禁不放宽。构建/候选目录、源码压缩包和暂存公开内容也必须逐项登记；发布前执行只读 retention 检查。
