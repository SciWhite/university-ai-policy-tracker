/**
 * Post-start cache warm-up. Rendered pages live in the in-memory ISR cache, so
 * a restart makes every page cold, and on a loaded host the heaviest first
 * renders (sitemaps, report index, school pages) can exceed the proxy timeout.
 * With UAPT_WARMUP_ON_START=1 the server requests its own heavy pages and then
 * the sitemap URLs over loopback, strictly one request at a time.
 */
const CORE_PATHS = [
  "/", "/zh", "/universities", "/zh/universities", "/changes", "/zh/changes",
  "/reports", "/zh/reports", "/rankings", "/feeds/atom.xml", "/feeds/recent-changes.xml",
  "/llms.txt", "/sitemap.xml"
];
const MAX_SITEMAP_URLS = 5000;
const REQUEST_TIMEOUT_MS = 180_000;
const START_DELAY_MS = 5_000;

let started = false;

export function startRuntimeWarmup(): void {
  if (started || process.env.UAPT_WARMUP_ON_START !== "1" || process.env.UAPT_PROGRAM_BUILD === "1") return;
  started = true;
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port <= 0) return;
  const timer = setTimeout(() => { void warm(`http://127.0.0.1:${port}`); }, START_DELAY_MS);
  timer.unref?.();
}

async function fetchText(origin: string, path: string): Promise<{ status: number; body: string }> {
  try {
    const response = await fetch(origin + path, {
      headers: { host: "eduaipolicy.org", "x-forwarded-proto": "https", "user-agent": "uapt-runtime-warmup" },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    return { status: response.status, body: await response.text() };
  } catch {
    return { status: 0, body: "" };
  }
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>https:\/\/eduaipolicy\.org([^<]*)<\/loc>/g)].map(match => match[1] || "/");
}

async function warm(origin: string): Promise<void> {
  const startedAt = Date.now();
  let requests = 0, failures = 0;
  const visit = async (path: string) => {
    const result = await fetchText(origin, path);
    requests++;
    if (result.status !== 200 && result.status !== 308) failures++;
    return result;
  };
  for (const path of CORE_PATHS) await visit(path);
  const index = await visit("/sitemap.xml");
  const pages = new Set<string>();
  for (const section of locs(index.body)) {
    const sitemap = await visit(section);
    for (const path of locs(sitemap.body)) {
      if (pages.size >= MAX_SITEMAP_URLS) break;
      pages.add(path);
    }
  }
  for (const path of pages) if (!CORE_PATHS.includes(path)) await visit(path);
  console.log(JSON.stringify({ message: "Runtime warm-up finished", requests, failures, seconds: Math.round((Date.now() - startedAt) / 1000) }));
}
