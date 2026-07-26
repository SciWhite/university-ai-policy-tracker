/**
 * L1 live fetch for the full-dataset re-check.
 *
 * Reads the L1 target list produced by `pnpm audit:l0-consistency` and fetches
 * every published source URL once, HTTP-first, then compares what the live page
 * serves today against the contentHash recorded by the original crawl in the
 * staged `source_snapshot` artifacts.
 *
 * Two facts this design rests on, both measured before the runner was written:
 *
 *   1. The HTML-stripping extractor below reproduces staged
 *      `source_snapshot.contentHash` exactly on unchanged pages (verified on a
 *      sample: 4/16 matched, and the 12 that differed were all real content
 *      drift, not a normalization artifact). So hash inequality is a usable
 *      change signal rather than noise.
 *   2. Extracted text is stable across repeat fetches seconds apart (16/16 on
 *      the same sample), so a single fetch per URL is enough; a differing hash
 *      is not fetch jitter.
 *
 * What this layer does NOT do: decide whether a policy changed. Whole-page text
 * includes navigation, banners and footers, so a hash change means "the page
 * is not byte-identical", not "the policy moved". Classifying which changes are
 * policy-relevant is L2/L3 work, anchored on the published evidence snippets.
 * L1's job is reachability, relocation, and an honest change signal.
 *
 * Politeness: robots.txt is fetched once per origin and obeyed (a disallowed URL
 * is never requested), and requests are serialized per registrable domain with a
 * fixed delay between them. Serializing per *domain* rather than per host
 * matters: stanford.edu spreads 14 target URLs over many subdomains, which a
 * per-host queue would fire at one university's infrastructure simultaneously.
 * Global concurrency is capped on top of that.
 *
 * Output goes to .local/full-audit/<run-id>/ which is gitignored. Extracted
 * page text is cached there for L2 anchoring; no raw HTML, PDF bytes, or
 * screenshots are written anywhere, and nothing is written into the repo.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { findRepoRoot } from "../apps/web/lib/repo-root";

const OUTPUT_ROOT = ".local/full-audit";
const USER_AGENT =
  "UniversityAIPolicyTrackerBot/0.1 (+https://eduaipolicy.org/methodology)";
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_HOST_DELAY_MS = 1_500;
const MAX_BYTES = 4_000_000;
const FLUSH_EVERY = 100;

// Shared with scripts/maintenance-http-first-scan.ts so an L1 baseline and a
// maintenance run produce comparable hashes for the same page.
const SOFT_404_PATTERN =
  /(page (?:not|cannot be|could not be) found|could not be found|no longer (?:available|exists)|has been (?:deleted|removed|moved)|does not exist|error 404|404 error|sivua ei l[öo]ytynyt|seite nicht gefunden|p[áa]gina no encontrada|pagina non trovata|page introuvable|页面不存在|找不到页面|未找到|无法找到|페이지를 찾을 수 없습니다|ページが見つかりません)/i;
const POLICY_SIGNAL_PATTERN =
  /\b(ai|artificial intelligence|generative ai|genai|chatgpt|copilot|deepseek|academic integrity|student conduct|assessment|exam|coursework|syllabus)\b/i;
const RENDER_TEXT_THRESHOLD = 400;

type L1Status =
  | "blocked"
  | "changed_no_signal"
  | "changed_policy_signal"
  | "dead"
  | "fetch_error"
  | "moved_changed_content"
  | "moved_same_content"
  | "no_baseline"
  | "render_required"
  | "robots_disallowed"
  | "soft_404"
  | "unchanged";

interface L1Target {
  entitySlugs: string[];
  evidenceCount: number;
  host: string;
  isPdf: boolean;
  sourceUrl: string;
}

interface StagedBaseline {
  contentHash: string;
  fetchedAt: string;
  finalUrl?: string;
  runId: string;
  sourceTitle?: string;
}

interface L1Row {
  bytes?: number;
  contentHash?: string;
  contentType?: string;
  durationMs: number;
  entitySlugs: string[];
  error?: string;
  etag?: string;
  evidenceCount: number;
  fetchedAt: string;
  finalUrl?: string;
  host: string;
  httpStatus?: number;
  isPdf: boolean;
  /** Body was served as PDF, so contentHash is over bytes, not extracted text. */
  isPdfDocument?: boolean;
  lastModified?: string;
  needsEscalation?: "firecrawl" | "playwright";
  redirected: boolean;
  sourceUrl: string;
  staged?: StagedBaseline;
  status: L1Status;
  textLength: number;
  title?: string;
  /** Body hit the byte cap, so contentHash covers a prefix only. */
  truncated?: boolean;
}

interface CliOptions {
  concurrency: number;
  hostDelayMs: number;
  limit?: number;
  outputDir?: string;
  targetsFile?: string;
  timeoutMs: number;
}

void main();

async function main(): Promise<void> {
  const repoRoot = await findRepoRoot();
  const options = parseArgs(process.argv.slice(2));
  const targetsFile = options.targetsFile ?? (await findLatestTargets(repoRoot));
  const parsedTargets = JSON.parse(await readFile(targetsFile, "utf8")) as {
    releaseId: string;
    targets: L1Target[];
  };
  const runId = `l1-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const outputDir =
    options.outputDir ?? path.join(repoRoot, OUTPUT_ROOT, path.basename(path.dirname(targetsFile)), runId);
  await mkdir(path.join(outputDir, "pages"), { recursive: true });

  const baselines = await collectStagedBaselines(repoRoot);
  const targets = options.limit
    ? parsedTargets.targets.slice(0, options.limit)
    : parsedTargets.targets;

  console.log(`L1 live fetch ${runId}`);
  console.log(`targets: ${targets.length}  hosts: ${new Set(targets.map((t) => t.host)).size}`);
  console.log(`staged baselines: ${baselines.size} URLs`);
  console.log(`output: ${outputDir}\n`);

  const rows: L1Row[] = [];
  const robots = new RobotsCache(options);
  const domainQueues = new Map<string, Promise<void>>();
  let completed = 0;

  // Nothing in here may throw: these run inside Promise.all, so a single
  // rejection would abandon a run that has already cost thousands of requests.
  const runTarget = async (target: L1Target): Promise<void> => {
    let row: L1Row;
    try {
      row = await fetchTarget(target, baselines, robots, options, outputDir);
    } catch (error) {
      row = {
        durationMs: 0,
        entitySlugs: target.entitySlugs,
        error: error instanceof Error ? error.message : String(error),
        evidenceCount: target.evidenceCount,
        fetchedAt: new Date().toISOString(),
        host: target.host,
        isPdf: target.isPdf,
        redirected: false,
        sourceUrl: target.sourceUrl,
        status: "fetch_error",
        textLength: 0
      };
    }
    rows.push(row);
    completed += 1;
    if (completed % FLUSH_EVERY === 0) {
      try {
        await writeJson(path.join(outputDir, "l1-rows.partial.json"), rows);
      } catch {
        // A failed checkpoint is not worth losing the run over.
      }
      console.log(`  ${completed}/${targets.length} ${summaryLine(rows)}`);
    }
  };

  // Per-domain serialization keeps us to one in-flight request per institution;
  // the semaphore caps how many different institutions we talk to at once.
  const semaphore = new Semaphore(options.concurrency);
  await Promise.all(
    targets.map(async (target) => {
      const domain = registrableDomain(target.host);
      const previous = domainQueues.get(domain) ?? Promise.resolve();
      const next = previous.then(async () => {
        await semaphore.acquire();
        try {
          await runTarget(target);
        } finally {
          semaphore.release();
        }
        await sleep(
          Math.max(options.hostDelayMs, (await robots.delayMsFor(target.sourceUrl)) ?? 0)
        );
      });
      domainQueues.set(
        domain,
        next.catch(() => undefined)
      );
      await next;
    })
  );

  rows.sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl));

  const report = {
    generatedAt: new Date().toISOString(),
    options: {
      concurrency: options.concurrency,
      hostDelayMs: options.hostDelayMs,
      timeoutMs: options.timeoutMs
    },
    releaseId: parsedTargets.releaseId,
    rows,
    runId,
    schemaVersion: "uapt-full-audit-l1-report-v1",
    summary: summarize(rows),
    targetsFile
  };

  await writeJson(path.join(outputDir, "l1-report.json"), report);
  await writeJson(path.join(outputDir, "l2-targets.json"), buildL2Targets(rows, parsedTargets.releaseId));
  await writeJson(path.join(outputDir, "l1-escalations.json"), buildEscalations(rows));
  await writeFile(path.join(outputDir, "l1-summary.md"), renderMarkdown(report), "utf8");

  console.log(`\n${JSON.stringify(report.summary, null, 2)}`);
  console.log(`\nOutput: ${outputDir}`);
}

async function fetchTarget(
  target: L1Target,
  baselines: Map<string, StagedBaseline>,
  robots: RobotsCache,
  options: CliOptions,
  outputDir: string
): Promise<L1Row> {
  const startedAt = Date.now();
  const staged = baselines.get(target.sourceUrl);
  const base = {
    entitySlugs: target.entitySlugs,
    evidenceCount: target.evidenceCount,
    fetchedAt: new Date().toISOString(),
    host: target.host,
    isPdf: target.isPdf,
    redirected: false,
    sourceUrl: target.sourceUrl,
    staged,
    textLength: 0
  };

  const allowed = await robots.isAllowed(target.sourceUrl);
  if (!allowed) {
    return {
      ...base,
      durationMs: Date.now() - startedAt,
      status: "robots_disallowed"
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(target.sourceUrl, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/pdf,text/plain,application/xml;q=0.9,*/*;q=0.5",
        "User-Agent": USER_AGENT
      },
      redirect: "follow",
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") ?? undefined;
    const redirected = normalizeForCompare(response.url) !== normalizeForCompare(target.sourceUrl);
    const shared = {
      ...base,
      contentType,
      durationMs: Date.now() - startedAt,
      etag: response.headers.get("etag") ?? undefined,
      finalUrl: response.url,
      httpStatus: response.status,
      lastModified: response.headers.get("last-modified") ?? undefined,
      redirected
    };

    if (!response.ok) {
      return {
        ...shared,
        status:
          response.status === 404 || response.status === 410
            ? "dead"
            : isBlockedStatus(response.status)
              ? "blocked"
              : "fetch_error",
        ...(isBlockedStatus(response.status) ? { needsEscalation: "playwright" as const } : {})
      };
    }

    const bytes = await readLimitedBytes(response, MAX_BYTES);
    const truncated = bytes.byteLength >= MAX_BYTES;

    // PDFs are hashed as bytes rather than text-extracted. Measured against the
    // real dataset, that byte hash reproduces the staged contentHash exactly for
    // 99 of 456 PDFs, so the original crawl hashed PDF bytes too and the same
    // unchanged/changed verdict applies here as for HTML.
    if (target.isPdf || /application\/pdf/i.test(contentType ?? "")) {
      const contentHash = sha256Bytes(bytes);
      const pdfStatus: L1Status = !staged?.contentHash
        ? "no_baseline"
        : contentHash === staged.contentHash
          ? redirected
            ? "moved_same_content"
            : "unchanged"
          : redirected
            ? "moved_changed_content"
            : "changed_no_signal";
      return {
        ...shared,
        bytes: bytes.byteLength,
        contentHash,
        isPdfDocument: true,
        status: pdfStatus,
        truncated
      };
    }

    const raw = decodeBody(bytes, contentType);
    const title = extractTitle(raw);
    const text = stripHtml(raw, contentType);
    const contentHash = text ? sha256Text(text) : undefined;

    if (!contentHash || text.length < RENDER_TEXT_THRESHOLD) {
      return {
        ...shared,
        bytes: bytes.byteLength,
        contentHash,
        needsEscalation: "playwright",
        status: "render_required",
        truncated,
        textLength: text.length,
        title
      };
    }

    await writeFile(
      path.join(outputDir, "pages", `${hashKey(target.sourceUrl)}.txt`),
      text,
      "utf8"
    );

    const softNotFound =
      SOFT_404_PATTERN.test(`${title ?? ""}\n${text.slice(0, 3000)}`) ||
      isDeepLinkCollapsedToIndex(target.sourceUrl, response.url);
    if (softNotFound) {
      return {
        ...shared,
        bytes: bytes.byteLength,
        contentHash,
        status: "soft_404",
        truncated,
        textLength: text.length,
        title
      };
    }

    if (!staged?.contentHash) {
      return {
        ...shared,
        bytes: bytes.byteLength,
        contentHash,
        status: "no_baseline",
        truncated,
        textLength: text.length,
        title
      };
    }

    if (contentHash === staged.contentHash) {
      return {
        ...shared,
        bytes: bytes.byteLength,
        contentHash,
        status: redirected ? "moved_same_content" : "unchanged",
        truncated,
        textLength: text.length,
        title
      };
    }

    if (redirected) {
      return {
        ...shared,
        bytes: bytes.byteLength,
        contentHash,
        status: "moved_changed_content",
        truncated,
        textLength: text.length,
        title
      };
    }

    const hasPolicySignal = POLICY_SIGNAL_PATTERN.test(
      `${title ?? ""}\n${staged.sourceTitle ?? ""}`
    );
    return {
      ...shared,
      bytes: bytes.byteLength,
      contentHash,
      status: hasPolicySignal ? "changed_policy_signal" : "changed_no_signal",
        truncated,
      textLength: text.length,
      title
    };
  } catch (error) {
    return {
      ...base,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      needsEscalation: "playwright",
      status: "fetch_error"
    };
  } finally {
    clearTimeout(timer);
  }
}

// robots.txt is fetched once per origin and cached. A host that fails to serve
// robots.txt is treated as allowing the fetch, which matches the common
// convention; an explicit Disallow always wins.
class RobotsCache {
  private readonly cache = new Map<string, Promise<RobotsRules>>();

  constructor(private readonly options: CliOptions) {}

  async isAllowed(rawUrl: string): Promise<boolean> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return false;
    }
    const rules = await this.rulesFor(url.origin);
    return rules.allows(url.pathname + url.search);
  }

  /** Host-declared Crawl-delay, when it asks for more than our default. */
  async delayMsFor(rawUrl: string): Promise<number | undefined> {
    try {
      return (await this.rulesFor(new URL(rawUrl).origin)).crawlDelayMs;
    } catch {
      return undefined;
    }
  }

  private rulesFor(origin: string): Promise<RobotsRules> {
    const existing = this.cache.get(origin);
    if (existing) return existing;
    const created = this.load(origin);
    this.cache.set(origin, created);
    return created;
  }

  private async load(origin: string): Promise<RobotsRules> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(`${origin}/robots.txt`, {
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
        signal: controller.signal
      });
      if (!response.ok) return RobotsRules.permissive();
      return RobotsRules.parse(await response.text());
    } catch {
      return RobotsRules.permissive();
    } finally {
      clearTimeout(timer);
    }
  }
}

class RobotsRules {
  private constructor(
    private readonly disallow: string[],
    private readonly allow: string[],
    readonly crawlDelayMs: number | undefined
  ) {}

  static permissive(): RobotsRules {
    return new RobotsRules([], [], undefined);
  }

  static parse(body: string): RobotsRules {
    const disallow: string[] = [];
    const allow: string[] = [];
    let crawlDelayMs: number | undefined;
    let applies = false;

    for (const line of body.split(/\r?\n/)) {
      const clean = line.replace(/#.*$/, "").trim();
      if (!clean) continue;
      const [rawField, ...rest] = clean.split(":");
      const field = rawField.trim().toLowerCase();
      const value = rest.join(":").trim();

      if (field === "user-agent") {
        const agent = value.toLowerCase();
        const token = agent.split("/")[0];
        applies = agent === "*" || (token.length > 0 && USER_AGENT.toLowerCase().startsWith(token));
        continue;
      }
      if (!applies || !value) continue;
      if (field === "disallow") disallow.push(value);
      if (field === "allow") allow.push(value);
      if (field === "crawl-delay") {
        const seconds = Number(value);
        // Cap it: a few hosts declare minutes, which would stall the run.
        if (Number.isFinite(seconds) && seconds > 0) {
          crawlDelayMs = Math.min(seconds * 1000, 10_000);
        }
      }
    }

    return new RobotsRules(disallow, allow, crawlDelayMs);
  }

  allows(pathAndQuery: string): boolean {
    const longestAllow = this.longestMatch(this.allow, pathAndQuery);
    const longestDisallow = this.longestMatch(this.disallow, pathAndQuery);
    if (longestDisallow === undefined) return true;
    if (longestAllow === undefined) return false;
    // Most-specific rule wins, which is what Google's reference parser does.
    return longestAllow >= longestDisallow;
  }

  private longestMatch(rules: string[], target: string): number | undefined {
    let best: number | undefined;
    for (const rule of rules) {
      if (matchesRobotsPattern(rule, target)) best = Math.max(best ?? 0, rule.length);
    }
    return best;
  }
}

// robots.txt path patterns support two wildcards: `*` matches any run of
// characters and a trailing `$` anchors the end. Matching them literally would
// silently under-apply Disallow rules, i.e. fetch pages the host forbade.
function matchesRobotsPattern(rule: string, target: string): boolean {
  if (!rule) return false;
  if (!rule.includes("*") && !rule.endsWith("$")) return target.startsWith(rule);

  const anchored = rule.endsWith("$");
  const body = anchored ? rule.slice(0, -1) : rule;
  const pattern = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");

  return new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(target);
}

class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active += 1;
  }

  release(): void {
    this.active -= 1;
    this.waiting.shift()?.();
  }
}

async function collectStagedBaselines(
  repoRoot: string
): Promise<Map<string, StagedBaseline>> {
  const baselines = new Map<string, StagedBaseline>();
  const roots = [
    path.join(repoRoot, "staging", "uapt-runs"),
    path.join(repoRoot, "data", "openclaw-staging")
  ];

  for (const root of roots) {
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
          if (typeof item.contentHash !== "string") continue;
          if (typeof item.sourceUrl !== "string") continue;
          const fetchedAt = typeof item.fetchedAt === "string" ? item.fetchedAt : "";
          const existing = baselines.get(item.sourceUrl);
          // Keep the most recent snapshot per URL: that is the state the
          // current release actually published.
          if (existing && existing.fetchedAt >= fetchedAt) continue;
          baselines.set(item.sourceUrl, {
            contentHash: item.contentHash,
            fetchedAt,
            finalUrl: typeof item.finalUrl === "string" ? item.finalUrl : undefined,
            runId: String(item.runId ?? dir),
            sourceTitle: typeof item.sourceTitle === "string" ? item.sourceTitle : undefined
          });
        }
      }
    }
  }

  return baselines;
}

async function findLatestTargets(repoRoot: string): Promise<string> {
  const root = path.join(repoRoot, OUTPUT_ROOT);
  const dirs = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("l0-"))
    .map((entry) => entry.name)
    .sort();
  const latest = dirs.at(-1);
  if (!latest) {
    throw new Error(
      `No L0 run found under ${root}. Run "pnpm audit:l0-consistency" first, or pass --targets <file>.`
    );
  }
  return path.join(root, latest, "l1-targets.json");
}

function buildL2Targets(rows: L1Row[], releaseId: string) {
  // L2 anchors published evidence snippets against live text, so it only needs
  // the URLs whose text we actually captured.
  const anchorable = rows.filter(
    (row) =>
      row.textLength >= RENDER_TEXT_THRESHOLD &&
      (row.status === "unchanged" ||
        row.status === "changed_no_signal" ||
        row.status === "changed_policy_signal" ||
        row.status === "moved_changed_content" ||
        row.status === "moved_same_content" ||
        row.status === "no_baseline")
  );

  return {
    generatedAt: new Date().toISOString(),
    releaseId,
    schemaVersion: "uapt-full-audit-l2-targets-v1",
    targets: anchorable.map((row) => ({
      cacheKey: hashKey(row.sourceUrl),
      changedSinceCrawl:
        row.status.startsWith("changed") || row.status === "moved_changed_content",
      movedTo: row.redirected ? row.finalUrl : undefined,
      entitySlugs: row.entitySlugs,
      evidenceCount: row.evidenceCount,
      finalUrl: row.finalUrl,
      sourceUrl: row.sourceUrl,
      stagedFetchedAt: row.staged?.fetchedAt
    }))
  };
}

function buildEscalations(rows: L1Row[]) {
  const needsRender = rows.filter((row) => row.needsEscalation === "playwright");
  return {
    generatedAt: new Date().toISOString(),
    note: "URLs plain HTTP could not resolve. Playwright first; Firecrawl only where a real browser is still refused, within the 3000 budget.",
    playwright: needsRender.map((row) => ({
      entitySlugs: row.entitySlugs,
      host: row.host,
      httpStatus: row.httpStatus,
      reason: row.status,
      sourceUrl: row.sourceUrl
    })),
    schemaVersion: "uapt-full-audit-l1-escalations-v1"
  };
}

function summarize(rows: L1Row[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function summaryLine(rows: L1Row[]): string {
  const counts = summarize(rows);
  return Object.entries(counts)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
}

function renderMarkdown(report: {
  releaseId: string;
  rows: L1Row[];
  runId: string;
  summary: Record<string, number>;
}): string {
  const lines: string[] = [
    `# L1 Live Fetch — ${report.runId}`,
    "",
    `Release: \`${report.releaseId}\`  •  URLs fetched: ${report.rows.length}`,
    "",
    "A changed hash means the page is not byte-identical to what the original",
    "crawl recorded. Whole-page text includes navigation and footers, so it does",
    "not by itself mean the policy changed — that judgment is L2/L3 work.",
    "",
    "| Status | Count |",
    "| --- | ---: |"
  ];
  for (const [status, count] of Object.entries(report.summary)) {
    lines.push(`| \`${status}\` | ${count} |`);
  }

  const dead = report.rows.filter((row) => row.status === "dead" || row.status === "soft_404");
  if (dead.length) {
    lines.push("", `## Dead or tombstoned (${dead.length})`, "");
    lines.push("| Entity | URL | Status |", "| --- | --- | --- |");
    for (const row of dead.slice(0, 60)) {
      lines.push(
        `| ${row.entitySlugs.join(", ")} | ${row.sourceUrl} | ${row.status}${row.httpStatus ? ` (${row.httpStatus})` : ""} |`
      );
    }
    if (dead.length > 60) lines.push(`| … | ${dead.length - 60} more in l1-report.json | |`);
  }

  return `${lines.join("\n")}\n`;
}

function parseArgs(args: string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [flag, inline] = arg.slice(2).split("=");
    values.set(flag, inline ?? args[index + 1] ?? "");
  }
  return {
    concurrency: Number(values.get("concurrency")) || DEFAULT_CONCURRENCY,
    hostDelayMs: Number(values.get("host-delay")) || DEFAULT_HOST_DELAY_MS,
    limit: values.has("limit") ? Number(values.get("limit")) : undefined,
    outputDir: values.get("out") || undefined,
    targetsFile: values.get("targets") || undefined,
    timeoutMs: Number(values.get("timeout")) || DEFAULT_TIMEOUT_MS
  };
}

async function readLimitedBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
    if (total >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  return Buffer.concat(chunks);
}

// A blanket utf-8 assumption silently mojibakes legacy gb2312/big5/shift_jis
// pages, which would produce BOTH a false "changed" verdict and unusable L2
// anchor text. Prefer the declared charset, then a <meta charset> sniff.
function decodeBody(bytes: Uint8Array, contentType: string | undefined): string {
  const declared = contentType?.match(/charset=\s*"?([\w-]+)"?/i)?.[1];
  const sniffed = declared
    ? undefined
    : new TextDecoder("latin1")
        .decode(bytes.slice(0, 4096))
        .match(/<meta[^>]+charset=["']?\s*([\w-]+)/i)?.[1];
  const label = (declared ?? sniffed ?? "utf-8").toLowerCase();

  for (const candidate of [label, "utf-8"]) {
    try {
      return new TextDecoder(candidate, { fatal: false }).decode(bytes);
    } catch {
      // Unknown label; fall through to utf-8.
    }
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function stripHtml(value: string, contentType: string | undefined): string {
  if (!value || /image|audio|video/i.test(contentType ?? "")) return "";
  const text = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length >= 80 ? text : "";
}

function extractTitle(value: string): string | undefined {
  return value
    .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
}

function isDeepLinkCollapsedToIndex(requested: string, finalUrl: string | undefined): boolean {
  if (!finalUrl) return false;
  try {
    const from = new URL(requested);
    const to = new URL(finalUrl);
    if (from.host !== to.host) return false;
    return pathDepth(from.pathname) - pathDepth(to.pathname) >= 2;
  } catch {
    return false;
  }
}

// Approximate eTLD+1. A full public-suffix list is overkill here: the only
// consumer is the politeness queue, and over-grouping (one queue for a whole
// second-level domain) errs toward being gentler, never ruder.
const MULTI_PART_TLDS = new Set([
  "ac",
  "co",
  "com",
  "edu",
  "gov",
  "net",
  "or",
  "org",
  "sch"
]);

function registrableDomain(host: string): string {
  const parts = host.toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const secondLast = parts[parts.length - 2];
  const take = MULTI_PART_TLDS.has(secondLast) ? 3 : 2;
  return parts.slice(-take).join(".");
}

function pathDepth(pathname: string): number {
  return pathname.split("/").filter(Boolean).length;
}

function normalizeForCompare(value: string): string {
  try {
    const url = new URL(value);
    return `${url.host.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "").toLowerCase()}${url.search}`;
  } catch {
    return value.toLowerCase();
  }
}

function isBlockedStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 407 || status === 429 || status === 451;
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
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
