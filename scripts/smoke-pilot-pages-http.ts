import {
  INDEX_RECOVERY_CONTENT_VERSION,
  INDEX_RECOVERY_PILOT_SLUGS,
  indexRecoveryPilotContent
} from "../apps/web/lib/index-recovery-pilot";

/**
 * Production smoke test for the ten index-recovery pilot university pages.
 *
 * Motivation: on 2026-09-21 the English `/universities/manchester` page hung
 * (no response headers for 30s+) during the maintenance-release deploy window
 * while every other page served normally. Nothing in the existing smoke suite
 * probes the pilot pages over HTTP after a deploy, so the failure was only
 * noticed by hand. This script closes that gap.
 *
 * For each pilot page it asserts:
 * - HTTP 200 within the timeout (a timeout reproduces the Manchester symptom:
 *   cold on-demand ISR generation blocking the request after a restart)
 * - the pilot-specific title theme is rendered in <title>
 * - the JSON-LD dateModified matches the pilot content version
 * - the expected pilot body markers are present:
 *   - snapshot-less pilots (Bristol, Manchester, Edinburgh, Deakin):
 *     `index-recovery-summary` block plus `claim-dimension-groups`
 *   - strong-snapshot pilots: `claim-dimension-groups`
 *   - all pilots: the related-universities section
 *
 * Usage:
 *   pnpm smoke:pilot-pages                         # probe https://eduaipolicy.org
 *   pnpm smoke:pilot-pages -- --base-url http://127.0.0.1:3107   # probe a candidate build
 *   pnpm smoke:pilot-pages -- --warmup             # fetch only (no assertions) to warm ISR cache
 *
 * Run `--warmup` against the origin right after a restart so the first real
 * visitor (or Googlebot) never blocks on a cold page generation, then run the
 * full assertions.
 */

const SNAPSHOT_LESS_PILOTS = new Set([
  "university-of-bristol",
  "manchester",
  "edinburgh",
  "deakin-university"
]);

const DEFAULT_BASE_URL = "https://eduaipolicy.org";
const DEFAULT_TIMEOUT_MS = 15_000;

interface ProbeResult {
  slug: string;
  ok: boolean;
  status: number;
  elapsedMs: number;
  failures: string[];
}

function parseArgs(argv: string[]): {
  baseUrl: string;
  timeoutMs: number;
  warmup: boolean;
} {
  let baseUrl = DEFAULT_BASE_URL;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let warmup = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url" && argv[index + 1]) {
      baseUrl = argv[index + 1].replace(/\/$/, "");
      index += 1;
    } else if (arg === "--timeout-ms" && argv[index + 1]) {
      const parsed = Number.parseInt(argv[index + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) timeoutMs = parsed;
      index += 1;
    } else if (arg === "--warmup") {
      warmup = true;
    }
  }
  return { baseUrl, timeoutMs, warmup };
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<{ status: number; body: string; elapsedMs: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "UniversityAIPolicyTrackerBot/0.1 (+https://eduaipolicy.org/methodology)"
      }
    });
    const body = await response.text();
    return { status: response.status, body, elapsedMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

function expectedTitleTheme(slug: string): string {
  const content =
    indexRecoveryPilotContent[
      slug as keyof typeof indexRecoveryPilotContent
    ];
  return content.titleTheme;
}

async function probePilotPage(
  baseUrl: string,
  slug: string,
  timeoutMs: number,
  warmup: boolean
): Promise<ProbeResult> {
  const url = `${baseUrl}/universities/${slug}`;
  const failures: string[] = [];

  let status = 0;
  let body = "";
  let elapsedMs = 0;
  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    status = response.status;
    body = response.body;
    elapsedMs = response.elapsedMs;
  } catch (error) {
    const aborted =
      error instanceof Error && error.name === "AbortError";
    failures.push(
      aborted
        ? `no response within ${timeoutMs}ms (cold generation or stuck render)`
        : `fetch failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return { slug, ok: false, status, elapsedMs, failures };
  }

  if (warmup) return { slug, ok: status === 200, status, elapsedMs, failures };

  if (status !== 200) {
    failures.push(`expected HTTP 200, got ${status}`);
    return { slug, ok: false, status, elapsedMs, failures };
  }

  const theme = expectedTitleTheme(slug);
  if (!body.includes(theme)) {
    failures.push(`pilot title theme missing: "${theme}"`);
  }

  const dateModifiedMarker = `"dateModified":"${INDEX_RECOVERY_CONTENT_VERSION}T00:00:00.000Z"`;
  if (!body.includes(dateModifiedMarker)) {
    failures.push(
      `JSON-LD dateModified does not match content version ${INDEX_RECOVERY_CONTENT_VERSION}`
    );
  }

  if (!body.includes('class="claim-dimension-groups"')) {
    failures.push("claim-dimension-groups block missing");
  }

  if (SNAPSHOT_LESS_PILOTS.has(slug) && !body.includes('class="index-recovery-summary"')) {
    failures.push("index-recovery-summary block missing on snapshot-less pilot");
  }

  if (!body.includes('id="related-universities"')) {
    failures.push("related-universities section missing");
  }

  return { slug, ok: failures.length === 0, status, elapsedMs, failures };
}

async function main() {
  const { baseUrl, timeoutMs, warmup } = parseArgs(process.argv.slice(2));
  console.log(
    `${warmup ? "Warming up" : "Probing"} ${INDEX_RECOVERY_PILOT_SLUGS.length} pilot pages on ${baseUrl} (timeout ${timeoutMs}ms)`
  );

  const results: ProbeResult[] = [];
  for (const slug of INDEX_RECOVERY_PILOT_SLUGS) {
    // Sequential on purpose: this also serves as a cache warm-up and must not
    // stampede a cold server with ten concurrent generations.
    const result = await probePilotPage(baseUrl, slug, timeoutMs, warmup);
    results.push(result);
    const state = result.ok ? "OK  " : "FAIL";
    console.log(
      `  [${state}] ${slug}  ${result.status || "---"}  ${result.elapsedMs}ms`
    );
    for (const failure of result.failures) {
      console.log(`         - ${failure}`);
    }
  }

  const failed = results.filter((result) => !result.ok);
  const slowest = [...results].sort((a, b) => b.elapsedMs - a.elapsedMs)[0];
  console.log(
    `${results.length - failed.length}/${results.length} pages OK` +
      (slowest ? `; slowest ${slowest.slug} at ${slowest.elapsedMs}ms` : "")
  );

  if (failed.length) {
    console.error(
      `Pilot page smoke FAILED for: ${failed.map((result) => result.slug).join(", ")}`
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
