import {
  SITEMAP_SECTION_IDS,
  buildSitemapSection
} from "./sitemap-sections";
import { getLatestReleaseDiff } from "./release-diffs";

export const DEFAULT_INDEXNOW_KEY = "8373fa05a76a4d59abadbe13a617acb0";
export const DEFAULT_INDEXNOW_HOST = "eduaipolicy.org";
export const DEFAULT_INDEXNOW_BASE_URL = "https://eduaipolicy.org";
export const DEFAULT_INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export const INDEXNOW_MAX_URLS_PER_CALL = 10000;
export const INDEXNOW_DEFAULT_BATCH_SIZE = 1000;

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

/**
 * Collects all URLs modified in the latest published release.
 */
export async function getLatestReleaseIndexNowUrls(
  baseUrl: string = DEFAULT_INDEXNOW_BASE_URL
): Promise<string[]> {
  const diff = await getLatestReleaseDiff();
  const urls = new Set<string>();

  // Aggregated landing pages that reflect newly published policy changes
  urls.add(normalizeIndexNowUrl("/", baseUrl));
  urls.add(normalizeIndexNowUrl("/changes", baseUrl));
  urls.add(normalizeIndexNowUrl("/universities", baseUrl));

  // Release summary page
  urls.add(normalizeIndexNowUrl(`/changes/${diff.releaseId}`, baseUrl));

  // Entity-specific policy and diff pages
  for (const entity of diff.entities) {
    urls.add(normalizeIndexNowUrl(`/universities/${entity.entitySlug}`, baseUrl));
    urls.add(
      normalizeIndexNowUrl(
        `/changes/${diff.releaseId}/${entity.entitySlug}`,
        baseUrl
      )
    );
  }

  return Array.from(urls);
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
