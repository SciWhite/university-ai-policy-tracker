/**
 * Post-start cache warm-up. Rendered pages live in the in-memory ISR cache, so
 * a restart makes every page cold, and on a loaded host the heaviest first
 * renders (sitemaps, report index, school pages) can exceed the proxy timeout.
 * With UAPT_WARMUP_ON_START=1 the server requests its own heavy pages and then
 * the sitemap URLs (the indexable set) over loopback, strictly one request at a time.
 *
 * Render once (docs/render-once.md §6, audit 2026-11-21 phase 2.4):
 * - UAPT_WARMUP_PAGE_TREE=1: school and changes pages are served from the
 *   pre-rendered tree (nginx try_files) and the page store, so the warm-up
 *   renders only a small sample of them (to load their code) and every other
 *   indexable URL. About 640 requests instead of ~4,000; target < 10 min.
 * - UAPT_WARMUP_MAX_SECONDS=<n>: stop starting requests after n seconds; the
 *   finished line then says `truncated: true`. Unset or 0: no limit.
 */
const CORE_PATHS = [
  "/", "/zh", "/universities", "/zh/universities", "/changes", "/zh/changes",
  "/reports", "/zh/reports", "/rankings", "/feeds/atom.xml", "/feeds/recent-changes.xml",
  "/llms.txt", "/sitemap.xml"
];
const MAX_SITEMAP_URLS = 5000;
/** School/changes pages still rendered with a page tree: loads their modules and data once. */
const PAGE_TREE_SAMPLE = 12;
const REQUEST_TIMEOUT_MS = 180_000;
const START_DELAY_MS = 5_000;

// scripts/release/render-once.py PAGE_STORE_PATTERN (tests/runtime-warmup.test.ts keeps them equal).
const LOCALES = "en|zh|fr|pl|es|nl|ms|ja|ko|pt|ar|ru|de|it|cs|tr|fi|sv|da|nb|hu|lt|id|vi|th|fa|he|hi|ur|bn|uk|el|zh-Hant";
export const PAGE_STORE_PATTERN = new RegExp(
  `^/(?:(?:${LOCALES})/)?(?:universities/[a-z0-9]+(?:-[a-z0-9]+)*|changes(?:/[A-Za-z0-9._-]+){0,2})$`
);

let started = false;

export function startRuntimeWarmup(): void {
  if (started || process.env.UAPT_WARMUP_ON_START !== "1" || process.env.UAPT_PROGRAM_BUILD === "1") return;
  started = true;
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port <= 0) return;
  const options = {
    pageTree: process.env.UAPT_WARMUP_PAGE_TREE === "1",
    maxSeconds: Math.max(0, Number(process.env.UAPT_WARMUP_MAX_SECONDS ?? 0) || 0)
  };
  const timer = setTimeout(() => { void warm(`http://127.0.0.1:${port}`, options); }, START_DELAY_MS);
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

/** The sitemap pages to request after CORE_PATHS, in sitemap order. */
export function planWarmup(sitemapPaths: readonly string[], options: { pageTree: boolean }): { paths: string[]; skippedForPageTree: number } {
  const paths: string[] = [];
  let sampled = 0, skippedForPageTree = 0;
  for (const path of new Set(sitemapPaths)) {
    if (CORE_PATHS.includes(path)) continue;
    if (options.pageTree && PAGE_STORE_PATTERN.test(path)) {
      if (sampled >= PAGE_TREE_SAMPLE) { skippedForPageTree++; continue; }
      sampled++;
    }
    paths.push(path);
  }
  return { paths, skippedForPageTree };
}

async function warm(origin: string, options: { pageTree: boolean; maxSeconds: number }): Promise<void> {
  const startedAt = Date.now();
  let requests = 0, failures = 0, truncated = false;
  const overBudget = () => options.maxSeconds > 0 && Date.now() - startedAt > options.maxSeconds * 1000;
  const visit = async (path: string) => {
    const result = await fetchText(origin, path);
    requests++;
    if (result.status !== 200 && result.status !== 308) failures++;
    return result;
  };
  for (const path of CORE_PATHS) await visit(path);
  const index = await visit("/sitemap.xml");
  const pages: string[] = [];
  for (const section of locs(index.body)) {
    const sitemap = await visit(section);
    for (const path of locs(sitemap.body)) {
      if (pages.length >= MAX_SITEMAP_URLS) break;
      pages.push(path);
    }
  }
  const plan = planWarmup(pages, options);
  for (const path of plan.paths) {
    if (overBudget()) { truncated = true; break; }
    await visit(path);
  }
  console.log(JSON.stringify({
    message: "Runtime warm-up finished", requests, failures, seconds: Math.round((Date.now() - startedAt) / 1000),
    pageTree: options.pageTree, skippedForPageTree: plan.skippedForPageTree, truncated
  }));
}
