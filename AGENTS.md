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

## Website Release Policy

Choose the release method using `docs/release-routing-policy.md`.
Small updates default to `docs/oci-small-release.md`; full OCI build-once in
`docs/oci-build-once-release.md` is reserved for large/global version updates.
Do not default to a full Mac or full-site production build for a few pages.

- Compatible content in an existing runtime zone: validate an immutable public
  package, accept it on a candidate, atomically select its content pointer, and
  read back affected routes. No build/restart. Honor the current schema, record
  counts, claim fingerprints and controlled image-serving capability.
- Small UI/code, new bounded routes or incompatible content schema: build only
  the isolated zone on OCI from a frozen pushed SHA. Do not run the main web or
  recursive whole-workspace build. Reuse the existing shared zone rather than
  creating one service per university. Monthly reports still require an
  adapter/pilot; do not claim they are already production runtime content.
- Full/shared layout, framework/dependency, global locale/routing, widespread
  API/data-contract updates: use one authoritative OCI full build and candidate
  acceptance. Coordinate existing zone overrides and their data dependencies.
- Local gates remain data/allowlist validation, `pnpm check`, explicit zone
  typecheck/related regressions, `git diff --check`, and useful dev/browser QA.
  These are not a requirement to build all pages locally.
- Keep source, public content and private candidate inventories separate.
  Preserve original quotations, source scope, language fallbacks and gaps;
  review promotion explicitly and exclude private fields from public packages.
- Freeze code SHA/artifact for code releases, and revision/hash/app-data
  compatibility for content releases. Keep candidates isolated from live
  content pointers and active build trees. Never patch mixed `.next` output.
- Validate all affected locales and unchanged controls, record actual coverage,
  SHA/BUILD_ID/content/data hashes and evidence. Do not hard-code 70/420/938.
- Only tested exact URL paths switch in nginx; keep distinct assets and hard
  cross-zone navigation, old-resource fallback and `no-transform` for original
  evidence. Preserve production loopback users/permissions/env.
- Current runtime zone reads unchanged canonical APIs from the main service on
  3100; full-site candidates self-fetch their own candidate port. Read the
  small-release runbook before choosing INTERNAL_NEXT_BASE_URL.
- After acceptance use the same artifact/package, bounded public smoke, then
  authorized changed-URL notifications. Retain old code/content/nginx/service
  configuration; rollback restores them without rebuilding.

These rules supersede previous mandatory full-build instructions for small
releases. A documentation-only request never authorizes deployment, build,
restart, cutover, push or notifications. Preserve historical acceptance results.

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

Preview changed URLs in the current release without sending network requests:

```bash
pnpm indexnow:dry-run
```

Submit changed URLs for the latest published release:

```bash
pnpm indexnow:latest --sync-ledger <event.json>
```

Submit all URLs from site sitemaps (full site indexing):

```bash
pnpm indexnow:all --sync-ledger <event.json>
```

Run test suite:

```bash
pnpm test:indexnow
```

## 快速上线生命周期硬约束（2026-10-16）

- 先读 `docs/release-lifecycle.md`。快速发布必须通过服务器固定服务登记、容量门禁和同步合同；统一入口 `scripts/uapt-release-lifecycle.py`。禁止新建按学校/版本常驻的 service，禁止绕过入口重跑私有 cutover/旧脚本。
- 版本目录/旧 unit/env/内容/Nginx 配置保留用于冷回滚；旧 JS/CSS 迁移到受控 Nginx 静态目录，逐字节验证后原服务 stop + disable。旧进程仍有动态/内部依赖则登记有界迁移缺口，不可只按旧名称停止，也不可随下一次发布扩大 legacy 集合。
- 固定 active/candidate 槽位最多并存一组候选，候选最长 4 小时；发布前和切换前均检查 MemAvailable、UAPT 总预算、build/候选峰值及 MemoryHigh/Max。禁止并发历史预热，未完成事务或未退役旧 active 阻止下一次上线。
- 候选必须先 enable/start 并通过语义健康检查，再写持久化 journal 和切换路由。中断/开机先恢复一致状态；公网回读与 complete 同步门禁后必须完成旧 active 退役，才可报告发布完成。静态、动态、API、MCP、历史版本和 held 审批边界继续保留。

## 发布磁盘与版本保留硬约束（2026-10-24）

- 先读 `docs/release-storage-policy.md`。以最新已验收线上基线整合 main；禁止用主工作区旧分支覆盖新学校、安全修复或其他聊天的未提交改动。
- 固定服务角色保留当前、明确的上一已验收回滚与有界候选。V4/V5 功能保留不等于保留每次完整程序发布；政策历史和证据独立保留。
- Changes v2/overview 发布须用同步合同 2.1.0；保留旧 2.0.0 历史依据，不把本地 45 校包覆盖最新已发布学校。
- 使用服务器已安装生命周期控制器与含 diskCapacity 的当前 policy。计划必须绑定磁盘各阶段峰值预算、每角色包体上限及 24 小时内逐版本保留收据；缺项、空间/inode不足、超项目预算或未分类旧目录均阻止上线。不得调用历史控制器绕过新门禁，也不得自动上调预算。
- 生产包仅带该次运行/构建必需文件，不上传完整工作区、私有审核包、截图或旧归档。每次上线后更新版本保留台账，旧目录不能无期限累积。
- 清理只能使用精确白名单；服务器外完整归档、哈希/内容校验、隔离恢复检查和删除前最新引用复查通过后才移除原件。保护运行 catalog、有效配置、历史、held、证据及回滚；禁止按年龄或布局版本自动删除。
