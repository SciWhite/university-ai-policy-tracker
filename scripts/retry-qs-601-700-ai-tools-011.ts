import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;
const FILE = "staging/ai-tools/audits/qs-601-700-discovery-20260719-011.json";

async function main() {
  const [document, key] = await Promise.all([json(FILE), apiKey()]);
  let repaired = 0;
  const failedQueries = document.rows.flatMap((row: Json) => row.searches.filter((search: Json) => search.status === "error").map((prior: Json) => ({ row, prior })));
  const replacements = await pool(failedQueries, 8, async ({ row, prior }) => ({ row, prior, replacement: await retrySearch(key, prior, row.officialDomain) }));
  for (const { row, prior, replacement } of replacements) {
    row.searches[row.searches.indexOf(prior)] = replacement;
    if (replacement.status !== "error") repaired += 1;
  }
  for (const row of document.rows as Json[]) {
    const urls = rank(row.searches.flatMap((search: Json) => search.results ?? []), row.officialDomain)
      .filter((candidate: Json) => !(row.pages ?? []).some((page: Json) => page.requestedUrl === candidate.url))
      .slice(0, Math.max(0, 10 - (row.pages?.length ?? 0)));
    for (const candidate of urls) row.pages.push(await scrape(key, row, candidate));
    row.candidateUrls = [...new Set(row.pages.map((page: Json) => page.requestedUrl))];
    row.semanticCandidateCount = row.pages.filter((page: Json) => page.semanticSignals.productTerms.length && page.semanticSignals.accessTerms.length).length;
  }
  document.generatedAt = new Date().toISOString();
  document.retrySummary = {
    repaired,
    remainingErrors: document.rows.flatMap((row: Json) => row.searches).filter((search: Json) => search.status === "error").length,
    queries: document.rows.flatMap((row: Json) => row.searches).length
  };
  await writeFile(FILE, `${JSON.stringify(document, null, 2)}\n`);
  console.log(JSON.stringify(document.retrySummary, null, 2));
}

async function retrySearch(key: string, prior: Json, domain: string) {
  let last = prior;
  for (let attempt = 4; attempt <= 8; attempt += 1) {
    const searchedAt = new Date().toISOString();
    try {
      const response = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ query: prior.query, limit: 10, sources: ["web"], timeout: 30000 }),
        signal: AbortSignal.timeout(45_000)
      });
      const body: any = await response.json().catch(() => ({}));
      const values = body?.data?.web ?? body?.data ?? [];
      const results = values.map((value: Json) => ({ url: value.url, title: value.title ?? null, description: value.description ?? null })).filter((value: Json) => value.url && official(value.url, domain));
      last = { ...prior, searchedAt, attempt, provider: "firecrawl_search_v2_retry", searchId: body?.id ?? null, creditsUsed: body?.creditsUsed ?? null, status: response.ok ? (results.length ? "ok" : "empty") : "error", results, filteredResultCount: values.length - results.length, error: response.ok ? null : String(body?.error ?? `HTTP ${response.status}`) };
      if (response.ok) return last;
    } catch (error) { last = { ...prior, searchedAt, attempt, provider: "firecrawl_search_v2_retry", status: "error", results: [], error: String(error) }; }
    await new Promise((resolve) => setTimeout(resolve, attempt * 900));
  }
  return last;
}

function rank(values: Json[], domain: string) {
  const map = new Map<string, Json>();
  for (const value of values) if (official(value.url, domain)) {
    const current = map.get(value.url) ?? { ...value, occurrences: 0 };
    current.occurrences += 1;
    map.set(value.url, current);
  }
  return [...map.values()].sort((a, b) => score(b) - score(a) || b.occurrences - a.occurrences);
}
function score(value: Json) { const text = `${value.url} ${value.title ?? ""} ${value.description ?? ""}`.toLowerCase(); return (/chatgpt|copilot|gemini|notebook|claude|perplexity|firefly|zoom|scopus|research-assistant|ai-tool|ai-platform|artificial-intelligence/.test(text) ? 100 : 0) + (/available|access|licen[cs]e|enterprise|account|student|staff|faculty/.test(text) ? 35 : 0); }

async function scrape(key: string, row: Json, candidate: Json) {
  const fetchedAt = new Date().toISOString();
  let markdown = ""; let finalUrl = candidate.url; let title = candidate.title ?? "Official university page"; let language = "und"; let provider = "http"; let httpStatus: number | null = null; let error: string | null = null;
  try {
    const response = await fetch(candidate.url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; UAPT-Audit/2.0; +https://eduaipolicy.org)" }, signal: AbortSignal.timeout(20_000) });
    httpStatus = response.status; finalUrl = response.url || candidate.url;
    if (response.ok && official(finalUrl, row.officialDomain) && /text\/(?:html|plain)/i.test(response.headers.get("content-type") ?? "")) markdown = html(await response.text());
    else error = `HTTP ${response.status} or unsupported content`;
  } catch (cause) { error = String(cause); }
  if (!markdown) {
    provider = "firecrawl_scrape_v2_retry";
    try {
      const response = await fetch("https://api.firecrawl.dev/v2/scrape", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ url: candidate.url, formats: ["markdown"], onlyMainContent: true }), signal: AbortSignal.timeout(35_000) });
      const body: any = await response.json().catch(() => ({})); httpStatus = body?.data?.metadata?.statusCode ?? response.status; finalUrl = body?.data?.metadata?.sourceURL ?? body?.data?.metadata?.url ?? candidate.url; title = body?.data?.metadata?.title ?? title; language = body?.data?.metadata?.language ?? language;
      if (response.ok && official(finalUrl, row.officialDomain)) markdown = String(body?.data?.markdown ?? ""); else error = String(body?.error ?? `HTTP ${response.status}`);
    } catch (cause) { error = String(cause); }
  }
  const ok = Boolean(markdown) && official(finalUrl, row.officialDomain);
  const snapshotPath = ok ? path.join("staging/ai-tools/audits/snapshots/uapt-ai-tools-qs-601-700-20260719-011", `${row.qsRow}-${slug(new URL(finalUrl).hostname + new URL(finalUrl).pathname)}-${hash(finalUrl).slice(0, 10)}.md`) : null;
  if (snapshotPath) await writeFile(snapshotPath, markdown);
  const normalized = normalize(markdown); const products = [...new Set(normalized.match(/\b(?:ChatGPT|Copilot|Gemini|Notebook\s*LM|Claude|Perplexity|Firefly|Zoom\s+AI|Scopus\s+AI|Web\s+of\s+Science\s+Research\s+Assistant|Grammarly|Cursor\s+AI)\b/giu) ?? [])]; const access = [...new Set(normalized.match(/(?:available to|access(?:ible)? (?:to|for)|licensed? (?:for|to)|university account|sign in with|log in with|all (?:students|employees|users|members)|free access|request access|purchase)/giu) ?? [])];
  return { requestedUrl: candidate.url, finalUrl, title, language, provider, fetchedAt, fetchStatus: ok ? "ok" : "error", httpStatus, snapshotPath, snapshotHash: snapshotPath ? hash(markdown) : null, semanticSignals: { productTerms: products, accessTerms: access }, evidenceWindows: [], error: ok ? null : error };
}

function official(value: string, domain: string) { try { const host = new URL(value).hostname.toLowerCase().replace(/^www\./, ""); return host === domain || host.endsWith(`.${domain}`); } catch { return false; } }
function normalize(value: string) { return value.normalize("NFKC").replace(/[*_#`|]/g, " ").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/[\u00a0\s]+/g, " ").trim(); }
function html(value: string) { return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim(); }
function slug(value: string) { return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120); }
function hash(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
async function json(file: string): Promise<Json> { return JSON.parse(await readFile(file, "utf8")); }
async function apiKey() { const config = await readFile("/Users/newvolume/.codex/config.toml", "utf8"); const key = config.match(/^\s*FIRECRAWL_API_KEY\s*=\s*["']?([^\s"']+)/m)?.[1]; if (!key) throw new Error("FIRECRAWL_API_KEY unavailable"); return key; }
async function pool<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) { const output: R[] = []; let next = 0; await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => { while (next < items.length) { const index = next++; output[index] = await task(items[index]); } })); return output; }
void main().catch((error) => { console.error(error); process.exitCode = 1; });
