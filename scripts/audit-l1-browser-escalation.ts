/**
 * L1 browser escalation: the URLs plain HTTP could not resolve.
 *
 * Input is l1-escalations.json from `pnpm audit:l1-live-fetch`, i.e. three
 * kinds of failure:
 *   render_required — HTTP 200 but a JS shell with no extractable text
 *   fetch_error     — network, TLS or DNS failure
 *   blocked         — HTTP 403 on a path robots.txt explicitly allows
 *
 * Where the line is, because it matters for the `blocked` group:
 *
 *   This renders publicly available pages that the site's own robots.txt
 *   permits us to fetch. It identifies itself: the User-Agent is a genuine
 *   browser capability string with our bot identity appended, so a site owner
 *   reading their logs sees exactly who we are. That is a well-behaved research
 *   crawler, not a disguise.
 *
 *   It does NOT defeat access controls. No CAPTCHA or bot challenge is ever
 *   solved, no login is attempted, no paywall is crossed, and no cookie or
 *   consent wall is accepted. A page presenting any of those is recorded as
 *   `access_controlled` and abandoned. URLs disallowed by robots.txt were
 *   excluded upstream and are never revisited here.
 *
 * Playwright is resolved from the npx cache rather than added to the repo's
 * dependencies: this is a one-off audit tool, and a browser-sized devDependency
 * would slow every production `pnpm install --frozen-lockfile`. Override with
 * PLAYWRIGHT_MODULE=/path/to/playwright.
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { findRepoRoot } from "../apps/web/lib/repo-root";

const require_ = createRequire(import.meta.url);

// Truthful: a real capability string so WAF rules can parse it, plus our own
// identity so we remain attributable. Not an anonymous browser impersonation.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/141.0.0.0 Safari/537.36 UniversityAIPolicyTrackerBot/0.1 " +
  "(+https://eduaipolicy.org/methodology)";

const RENDER_TEXT_THRESHOLD = 400;
const NAV_TIMEOUT_MS = 45_000;
const DEFAULT_SETTLE_MS = 2_500;
const DOMAIN_DELAY_MS = 2_000;

// Signals that we have hit something we must not push through. Deliberately
// broad: a false positive costs one unresolved URL, a false negative would mean
// trying to work around an access control.
const CHALLENGE_PATTERN =
  /(captcha|recaptcha|hcaptcha|cloudflare|checking your browser|verify (?:you are|that you are) (?:a )?human|are you a robot|bot detection|access denied|forbidden|unusual traffic|ddos protection|attention required|just a moment|please enable (?:js|javascript) and cookies)/i;
// Same tombstone fingerprint the HTTP pass uses: a page that renders fine but
// says "page not found" is still a dead citation, not a recovery.
const SOFT_404_PATTERN =
  /(page (?:not|cannot be|could not be) found|could not be found|no longer (?:available|exists)|has been (?:deleted|removed|moved)|does not exist|error 404|404 error|sivua ei l[öo]ytynyt|seite nicht gefunden|p[áa]gina no encontrada|pagina non trovata|page introuvable|页面不存在|找不到页面|未找到|无法找到|페이지를 찾을 수 없습니다|ページが見つかりません)/i;
const LOGIN_PATTERN =
  /(sign in|log ?in|single sign-?on|shibboleth|\bsso\b|username and password|authentication required|please authenticate|subscribe to (?:read|continue)|paywall)/i;

type EscalationStatus =
  | "access_controlled"
  | "browser_error"
  | "dead"
  | "recovered"
  | "soft_404"
  | "still_empty";

interface QueueItem {
  entitySlugs: string[];
  host: string;
  httpStatus?: number;
  reason: string;
  sourceUrl: string;
}

interface EscalationRow {
  contentHash?: string;
  detectedGate?: string;
  entitySlugs: string[];
  error?: string;
  fetchedAt: string;
  finalUrl?: string;
  host: string;
  httpReason: string;
  httpStatus?: number;
  /** Body is a binary document (PDF); contentHash is over bytes. */
  isBinary?: boolean;
  matchesStagedHash?: boolean;
  sourceUrl: string;
  status: EscalationStatus;
  textLength: number;
  title?: string;
}

void main();

async function main(): Promise<void> {
  const repoRoot = await findRepoRoot();
  const options = parseArgs(process.argv.slice(2));
  const queueFile = options.queue ?? (await findLatestQueue(repoRoot));
  const runDir = path.dirname(queueFile);
  const outputDir = path.join(runDir, "escalation");
  await mkdir(path.join(outputDir, "pages"), { recursive: true });

  const queue = (JSON.parse(await readFile(queueFile, "utf8")).playwright ?? []) as QueueItem[];
  const items = options.limit ? queue.slice(0, options.limit) : queue;
  const baselines = await collectStagedBaselines(repoRoot);

  const playwright = loadPlaywright();
  console.log(`L1 browser escalation — ${items.length} URLs from ${path.basename(queueFile)}`);
  console.log(`output: ${outputDir}\n`);

  const browser = await playwright.chromium.launch({ headless: true });
  const rows: EscalationRow[] = [];

  try {
    // Group by registrable domain so one institution is never hit in parallel,
    // and give each worker its own context so cookies never leak between sites.
    const byDomain = new Map<string, QueueItem[]>();
    for (const item of items) {
      const domain = registrableDomain(item.host);
      byDomain.set(domain, [...(byDomain.get(domain) ?? []), item]);
    }

    const domains = [...byDomain.values()];
    let cursor = 0;
    let done = 0;

    const worker = async (): Promise<void> => {
      for (;;) {
        const group = domains[cursor++];
        if (!group) return;
        const context = await browser.newContext({
          ignoreHTTPSErrors: true,
          userAgent: USER_AGENT
        });
        try {
          for (const item of group) {
            rows.push(await visit(context, item, baselines, outputDir, options.settleMs));
            done += 1;
            if (done % 25 === 0) {
              console.log(`  ${done}/${items.length} ${summaryLine(rows)}`);
              await writeJson(path.join(outputDir, "rows.partial.json"), rows);
            }
            await sleep(DOMAIN_DELAY_MS);
          }
        } finally {
          await context.close().catch(() => undefined);
        }
      }
    };

    await Promise.all(Array.from({ length: options.concurrency }, worker));
  } finally {
    await browser.close().catch(() => undefined);
  }

  rows.sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl));
  const report = {
    generatedAt: new Date().toISOString(),
    note:
      "Renders robots-allowed public pages with an identifying User-Agent. Never solves a CAPTCHA or bot challenge, authenticates, or crosses a paywall; such pages are recorded as access_controlled and left alone.",
    queueFile,
    rows,
    schemaVersion: "uapt-full-audit-l1-escalation-v1",
    summary: summarize(rows)
  };
  await writeJson(path.join(outputDir, "escalation-report.json"), report);
  await writeFile(path.join(outputDir, "escalation-summary.md"), renderMarkdown(report), "utf8");

  console.log(`\n${JSON.stringify(report.summary, null, 2)}`);
  console.log(`\nOutput: ${outputDir}`);
}

async function visit(
  context: BrowserContextLike,
  item: QueueItem,
  baselines: Map<string, string>,
  outputDir: string,
  settleMs: number
): Promise<EscalationRow> {
  const base = {
    entitySlugs: item.entitySlugs,
    fetchedAt: new Date().toISOString(),
    host: item.host,
    httpReason: item.reason,
    sourceUrl: item.sourceUrl,
    textLength: 0
  };
  // Known-binary targets: navigating just aborts with "Download is starting",
  // so go straight to the bytes.
  if (/\.pdf($|\?)/i.test(item.sourceUrl) || item.reason === "attachment") {
    const binary = await fetchBinary(context, item.sourceUrl);
    if (binary) {
      return {
        ...base,
        contentHash: binary.contentHash,
        httpStatus: binary.status,
        isBinary: true,
        matchesStagedHash: baselines.has(item.sourceUrl)
          ? binary.contentHash === baselines.get(item.sourceUrl)
          : undefined,
        status: "recovered",
        textLength: binary.bytes
      };
    }
  }

  const page = await context.newPage();

  try {
    const response = await page.goto(item.sourceUrl, {
      timeout: NAV_TIMEOUT_MS,
      waitUntil: "domcontentloaded"
    });
    // Give client-side rendering a moment; networkidle hangs on pages with
    // long-polling or analytics beacons, so settle on a fixed budget instead.
    await page.waitForTimeout(settleMs);

    const status = response?.status();
    const finalUrl = page.url();
    const title = await page.title().catch(() => undefined);
    const text = normalizeSpace(
      await page.evaluate("document.body ? document.body.innerText : ''").catch(() => "")
    );

    if (status === 404 || status === 410) {
      return { ...base, finalUrl, httpStatus: status, status: "dead", title };
    }

    const gate = detectGate(title, text, status);
    if (gate) {
      return {
        ...base,
        detectedGate: gate,
        finalUrl,
        httpStatus: status,
        status: "access_controlled",
        textLength: text.length,
        title
      };
    }

    if (SOFT_404_PATTERN.test(`${title ?? ""}\n${text.slice(0, 3000)}`)) {
      return {
        ...base,
        finalUrl,
        httpStatus: status,
        status: "soft_404",
        textLength: text.length,
        title
      };
    }

    if (text.length < RENDER_TEXT_THRESHOLD) {
      return {
        ...base,
        finalUrl,
        httpStatus: status,
        status: "still_empty",
        textLength: text.length,
        title
      };
    }

    const contentHash = sha256(text);
    await writeFile(
      path.join(outputDir, "pages", `${hashKey(item.sourceUrl)}.txt`),
      text,
      "utf8"
    );

    return {
      ...base,
      contentHash,
      finalUrl,
      httpStatus: status,
      // Rendered innerText is not the same string the HTTP path hashes, so this
      // is reported for information only, never as a change verdict.
      matchesStagedHash: baselines.get(item.sourceUrl)
        ? contentHash === baselines.get(item.sourceUrl)
        : undefined,
      status: "recovered",
      textLength: text.length,
      title
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);

    // Not a failure: the server sent Content-Disposition: attachment, so
    // Chromium started a download rather than rendering. These are PDFs behind
    // the same UA filter, and the browser context can still fetch the bytes.
    if (/Download is starting/i.test(message)) {
      const binary = await fetchBinary(context, item.sourceUrl);
      if (binary) {
        return {
          ...base,
          contentHash: binary.contentHash,
          httpStatus: binary.status,
          isBinary: true,
          matchesStagedHash: baselines.has(item.sourceUrl)
            ? binary.contentHash === baselines.get(item.sourceUrl)
            : undefined,
          status: "recovered",
          textLength: binary.bytes
        };
      }
    }

    return { ...base, error: message, status: "browser_error" };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function fetchBinary(
  context: BrowserContextLike,
  url: string
): Promise<{ bytes: number; contentHash: string; status: number } | undefined> {
  try {
    const response = await context.request.get(url, { timeout: NAV_TIMEOUT_MS });
    if (!response.ok()) return undefined;
    const body = await response.body();
    return {
      bytes: body.byteLength,
      contentHash: createHash("sha256").update(body).digest("hex"),
      status: response.status()
    };
  } catch {
    return undefined;
  }
}

/** Returns a label when the page is a gate we must not push through. */
function detectGate(
  title: string | undefined,
  text: string,
  status: number | undefined
): string | undefined {
  const probe = `${title ?? ""}\n${text.slice(0, 4000)}`;
  if (CHALLENGE_PATTERN.test(probe)) return "bot_challenge_or_captcha";
  if (LOGIN_PATTERN.test(probe) && text.length < 3000) return "login_or_paywall";
  if (status === 401 || status === 402 || status === 403) return `http_${status}`;
  return undefined;
}

interface BrowserContextLike {
  close(): Promise<void>;
  request: {
    get(
      url: string,
      options: { timeout: number }
    ): Promise<{ body(): Promise<Buffer>; ok(): boolean; status(): number }>;
  };
  newPage(): Promise<{
    close(): Promise<void>;
    evaluate(script: string): Promise<string>;
    goto(
      url: string,
      options: { timeout: number; waitUntil: string }
    ): Promise<{ status(): number } | null>;
    title(): Promise<string>;
    url(): string;
    waitForTimeout(ms: number): Promise<void>;
  }>;
}

function loadPlaywright(): {
  chromium: {
    launch(options: { headless: boolean }): Promise<{
      close(): Promise<void>;
      newContext(options: {
        ignoreHTTPSErrors: boolean;
        userAgent: string;
      }): Promise<BrowserContextLike>;
    }>;
  };
} {
  const override = process.env.PLAYWRIGHT_MODULE;
  const candidates = override ? [override] : discoverPlaywright();
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return require_(candidate);
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    `Could not load Playwright. Tried:\n  ${errors.join("\n  ")}\n` +
      "Set PLAYWRIGHT_MODULE to a playwright install whose browsers are present."
  );
}

// Several Playwright versions may sit in the npx cache, each pinned to a
// different Chromium revision, and most of those revisions are not downloaded.
// Rank candidates by whether their browser is actually present so we use an
// installed browser instead of prompting for a fresh ~150MB download.
function discoverPlaywright(): string[] {
  const { existsSync, readdirSync } = require_("node:fs") as typeof import("node:fs");
  const browserRoot = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  const npxRoot = path.join(os.homedir(), ".npm", "_npx");

  const hasBrowser = (moduleDir: string): boolean => {
    try {
      const core = path.join(path.dirname(moduleDir), "playwright-core", "browsers.json");
      const revision = (
        JSON.parse(readFileSync(core, "utf8")) as {
          browsers: Array<{ name: string; revision: string }>;
        }
      ).browsers.find((entry) => entry.name === "chromium")?.revision;
      return Boolean(
        revision &&
          (existsSync(path.join(browserRoot, `chromium-${revision}`)) ||
            existsSync(path.join(browserRoot, `chromium_headless_shell-${revision}`)))
      );
    } catch {
      return false;
    }
  };

  const candidates: string[] = [];
  try {
    for (const entry of readdirSync(npxRoot)) {
      const candidate = path.join(npxRoot, entry, "node_modules", "playwright");
      if (existsSync(path.join(candidate, "package.json"))) candidates.push(candidate);
    }
  } catch {
    // No npx cache.
  }

  const ready = candidates.filter(hasBrowser);
  return [...ready, "playwright", ...candidates.filter((c) => !ready.includes(c))];
}

async function collectStagedBaselines(repoRoot: string): Promise<Map<string, string>> {
  const baselines = new Map<string, string>();
  for (const root of [
    path.join(repoRoot, "staging", "uapt-runs"),
    path.join(repoRoot, "data", "openclaw-staging")
  ]) {
    let dirs: string[];
    try {
      dirs = await readdir(root);
    } catch {
      continue;
    }
    for (const dir of dirs) {
      let files: string[];
      try {
        files = await readdir(path.join(root, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(await readFile(path.join(root, dir, file), "utf8"));
        } catch {
          continue;
        }
        const items = Array.isArray((parsed as { artifacts?: unknown[] })?.artifacts)
          ? ((parsed as { artifacts: unknown[] }).artifacts as Record<string, unknown>[])
          : [parsed as Record<string, unknown>];
        for (const item of items) {
          if (item?.artifactType !== "source_snapshot") continue;
          if (typeof item.contentHash === "string" && typeof item.sourceUrl === "string") {
            baselines.set(item.sourceUrl, item.contentHash);
          }
        }
      }
    }
  }
  return baselines;
}

async function findLatestQueue(repoRoot: string): Promise<string> {
  const root = path.join(repoRoot, ".local", "full-audit");
  const l0 = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("l0-"))
    .map((entry) => entry.name)
    .sort()
    .at(-1);
  if (!l0) throw new Error(`No L0 run under ${root}`);
  const l1 = (await readdir(path.join(root, l0), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("l1-"))
    .map((entry) => entry.name)
    .sort()
    .at(-1);
  if (!l1) throw new Error(`No L1 run under ${path.join(root, l0)}`);
  return path.join(root, l0, l1, "l1-escalations.json");
}

function summarize(rows: EscalationRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function summaryLine(rows: EscalationRow[]): string {
  return Object.entries(summarize(rows))
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
}

function renderMarkdown(report: {
  note: string;
  rows: EscalationRow[];
  summary: Record<string, number>;
}): string {
  const lines = [
    "# L1 Browser Escalation",
    "",
    report.note,
    "",
    "| Status | Count |",
    "| --- | ---: |",
    ...Object.entries(report.summary).map(([key, value]) => `| \`${key}\` | ${value} |`),
    "",
    "## Recovery by original HTTP failure",
    "",
    "| HTTP reason | Recovered | Still unresolved |",
    "| --- | ---: | ---: |"
  ];
  for (const reason of ["render_required", "fetch_error", "blocked"]) {
    const subset = report.rows.filter((row) => row.httpReason === reason);
    const recovered = subset.filter((row) => row.status === "recovered").length;
    lines.push(`| \`${reason}\` | ${recovered} | ${subset.length - recovered} |`);
  }

  const gated = report.rows.filter((row) => row.status === "access_controlled");
  if (gated.length) {
    lines.push(
      "",
      `## Access-controlled — left alone, not worked around (${gated.length})`,
      "",
      "| Host | Gate |",
      "| --- | --- |"
    );
    const byHost = new Map<string, string>();
    for (const row of gated) byHost.set(row.host, row.detectedGate ?? "unknown");
    for (const [host, gate] of [...byHost].slice(0, 50)) lines.push(`| ${host} | \`${gate}\` |`);
  }

  return `${lines.join("\n")}\n`;
}

function parseArgs(args: string[]): {
  concurrency: number;
  limit?: number;
  queue?: string;
  settleMs: number;
} {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith("--")) continue;
    const [flag, inline] = args[index].slice(2).split("=");
    values.set(flag, inline ?? args[index + 1] ?? "");
  }
  return {
    concurrency: Number(values.get("concurrency")) || 4,
    limit: values.has("limit") ? Number(values.get("limit")) : undefined,
    queue: values.get("queue") || undefined,
    settleMs: Number(values.get("settle")) || DEFAULT_SETTLE_MS
  };
}

const MULTI_PART_TLDS = new Set(["ac", "co", "com", "edu", "gov", "net", "or", "org", "sch"]);

function registrableDomain(host: string): string {
  const parts = host.toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-(MULTI_PART_TLDS.has(parts[parts.length - 2]) ? 3 : 2)).join(".");
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashKey(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 32);
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
