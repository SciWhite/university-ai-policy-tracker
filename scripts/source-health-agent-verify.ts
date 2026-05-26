import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

type AgentStatus =
  | "agent_blocked_captcha_waf"
  | "agent_blocked_login"
  | "agent_blocked_robots"
  | "agent_fetch_failed"
  | "agent_unresolved"
  | "agent_verified_404"
  | "agent_verified_accessible"
  | "agent_verified_empty"
  | "agent_verified_redirect_unrelated"
  | "blocked_by_client"
  | "browser_timeout_unverified"
  | "firecrawl_failed"
  | "firecrawl_opened_no_content"
  | "firecrawl_verified"
  | "forbidden"
  | "not_found"
  | "paywall"
  | "rejected_not_policy_evidence"
  | "unknown_error";

interface CliOptions {
  browserLike: boolean;
  enableFirecrawl: boolean;
  firecrawlLimit: number;
  includeRejectedDiscovery: boolean;
  limit: number;
  output?: string;
  publishLatest: boolean;
  queueOnly: boolean;
  scope: "staging";
  statusFilter?: string;
  timeoutMs: number;
  verify: boolean;
}

interface QueueItem {
  entitySlug: string;
  finalUrl?: string;
  previousStatus: AgentStatus;
  priority: number;
  queueReason: string;
  rejectionReason?: string;
  sourceCandidateId: string;
  sourceTitle?: string;
  sourceType?: string;
  sourceUrl: string;
  stagingRun: string;
  verificationNotes?: string;
  verificationStatus?: string;
}

interface CheckResult {
  checkedWith: "http" | "browser_like" | "firecrawl";
  contentExtracted: boolean;
  contentType?: string;
  durationMs: number;
  error?: string;
  finalUrl?: string;
  httpStatus?: number;
  status: AgentStatus;
  textLength?: number;
  title?: string;
}

interface AgentRecord {
  checks: CheckResult[];
  checkedAt: string;
  entitySlug: string;
  finalUrl?: string;
  note?: string;
  previousStatus: AgentStatus;
  queueReason: string;
  recommendedAction: string;
  rejectionReason?: string;
  sourceCandidateId: string;
  sourceTitle?: string;
  sourceType?: string;
  sourceUrl: string;
  stagingRun: string;
  status: AgentStatus;
  textLength?: number;
  title?: string;
  verificationStatus?: string;
}

interface VerificationDocument {
  checkedWith: string[];
  generatedAt: string;
  records: AgentRecord[];
  requestPolicy: string;
  schemaVersion: "uapt-source-health-agent-verification-v1";
  summary: Record<string, number>;
}

const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";
const DEFAULT_OUTPUT_DIR = ".local/source-health-agent-runs";
const TEXT_MIN_LENGTH = 200;
const REJECTED_DISCOVERY_REASONS = new Set([
  "duplicate",
  "event_or_news_only",
  "generic_home_page",
  "low_policy_specificity",
  "no_ai_content",
  "not_official",
  "other",
  "research_showcase_only"
]);
const ACCESS_REJECTION_REASONS = new Set([
  "captcha",
  "http_error",
  "inaccessible",
  "login_required",
  "paywall",
  "redirect_unrelated",
  "robots_disallowed",
  "stale_404"
]);
const ACTIONABLE_STATUSES = new Set<AgentStatus>([
  "agent_blocked_captcha_waf",
  "agent_blocked_login",
  "agent_blocked_robots",
  "agent_fetch_failed",
  "agent_unresolved",
  "agent_verified_404",
  "agent_verified_empty",
  "agent_verified_redirect_unrelated",
  "blocked_by_client",
  "browser_timeout_unverified",
  "firecrawl_failed",
  "firecrawl_opened_no_content",
  "forbidden",
  "not_found",
  "paywall",
  "unknown_error"
]);
const LOGIN_PATTERN = /\b(401|login|log in|sign in|signin|sso|okta|sharepoint|authentication|unauthorized)\b/i;
const CAPTCHA_WAF_PATTERN = /\b(captcha|waf|cloudflare|radware|incapsula|managed challenge|access policy|access denied|denied crawler)\b/i;
const EMPTY_PATTERN = /\b(no usable content|opened.*no content|empty|shell|selectable text extraction)\b/i;
const POLICY_REQUEST =
  "Agent verification uses HTTP metadata, optional Firecrawl, and browser-like requests without login, paywall, CAPTCHA, WAF, robots, or access-control bypass. Records are source-health metadata only and do not publish raw source text.";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = await findRepoRoot();
  const queued = (await buildStagingQueue(repoRoot, options)).slice(0, options.limit);
  const generatedAt = new Date().toISOString();
  const records = options.verify
    ? await verifyQueue(queued, options, generatedAt)
    : queued.map((item) => queueRecord(item, generatedAt));
  const document: VerificationDocument = {
    checkedWith: options.verify
      ? [
          "http",
          ...(options.enableFirecrawl ? ["firecrawl"] : []),
          ...(options.browserLike ? ["browser_like"] : [])
        ]
      : ["queue"],
    generatedAt,
    records,
    requestPolicy: POLICY_REQUEST,
    schemaVersion: "uapt-source-health-agent-verification-v1",
    summary: summarize(records)
  };

  if (options.queueOnly && options.publishLatest) {
    throw new Error("--publish-latest requires verification output, not --queue-only.");
  }

  const output =
    options.output ??
    path.join(
      repoRoot,
      DEFAULT_OUTPUT_DIR,
      `agent-verification-${generatedAt.replace(/[:.]/g, "-")}.json`
    );
  await writeJson(output, document);
  if (options.publishLatest) {
    await writeJson(
      path.join(repoRoot, "data", "source-health", "agent-verification-latest.json"),
      document
    );
  }

  console.log(
    JSON.stringify(
      {
        checkedWith: document.checkedWith,
        output: normalizeRelativePath(path.relative(repoRoot, output)),
        publishedLatest: options.publishLatest,
        queued: queued.length,
        summary: document.summary,
        verified: options.verify
      },
      null,
      2
    )
  );
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    browserLike: true,
    enableFirecrawl: false,
    firecrawlLimit: 25,
    includeRejectedDiscovery: false,
    limit: 100,
    publishLatest: false,
    queueOnly: true,
    scope: "staging",
    timeoutMs: 15000,
    verify: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = () => {
      const value = args[index + 1];
      if (!value) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };

    if (arg === "--verify") {
      options.verify = true;
      options.queueOnly = false;
    } else if (arg === "--queue-only" || arg === "--dry-run") {
      options.queueOnly = true;
      options.verify = false;
    } else if (arg === "--enable-firecrawl") {
      options.enableFirecrawl = true;
    } else if (arg === "--no-browser-like") {
      options.browserLike = false;
    } else if (arg === "--include-rejected-discovery") {
      options.includeRejectedDiscovery = true;
    } else if (arg === "--publish-latest") {
      options.publishLatest = true;
    } else if (arg === "--limit") {
      options.limit = parsePositiveInteger(next(), "--limit");
    } else if (arg === "--firecrawl-limit") {
      options.firecrawlLimit = parsePositiveInteger(next(), "--firecrawl-limit");
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = parsePositiveInteger(next(), "--timeout-ms");
    } else if (arg === "--status") {
      options.statusFilter = next();
    } else if (arg === "--scope") {
      const scope = next();
      if (scope !== "staging") {
        throw new Error("Only --scope staging is implemented for agent verification.");
      }
      options.scope = scope;
    } else if (arg === "--output") {
      options.output = next();
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (arg === "--") {
      continue;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  pnpm source-health:agent-verify -- --queue-only --limit 100
  pnpm source-health:agent-verify -- --verify --enable-firecrawl --firecrawl-limit 25 --limit 100
  pnpm source-health:agent-verify -- --verify --publish-latest --limit 50

Options:
  --queue-only                  Build the agent queue without network checks.
  --verify                      Run HTTP, optional Firecrawl, and browser-like checks.
  --enable-firecrawl            Use FIRECRAWL_API_KEY for Firecrawl verification.
  --firecrawl-limit <n>         Maximum Firecrawl calls for this run.
  --no-browser-like             Disable browser-like HTTP fallback.
  --include-rejected-discovery  Include non-policy rejected discovery candidates.
  --status <status>             Limit queue to a current source-health status.
  --publish-latest              Write data/source-health/agent-verification-latest.json.
  --limit <n>                   Maximum queued records. Default: 100.
  --output <path>               Output path. Default: .local/source-health-agent-runs/.
`);
}

async function buildStagingQueue(
  repoRoot: string,
  options: CliOptions
): Promise<QueueItem[]> {
  const items: QueueItem[] = [];
  const roots = [
    path.join(repoRoot, "staging", "uapt-runs"),
    path.join(repoRoot, "data", "openclaw-staging")
  ];

  for (const root of roots) {
    const files = await findArtifactFiles(root);
    for (const file of files) {
      const relativeRun = normalizeRelativePath(
        path.relative(repoRoot, path.dirname(file))
      );
      const parsed = await readJson(file);
      const artifacts = extractArtifactValues(parsed);
      const candidates = artifacts.filter(
        (artifact) => artifact?.artifactType === "source_candidate"
      );
      const fetches = artifacts.filter(
        (artifact) => artifact?.artifactType === "fetch_attempt"
      );
      const snapshots = artifacts.filter(
        (artifact) => artifact?.artifactType === "source_snapshot"
      );
      const fetchesByCandidate = groupBy(fetches, (fetch) =>
        String(fetch.sourceCandidateId ?? fetch.sourceUrl ?? "")
      );
      const snapshotsByCandidate = groupBy(snapshots, (snapshot) =>
        String(snapshot.sourceCandidateId ?? snapshot.sourceUrl ?? "")
      );

      for (const candidate of candidates) {
        const sourceCandidateId = String(candidate.sourceCandidateId ?? "");
        if (!sourceCandidateId || typeof candidate.sourceUrl !== "string") {
          continue;
        }
        const relatedFetches = fetchesByCandidate.get(sourceCandidateId) ?? [];
        const relatedSnapshots = snapshotsByCandidate.get(sourceCandidateId) ?? [];
        const previousStatus = classifyCandidate(
          candidate,
          relatedFetches,
          relatedSnapshots
        );
        if (options.statusFilter && previousStatus !== options.statusFilter) {
          continue;
        }
        if (
          previousStatus === "rejected_not_policy_evidence" &&
          !options.includeRejectedDiscovery
        ) {
          continue;
        }
        const hasFailedFetch = relatedFetches.some((fetch) =>
          ["blocked", "error", "retry_recommended"].includes(String(fetch.outcome))
        );
        const alreadyVerified =
          previousStatus === "agent_verified_accessible" ||
          previousStatus === "firecrawl_verified";
        const shouldQueue =
          ACTIONABLE_STATUSES.has(previousStatus) ||
          (hasFailedFetch && !alreadyVerified) ||
          ACCESS_REJECTION_REASONS.has(String(candidate.rejectionReason ?? ""));

        if (!shouldQueue) continue;

        items.push({
          entitySlug: String(candidate.entitySlug ?? ""),
          finalUrl:
            typeof candidate.finalUrl === "string" ? candidate.finalUrl : undefined,
          previousStatus,
          priority: getPriority(previousStatus, candidate, hasFailedFetch),
          queueReason: getQueueReason(previousStatus, candidate, hasFailedFetch),
          rejectionReason:
            typeof candidate.rejectionReason === "string"
              ? candidate.rejectionReason
              : undefined,
          sourceCandidateId,
          sourceTitle:
            typeof candidate.sourceTitle === "string"
              ? candidate.sourceTitle
              : undefined,
          sourceType:
            typeof candidate.sourceType === "string" ? candidate.sourceType : undefined,
          sourceUrl: candidate.sourceUrl,
          stagingRun: relativeRun,
          verificationNotes:
            typeof candidate.verificationNotes === "string"
              ? candidate.verificationNotes
              : undefined,
          verificationStatus:
            typeof candidate.verificationStatus === "string"
              ? candidate.verificationStatus
              : undefined
        });
      }
    }
  }

  return items.sort(
    (left, right) =>
      left.priority - right.priority ||
      left.stagingRun.localeCompare(right.stagingRun) ||
      left.sourceUrl.localeCompare(right.sourceUrl)
  );
}

function classifyCandidate(
  candidate: Record<string, unknown>,
  fetches: Record<string, unknown>[],
  snapshots: Record<string, unknown>[]
): AgentStatus {
  const verificationStatus = String(candidate.verificationStatus ?? "");
  const rejectionReason =
    typeof candidate.rejectionReason === "string"
      ? candidate.rejectionReason
      : undefined;
  if (verificationStatus === "rejected") {
    const rejectedStatus = classifyRejectedReason(rejectionReason);
    if (rejectedStatus) return rejectedStatus;
  }

  const firecrawlFetches = fetches.filter(
    (fetch) => fetch.fetchMode === "firecrawl" || fetch.userAgentKind === "firecrawl"
  );
  if (firecrawlFetches.some((fetch) => fetch.outcome === "success")) {
    return "firecrawl_verified";
  }
  if (firecrawlFetches.some((fetch) => fetch.outcome === "retry_recommended")) {
    return "firecrawl_opened_no_content";
  }
  if (
    firecrawlFetches.some((fetch) =>
      ["blocked", "error", "skipped"].includes(String(fetch.outcome))
    )
  ) {
    return "firecrawl_failed";
  }

  if (
    rejectionReason === "robots_disallowed" ||
    fetches.some((fetch) => fetch.robotsAllowed === false) ||
    snapshots.some((snapshot) => snapshot.robotsAllowed === false)
  ) {
    return "agent_blocked_robots";
  }
  if (rejectionReason === "login_required" || hasFetchError(fetches, LOGIN_PATTERN)) {
    return "agent_blocked_login";
  }
  if (rejectionReason === "captcha" || hasFetchError(fetches, CAPTCHA_WAF_PATTERN)) {
    return "agent_blocked_captcha_waf";
  }
  if (rejectionReason === "paywall") return "paywall";
  if (
    rejectionReason === "stale_404" ||
    fetches.some((fetch) => Number(fetch.httpStatus) === 404)
  ) {
    return "agent_verified_404";
  }
  if (rejectionReason === "redirect_unrelated") {
    return "agent_verified_redirect_unrelated";
  }
  if (
    rejectionReason === "http_error" ||
    rejectionReason === "inaccessible" ||
    fetches.some((fetch) =>
      ["blocked", "error", "retry_recommended"].includes(String(fetch.outcome))
    )
  ) {
    return "agent_fetch_failed";
  }
  if (
    snapshots.length ||
    verificationStatus === "verified" ||
    fetches.some((fetch) => fetch.outcome === "success")
  ) {
    return "agent_verified_accessible";
  }
  if (
    ["blocked", "discovered", "inaccessible", "needs_browser", "skipped", "unknown"].includes(
      verificationStatus
    )
  ) {
    return "agent_unresolved";
  }
  return "unknown_error";
}

function classifyRejectedReason(
  rejectionReason: string | undefined
): AgentStatus | undefined {
  if (!rejectionReason) return undefined;
  if (REJECTED_DISCOVERY_REASONS.has(rejectionReason)) {
    return "rejected_not_policy_evidence";
  }
  if (rejectionReason === "stale_404") return "agent_verified_404";
  if (rejectionReason === "redirect_unrelated") {
    return "agent_verified_redirect_unrelated";
  }
  if (rejectionReason === "login_required") return "agent_blocked_login";
  if (rejectionReason === "robots_disallowed") return "agent_blocked_robots";
  if (rejectionReason === "captcha") return "agent_blocked_captcha_waf";
  if (rejectionReason === "paywall") return "paywall";
  if (rejectionReason === "http_error" || rejectionReason === "inaccessible") {
    return "agent_fetch_failed";
  }
  return undefined;
}

async function verifyQueue(
  queued: QueueItem[],
  options: CliOptions,
  checkedAt: string
): Promise<AgentRecord[]> {
  const records: AgentRecord[] = [];
  let firecrawlUsed = 0;

  for (const item of queued) {
    const checks: CheckResult[] = [];
    const robots = await checkRobots(item.sourceUrl, options.timeoutMs);
    if (robots.blocked) {
      checks.push({
        checkedWith: "http",
        contentExtracted: false,
        durationMs: robots.durationMs,
        error: robots.reason,
        status: "agent_blocked_robots"
      });
      records.push(finalRecord(item, checkedAt, checks));
      continue;
    }

    checks.push(await verifyWithHttp(item.sourceUrl, "http", options.timeoutMs));

    if (
      options.enableFirecrawl &&
      firecrawlUsed < options.firecrawlLimit &&
      !checks.some((check) => check.status === "agent_verified_accessible")
    ) {
      firecrawlUsed += 1;
      checks.push(await verifyWithFirecrawl(item.sourceUrl, options.timeoutMs * 2));
    }

    if (
      options.browserLike &&
      !checks.some((check) => check.status === "agent_verified_accessible")
    ) {
      checks.push(await verifyWithHttp(item.sourceUrl, "browser_like", options.timeoutMs));
    }

    records.push(finalRecord(item, checkedAt, checks));
  }

  return records;
}

function queueRecord(item: QueueItem, checkedAt: string): AgentRecord {
  return {
    checks: [],
    checkedAt,
    entitySlug: item.entitySlug,
    finalUrl: item.finalUrl,
    note: item.verificationNotes,
    previousStatus: item.previousStatus,
    queueReason: item.queueReason,
    recommendedAction: "Queued for automated source-health verification.",
    rejectionReason: item.rejectionReason,
    sourceCandidateId: item.sourceCandidateId,
    sourceTitle: item.sourceTitle,
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl,
    stagingRun: item.stagingRun,
    status: item.previousStatus,
    verificationStatus: item.verificationStatus
  };
}

function finalRecord(
  item: QueueItem,
  checkedAt: string,
  checks: CheckResult[]
): AgentRecord {
  const best = chooseBestCheck(checks);
  return {
    checks,
    checkedAt,
    entitySlug: item.entitySlug,
    finalUrl: best.finalUrl ?? item.finalUrl,
    note: getVerificationNote(best),
    previousStatus: item.previousStatus,
    queueReason: item.queueReason,
    recommendedAction: getRecommendedAction(best.status),
    rejectionReason: item.rejectionReason,
    sourceCandidateId: item.sourceCandidateId,
    sourceTitle: item.sourceTitle,
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl,
    stagingRun: item.stagingRun,
    status: best.status,
    textLength: best.textLength,
    title: best.title,
    verificationStatus: item.verificationStatus
  };
}

function chooseBestCheck(checks: CheckResult[]): CheckResult {
  const order: AgentStatus[] = [
    "agent_verified_accessible",
    "agent_verified_404",
    "agent_verified_redirect_unrelated",
    "agent_blocked_login",
    "agent_blocked_robots",
    "agent_blocked_captcha_waf",
    "paywall",
    "agent_verified_empty",
    "agent_fetch_failed",
    "agent_unresolved"
  ];
  for (const status of order) {
    const match = checks.find((check) => check.status === status);
    if (match) return match;
  }
  return checks[0] ?? {
    checkedWith: "http",
    contentExtracted: false,
    durationMs: 0,
    status: "agent_unresolved"
  };
}

async function verifyWithHttp(
  sourceUrl: string,
  mode: "http" | "browser_like",
  timeoutMs: number
): Promise<CheckResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(sourceUrl, {
      headers: mode === "browser_like" ? browserLikeHeaders() : defaultHeaders(),
      redirect: "follow",
      signal: controller.signal
    });
    clearTimeout(timer);
    const contentType = response.headers.get("content-type") ?? undefined;
    const finalUrl = response.url;
    const resultBase = {
      checkedWith: mode,
      contentType,
      durationMs: Date.now() - started,
      finalUrl,
      httpStatus: response.status
    } satisfies Partial<CheckResult>;

    if (response.status === 404) {
      return {
        ...resultBase,
        checkedWith: mode,
        contentExtracted: false,
        status: "agent_verified_404"
      };
    }

    if (response.status === 401) {
      return {
        ...resultBase,
        checkedWith: mode,
        contentExtracted: false,
        status: "agent_blocked_login"
      };
    }

    if (/pdf|octet-stream/i.test(contentType ?? "")) {
      return {
        ...resultBase,
        checkedWith: mode,
        contentExtracted: response.ok,
        status: response.ok ? "agent_verified_accessible" : "agent_fetch_failed"
      };
    }

    const text = await response.text();
    const normalized = normalizeText(text);
    const title = extractTitle(text);
    const status = classifyResponseText(response.status, normalized, finalUrl, sourceUrl);
    return {
      ...resultBase,
      checkedWith: mode,
      contentExtracted: status === "agent_verified_accessible",
      status,
      textLength: normalized.length,
      title
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      checkedWith: mode,
      contentExtracted: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      status: "agent_fetch_failed"
    };
  }
}

async function verifyWithFirecrawl(
  sourceUrl: string,
  timeoutMs: number
): Promise<CheckResult> {
  const started = Date.now();
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return {
      checkedWith: "firecrawl",
      contentExtracted: false,
      durationMs: 0,
      error: "FIRECRAWL_API_KEY is not set.",
      status: "agent_unresolved"
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(FIRECRAWL_ENDPOINT, {
      body: JSON.stringify({
        formats: ["markdown"],
        onlyMainContent: true,
        url: sourceUrl
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!response.ok) {
      return {
        checkedWith: "firecrawl",
        contentExtracted: false,
        durationMs: Date.now() - started,
        httpStatus: response.status,
        status: response.status === 404 ? "agent_verified_404" : "agent_fetch_failed"
      };
    }

    const payload = (await response.json()) as {
      data?: {
        markdown?: string;
        metadata?: {
          sourceURL?: string;
          statusCode?: number;
          title?: string;
        };
      };
    };
    const markdown = normalizeText(payload.data?.markdown ?? "");
    const statusCode = payload.data?.metadata?.statusCode;
    const status =
      statusCode === 404
        ? "agent_verified_404"
        : markdown.length >= TEXT_MIN_LENGTH
          ? "agent_verified_accessible"
          : "agent_verified_empty";
    return {
      checkedWith: "firecrawl",
      contentExtracted: status === "agent_verified_accessible",
      durationMs: Date.now() - started,
      finalUrl: payload.data?.metadata?.sourceURL,
      httpStatus: statusCode,
      status,
      textLength: markdown.length,
      title: payload.data?.metadata?.title
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      checkedWith: "firecrawl",
      contentExtracted: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      status: "agent_fetch_failed"
    };
  }
}

async function checkRobots(
  sourceUrl: string,
  timeoutMs: number
): Promise<{ blocked: boolean; durationMs: number; reason?: string }> {
  const started = Date.now();
  try {
    const url = new URL(sourceUrl);
    const robotsUrl = `${url.origin}/robots.txt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(robotsUrl, {
      headers: defaultHeaders(),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!response.ok) return { blocked: false, durationMs: Date.now() - started };
    const body = await response.text();
    return {
      blocked: isRobotsDisallowed(body, url.pathname),
      durationMs: Date.now() - started,
      reason: "robots.txt disallows this path for user-agent *."
    };
  } catch {
    return { blocked: false, durationMs: Date.now() - started };
  }
}

function isRobotsDisallowed(robots: string, pathname: string): boolean {
  let applies = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [rawKey, ...valueParts] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = valueParts.join(":").trim();
    if (key === "user-agent") {
      applies = value === "*";
      continue;
    }
    if (applies && key === "disallow" && value) {
      if (value === "/" || pathname.startsWith(value)) return true;
    }
  }
  return false;
}

function classifyResponseText(
  httpStatus: number,
  text: string,
  finalUrl: string,
  sourceUrl: string
): AgentStatus {
  if (httpStatus === 404 || /\b404\b|page not found|not found/i.test(text.slice(0, 2000))) {
    return "agent_verified_404";
  }
  if (LOGIN_PATTERN.test(text.slice(0, 3000))) return "agent_blocked_login";
  if (CAPTCHA_WAF_PATTERN.test(text.slice(0, 3000))) {
    return "agent_blocked_captcha_waf";
  }
  if (httpStatus >= 400) return "agent_fetch_failed";
  if (isUnrelatedRedirect(sourceUrl, finalUrl, text)) {
    return "agent_verified_redirect_unrelated";
  }
  if (text.length < TEXT_MIN_LENGTH || EMPTY_PATTERN.test(text.slice(0, 3000))) {
    return "agent_verified_empty";
  }
  return "agent_verified_accessible";
}

function isUnrelatedRedirect(sourceUrl: string, finalUrl: string, text: string): boolean {
  try {
    const source = new URL(sourceUrl);
    const final = new URL(finalUrl);
    return (
      source.hostname !== final.hostname &&
      text.length < TEXT_MIN_LENGTH &&
      !final.hostname.endsWith(source.hostname)
    );
  } catch {
    return false;
  }
}

function getVerificationNote(check: CheckResult): string {
  if (check.status === "agent_verified_accessible") {
    return `${check.checkedWith} confirmed readable source content.`;
  }
  if (check.status === "agent_verified_empty") {
    return `${check.checkedWith} opened the URL but did not extract meaningful content.`;
  }
  if (check.status === "agent_verified_404") {
    return `${check.checkedWith} confirmed a missing or stale public route.`;
  }
  if (check.status === "agent_verified_redirect_unrelated") {
    return `${check.checkedWith} confirmed an unrelated redirect.`;
  }
  if (check.status === "agent_blocked_login") {
    return `${check.checkedWith} reached a login or authentication boundary.`;
  }
  if (check.status === "agent_blocked_robots") {
    return "robots.txt disallows this path; no page fetch was attempted.";
  }
  if (check.status === "agent_blocked_captcha_waf") {
    return `${check.checkedWith} reached CAPTCHA, WAF, or anti-bot protection.`;
  }
  return check.error ?? `${check.checkedWith} could not verify readable content.`;
}

function getRecommendedAction(status: AgentStatus): string {
  if (status === "agent_verified_accessible") {
    return "Downgrade the source-health warning; no source repair is needed unless content later changes.";
  }
  if (status === "agent_verified_404") {
    return "Mark as stale route and use another official URL if this candidate is needed.";
  }
  if (status === "agent_verified_empty") {
    return "Keep out of claim evidence unless another official source or successful extraction is found.";
  }
  if (status === "agent_verified_redirect_unrelated") {
    return "Keep rejected as unrelated redirect and search for another official source if needed.";
  }
  if (
    status === "agent_blocked_captcha_waf" ||
    status === "agent_blocked_login" ||
    status === "agent_blocked_robots" ||
    status === "paywall"
  ) {
    return "Keep as blocked by access boundary; do not bypass access controls.";
  }
  return "Keep in automated verification queue for a later tool pass.";
}

function getPriority(
  status: AgentStatus,
  candidate: Record<string, unknown>,
  hasFailedFetch: boolean
): number {
  if (status === "unknown_error" || status === "agent_unresolved") return 10;
  if (status === "agent_fetch_failed" || hasFailedFetch) return 20;
  if (String(candidate.rejectionReason ?? "") === "stale_404") return 30;
  if (String(candidate.rejectionReason ?? "") === "redirect_unrelated") return 35;
  if (status.startsWith("agent_blocked")) return 40;
  if (status === "rejected_not_policy_evidence") return 90;
  return 50;
}

function getQueueReason(
  status: AgentStatus,
  candidate: Record<string, unknown>,
  hasFailedFetch: boolean
): string {
  if (hasFailedFetch) return "failed_fetch";
  if (status === "rejected_not_policy_evidence") return "rejected_discovery";
  if (ACCESS_REJECTION_REASONS.has(String(candidate.rejectionReason ?? ""))) {
    return `rejected_access:${String(candidate.rejectionReason)}`;
  }
  return status;
}

function hasFetchError(fetches: Record<string, unknown>[], pattern: RegExp): boolean {
  return fetches.some((fetch) =>
    pattern.test(
      [
        fetch.errorReason,
        fetch.contentType,
        fetch.outcome,
        typeof fetch.httpStatus === "number" || typeof fetch.httpStatus === "string"
          ? String(fetch.httpStatus)
          : undefined
      ]
        .filter(Boolean)
        .join(" ")
    )
  );
}

function normalizeText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeText(match[1]) : undefined;
}

function defaultHeaders(): Record<string, string> {
  return {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.5",
    "User-Agent": "UniversityAIPolicyTrackerSourceHealth/1.0"
  };
}

function browserLikeHeaders(): Record<string, string> {
  return {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  };
}

function extractArtifactValues(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) return input.filter(isRecord);
  if (!isRecord(input)) return [];
  if (Array.isArray(input.artifacts)) return input.artifacts.filter(isRecord);
  return Object.values(input).flatMap((value) =>
    Array.isArray(value) ? value.filter(isRecord) : []
  );
}

function groupBy<T>(
  items: T[],
  getKey: (item: T) => string
): Map<string, T[]> {
  const output = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const group = output.get(key);
    if (group) group.push(item);
    else output.set(key, [item]);
  }
  return output;
}

async function findArtifactFiles(directory: string): Promise<string[]> {
  const entries = await safeReadDir(directory);
  const output: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await findArtifactFiles(entryPath)));
    } else if (entry.isFile() && entry.name === "artifacts.json") {
      output.push(entryPath);
    }
  }
  return output.sort();
}

async function findRepoRoot(): Promise<string> {
  let current = process.cwd();
  for (;;) {
    try {
      await readFile(path.join(current, "package.json"), "utf8");
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return process.cwd();
      current = parent;
    }
  }
}

async function safeReadDir(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function summarize(records: AgentRecord[]): Record<string, number> {
  const summary: Record<string, number> = { total: records.length };
  for (const record of records) {
    summary[record.status] = (summary[record.status] ?? 0) + 1;
  }
  return summary;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
