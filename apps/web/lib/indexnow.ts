import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { CONTENT_POINTER_SCHEMA, type ContentPointer } from "./content-runtime";
import {
  SITEMAP_SECTION_IDS,
  buildSitemapSection
} from "./sitemap-sections";

export const DEFAULT_INDEXNOW_KEY = "8373fa05a76a4d59abadbe13a617acb0";
export const DEFAULT_INDEXNOW_HOST = "eduaipolicy.org";
export const DEFAULT_INDEXNOW_BASE_URL = "https://eduaipolicy.org";
export const DEFAULT_INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export const INDEXNOW_MAX_URLS_PER_CALL = 10000;
export const INDEXNOW_DEFAULT_BATCH_SIZE = 1000;
const MAX_PUBLISHED_SITEMAP_DOCUMENTS = 100;
const MAX_PUBLISHED_SITEMAP_BYTES = 20 * 1024 * 1024;

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation?: string;
  urlList: string[];
}

export interface IndexNowSubmissionResult {
  status: number;
  statusText: string;
  ok: boolean;
  submittedCount: number;
  message?: string;
}

export interface SubmitIndexNowOptions {
  urls: string[];
  key?: string;
  host?: string;
  keyLocation?: string;
  dryRun?: boolean;
  endpoint?: string;
  batchSize?: number;
}

/**
 * Normalizes a URL to ensure it matches the canonical host, protocol, and trailing slash standard.
 */
export function normalizeIndexNowUrl(
  rawUrl: string,
  baseUrl: string = DEFAULT_INDEXNOW_BASE_URL
): string {
  const targetBase = new URL(baseUrl);
  const parsed = new URL(rawUrl, baseUrl);

  // Normalize host and protocol to canonical values
  parsed.protocol = targetBase.protocol;
  parsed.host = targetBase.host;
  parsed.port = targetBase.port;
  parsed.search = "";
  parsed.hash = "";

  // Strip trailing slash except for root path
  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}

/**
 * Chunks an array into smaller slices.
 */
export function chunkUrls(urls: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += chunkSize) {
    chunks.push(urls.slice(i, i + chunkSize));
  }
  return chunks;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([\da-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function sitemapLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi), (match) =>
    decodeXmlText(match[1].trim())
  ).filter(Boolean);
}

/** Reads the currently published sitemap index and its same-origin child sitemaps. */
export async function getPublishedSitemapIndexNowUrls(
  baseUrl: string = DEFAULT_INDEXNOW_BASE_URL,
  fetcher: typeof fetch = fetch
): Promise<string[]> {
  const site = new URL(baseUrl);
  const sitemapOrigin = site.origin;
  const pending = [{ url: new URL("/sitemap.xml", site).toString(), depth: 0 }];
  const visited = new Set<string>();
  const urls = new Set<string>();

  while (pending.length > 0) {
    const next = pending.shift()!;
    const sitemapUrl = new URL(next.url);
    if (sitemapUrl.origin !== sitemapOrigin) {
      throw new Error(`Published sitemap URL is outside ${sitemapOrigin}`);
    }
    if (visited.has(sitemapUrl.toString())) continue;
    if (visited.size >= MAX_PUBLISHED_SITEMAP_DOCUMENTS) {
      throw new Error("Published sitemap index exceeds the document limit");
    }
    visited.add(sitemapUrl.toString());

    const response = await fetcher(sitemapUrl);
    if (!response.ok) {
      throw new Error(`Published sitemap returned HTTP ${response.status}: ${sitemapUrl.pathname}`);
    }
    const xml = await response.text();
    if (Buffer.byteLength(xml, "utf8") > MAX_PUBLISHED_SITEMAP_BYTES) {
      throw new Error(`Published sitemap is larger than ${MAX_PUBLISHED_SITEMAP_BYTES} bytes`);
    }
    const locs = sitemapLocs(xml);
    if (/<sitemapindex(?:\s|>)/i.test(xml)) {
      if (next.depth >= 1) throw new Error("Nested published sitemap indexes are not supported");
      for (const loc of locs) {
        const child = new URL(loc, sitemapUrl);
        if (child.origin !== sitemapOrigin) {
          throw new Error(`Published child sitemap is outside ${sitemapOrigin}`);
        }
        pending.push({ url: child.toString(), depth: next.depth + 1 });
      }
      continue;
    }
    if (!/<urlset(?:\s|>)/i.test(xml)) {
      throw new Error(`Published sitemap has an unrecognized XML root: ${sitemapUrl.pathname}`);
    }
    for (const loc of locs) {
      const publishedUrl = new URL(loc, site);
      if (publishedUrl.origin !== sitemapOrigin) {
        throw new Error(`Published URL is outside ${sitemapOrigin}`);
      }
      urls.add(normalizeIndexNowUrl(publishedUrl.toString(), baseUrl));
    }
  }

  return Array.from(urls);
}

/** Returns changed URLs that are currently present in the public sitemap. */
export async function intersectIndexNowUrlsWithPublishedSitemap(
  changedUrls: string[],
  baseUrl: string = DEFAULT_INDEXNOW_BASE_URL,
  fetcher: typeof fetch = fetch
): Promise<string[]> {
  const published = new Set(await getPublishedSitemapIndexNowUrls(baseUrl, fetcher));
  const normalized = Array.from(new Set(changedUrls.map((url) => normalizeIndexNowUrl(url, baseUrl))));
  return normalized.filter((url) => published.has(url));
}

/**
 * Submits URL list to IndexNow API in batches.
 */
export async function submitToIndexNow(
  options: SubmitIndexNowOptions
): Promise<IndexNowSubmissionResult[]> {
  const key = options.key || process.env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
  const host = options.host || process.env.INDEXNOW_HOST || DEFAULT_INDEXNOW_HOST;
  const endpoint = options.endpoint || DEFAULT_INDEXNOW_ENDPOINT;
  const keyLocation = options.keyLocation || `https://${host}/${key}.txt`;
  const batchSize = Math.min(
    options.batchSize || INDEXNOW_DEFAULT_BATCH_SIZE,
    INDEXNOW_MAX_URLS_PER_CALL
  );

  const cleanUrls = Array.from(
    new Set(
      options.urls
        .map((u) => normalizeIndexNowUrl(u, `https://${host}`))
        .filter((u) => Boolean(u) && u.startsWith(`https://${host}`))
    )
  );

  if (cleanUrls.length === 0) {
    return [];
  }

  if (options.dryRun) {
    return [
      {
        status: 200,
        statusText: "Dry Run (simulated)",
        ok: true,
        submittedCount: cleanUrls.length,
        message: `Simulated submission of ${cleanUrls.length} URLs for host ${host}.`
      }
    ];
  }

  const chunks = chunkUrls(cleanUrls, batchSize);
  const results: IndexNowSubmissionResult[] = [];

  for (const chunk of chunks) {
    const payload: IndexNowPayload = {
      host,
      key,
      keyLocation,
      urlList: chunk
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const ok = res.status === 200 || res.status === 202;
    let message: string | undefined;

    if (res.status === 200) {
      message = "Submitted and accepted immediately by search engine.";
    } else if (res.status === 202) {
      message = "Accepted by IndexNow; key validation / index update pending.";
    } else if (res.status === 400) {
      message = "Bad request: invalid payload format.";
    } else if (res.status === 403) {
      message = "Forbidden: key not valid or key file not found on host.";
    } else if (res.status === 422) {
      message = "Unprocessable entity: URLs don't belong to host or key doesn't match.";
    } else if (res.status === 429) {
      message = "Too many requests: rate limited by IndexNow.";
    } else {
      message = `HTTP status ${res.status}: ${res.statusText}`;
    }

    results.push({
      status: res.status,
      statusText: res.statusText,
      ok,
      submittedCount: chunk.length,
      message
    });
  }

  return results;
}

export interface ContentReleaseIndexNowBasis {
  contentId: string;
  /** manifest.json of the active release: the same synchronization basis content:switch binds. */
  manifestFile: string;
  manifestSha256: string;
  /** False for a local preview pointer, which can never be announced. */
  synchronized: boolean;
  /** The content:switch plan of this selection; absent for a first selection. */
  switchPlanFile?: string;
  /** Changed paths content:switch recorded for refresh and purge. */
  paths: string[];
}

/**
 * The active runtime content release (R1-b/R1-d) and the changed-URL list its
 * switch recorded. The pointer, manifest hash and plan identity must agree, so
 * a notification can only describe the release that is actually selected.
 */
export function activeContentReleaseIndexNowBasis(contentRoot: string): ContentReleaseIndexNowBasis {
  const pointerFile = path.join(/* turbopackIgnore: true */ contentRoot, "current.json");
  if (!existsSync(pointerFile) || lstatSync(pointerFile).isSymbolicLink()) throw new Error(`No regular content pointer at ${pointerFile}`);
  const pointer = JSON.parse(readFileSync(pointerFile, "utf8")) as ContentPointer;
  if (pointer.schemaVersion !== CONTENT_POINTER_SCHEMA || !/^[a-z0-9][a-z0-9.-]{2,95}$/.test(pointer.contentId ?? "")) throw new Error("Invalid content pointer");
  const releaseDir = path.join(/* turbopackIgnore: true */ contentRoot, "releases", pointer.contentId);
  const manifestFile = path.join(/* turbopackIgnore: true */ releaseDir, "manifest.json");
  const manifestSha256 = createHash("sha256").update(readFileSync(manifestFile)).digest("hex");
  if (manifestSha256 !== pointer.manifestSha256) throw new Error("Content manifest hash differs from the pointer");
  const basis = { contentId: pointer.contentId, manifestFile, manifestSha256, synchronized: Boolean(pointer.sync), paths: [] as string[] };
  if (!pointer.previousContentId || !pointer.switchedAt) return basis;
  const switchPlanFile = path.join(/* turbopackIgnore: true */ releaseDir, `switch-${pointer.switchedAt.replace(/[:.]/g, "-")}.json`);
  const plan = JSON.parse(readFileSync(switchPlanFile, "utf8")) as { schemaVersion?: string; contentId?: string; previousContentId?: string | null; switchedAt?: string; paths?: unknown };
  if (plan.schemaVersion !== "uapt-content-switch-v1" || plan.contentId !== pointer.contentId || plan.switchedAt !== pointer.switchedAt || plan.previousContentId !== pointer.previousContentId || !Array.isArray(plan.paths) || plan.paths.some((p) => typeof p !== "string" || !p.startsWith("/"))) {
    throw new Error(`Switch plan ${path.basename(switchPlanFile)} does not describe the selected release`);
  }
  return { ...basis, switchPlanFile, paths: plan.paths as string[] };
}

/**
 * URLs changed by the selected content release: its switch plan's paths. Live
 * submission still intersects them with the published sitemap.
 */
export function getLatestReleaseIndexNowUrls(
  basis: Pick<ContentReleaseIndexNowBasis, "paths">,
  baseUrl: string = DEFAULT_INDEXNOW_BASE_URL
): string[] {
  return Array.from(new Set(basis.paths.map((p) => normalizeIndexNowUrl(p, baseUrl))));
}

/**
 * Collects all URLs from all sitemap sections.
 */
export async function getAllIndexNowUrls(
  baseUrl: string = DEFAULT_INDEXNOW_BASE_URL
): Promise<string[]> {
  const previousEnv = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    process.env.NEXT_PUBLIC_SITE_URL = baseUrl;
    const urls = new Set<string>();

    for (const section of SITEMAP_SECTION_IDS) {
      const entries = await buildSitemapSection(section);
      for (const entry of entries) {
        urls.add(normalizeIndexNowUrl(entry.url, baseUrl));
      }
    }

    return Array.from(urls);
  } finally {
    if (previousEnv) {
      process.env.NEXT_PUBLIC_SITE_URL = previousEnv;
    } else {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  }
}
