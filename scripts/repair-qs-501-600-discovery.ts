import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;

const RUN_ID = "uapt-ai-tools-qs-501-600-20260718-009";
const LEDGER_PATH = "staging/ai-tools/audits/qs-501-600-ai-tools-audit-ledger-20260718-009.json";
const OUTPUT_PATH = "staging/ai-tools/audits/qs-501-600-repair-discovery-20260718-009.json";
const SNAPSHOT_DIR = `staging/ai-tools/audits/snapshots/${RUN_ID}/repair-review`;
const CONCURRENCY = 4;

const OFFICIAL_DOMAIN_OVERRIDES: Record<number, string> = {
  510: "utk.edu",
  521: "usj.edu.lb",
  523: "uqu.edu.sa",
  524: "undip.ac.id",
  528: "istanbul.edu.tr",
  545: "kfu.edu.sa",
  548: "plus.ac.at",
  549: "udelar.edu.uy",
  552: "dlsu.edu.ph",
  554: "uaf.edu.pk",
  557: "biu.ac.il",
  561: "comsats.edu.pk",
  562: "iith.ac.in",
  563: "mu.ac.in",
  565: "bits-pilani.ac.in",
  573: "bau.edu.lb",
  576: "haifa.ac.il",
  580: "ub.ac.id",
  582: "tdtu.edu.vn",
  584: "cut.ac.cy",
  586: "torontomu.ca",
  590: "pieas.edu.pk",
  591: "psau.edu.sa",
  593: "misis.ru",
  597: "pnu.edu.sa"
};

const SEEDED_URLS: Record<number, string[]> = {
  510: ["https://oit.utk.edu/ai/aihub/", "https://oit.utk.edu/ai/ai-at-ut-guidance-and-resources/ai-tools-at-ut/"],
  525: ["https://career.oregonstate.edu/resumes-cvs-cover-letters/ai-tools-career-development"],
  555: ["https://genai.usf.edu/genai-resources/tools", "https://guides.lib.usf.edu/AI/LINK"],
  594: ["https://ai.uc.edu/ai-tools/ms-365-copilot-chat"]
};

async function main() {
  const [ledger, key, existing] = await Promise.all([readJson(LEDGER_PATH), firecrawlKey(), readExisting()]);
  const rows = ledger.entries.filter((entry: Json) => entry.auditStatus === "blocked");
  const existingRows = (existing.rows ?? []).filter((row: Json) => {
    if (SEEDED_URLS[row.qsRow]) return row.seedPriorityVersion === 3;
    return !OFFICIAL_DOMAIN_OVERRIDES[row.qsRow] || (row.officialDomain === OFFICIAL_DOMAIN_OVERRIDES[row.qsRow] && row.domainValidationVersion === 2);
  });
  const existingByRow = new Map(existingRows.map((row: Json) => [row.qsRow, row]));

  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const pending = rows.filter((row: Json) => !existingByRow.has(row.qsRow));
  for (let offset = 0; offset < pending.length; offset += 8) {
    const results = await Promise.all(pending.slice(offset, offset + 8).map((row: Json) => reviewRow(key, row)));
    for (const result of results) existingByRow.set(result.qsRow, result);
    await persist([...existingByRow.values()].sort((a, b) => a.qsRow - b.qsRow));
    console.log(`repair discovery ${existingByRow.size}/${rows.length}; latest QS rows ${results.map((result) => result.qsRow).join(", ")}`);
  }
}

async function reviewRow(key: string, row: Json) {
  const domain = OFFICIAL_DOMAIN_OVERRIDES[row.qsRow] ?? String(row.officialDomain ?? "");
  const queries = [
    `site:${domain} AI tools Copilot ChatGPT Gemini Claude Perplexity`,
    `site:${domain} generative AI available students faculty staff university account`,
    `site:${domain} institutional AI platform licence license access`,
    `site:${domain} Microsoft Copilot Adobe Firefly NotebookLM AI assistant`
  ];
  const searches = await pool(queries, 2, (query) => searchWithRetry(key, query));

  const priorUrls = (row.directOfficialPageChecks ?? []).map((check: Json) => check.finalUrl ?? check.requestedUrl);
  const seeds = new Set(SEEDED_URLS[row.qsRow] ?? []);
  const candidateUrls = [...new Set([
    ...(SEEDED_URLS[row.qsRow] ?? []),
    ...searches.flatMap((search) => search.results.map((result: Json) => result.url)),
    ...priorUrls
  ])]
    .filter((url): url is string => typeof url === "string" && isOfficial(url, domain))
    .sort((a, b) => Number(seeds.has(b)) - Number(seeds.has(a)) || scoreUrl(b) - scoreUrl(a) || a.localeCompare(b))
    .slice(0, 10);

  const checks = await pool(candidateUrls, CONCURRENCY, (url) => scrape(key, { ...row, officialDomain: domain }, url));
  return {
    qsRow: row.qsRow,
    universityName: row.universityName,
    countryOrRegion: row.countryOrRegion,
    officialDomain: domain,
    domainValidationVersion: 2,
    seedPriorityVersion: seeds.size ? 3 : null,
    reviewedAt: new Date().toISOString(),
    searches,
    candidateUrls,
    successfulScrapes: checks.filter((check) => check.fetchStatus === "ok").length,
    semanticCandidates: checks.filter((check) => check.semanticSignals.productTerms.length && check.semanticSignals.accessTerms.length).length,
    checks
  };
}

async function searchWithRetry(key: string, query: string) {
  let last: Json | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const searchedAt = new Date().toISOString();
    try {
      const response = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ query, limit: 10, sources: ["web"], timeout: 30000 }),
        signal: AbortSignal.timeout(45_000)
      });
      const body: any = await response.json().catch(() => ({}));
      const values = body?.data?.web ?? body?.data ?? [];
      last = {
        query,
        searchedAt,
        attempt,
        status: response.ok ? (values.length ? "ok" : "empty") : "error",
        httpStatus: response.status,
        results: values.map((value: Json) => ({ url: value.url, title: value.title ?? null, description: value.description ?? null })).filter((value: Json) => value.url),
        error: response.ok ? null : String(body?.error ?? `HTTP ${response.status}`)
      };
      if (response.ok) return last;
    } catch (error) {
      last = { query, searchedAt, attempt, status: "error", httpStatus: null, results: [], error: String(error) };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
  return last ?? { query, status: "error", results: [], error: "unknown search failure" };
}

async function scrape(key: string, row: Json, requestedUrl: string) {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ url: requestedUrl, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(60_000)
    });
    const body: any = await response.json().catch(() => ({}));
    const data = body?.data ?? {};
    const markdown = String(data.markdown ?? "");
    const finalUrl = String(data.metadata?.sourceURL ?? data.metadata?.url ?? requestedUrl);
    const ok = response.ok && Boolean(markdown) && isOfficial(finalUrl, row.officialDomain);
    const snapshotPath = ok
      ? path.join(SNAPSHOT_DIR, `${String(row.qsRow).padStart(3, "0")}-${slug(new URL(finalUrl).hostname + new URL(finalUrl).pathname)}-${hash(finalUrl).slice(0, 10)}.md`)
      : null;
    if (snapshotPath) await writeFile(snapshotPath, markdown);
    return {
      qsRow: row.qsRow,
      requestedUrl,
      finalUrl,
      fetchedAt,
      fetchStatus: ok ? "ok" : "error",
      httpStatus: data.metadata?.statusCode ?? response.status,
      sourceTitle: data.metadata?.title ?? "Official university page",
      sourceLanguage: data.metadata?.language ?? "und",
      snapshotPath,
      snapshotHash: snapshotPath ? hash(markdown) : null,
      semanticSignals: detectSignals(markdown),
      error: ok ? null : String(body?.error ?? `HTTP ${response.status}`)
    };
  } catch (error) {
    return {
      qsRow: row.qsRow,
      requestedUrl,
      finalUrl: requestedUrl,
      fetchedAt,
      fetchStatus: "error",
      httpStatus: null,
      sourceTitle: null,
      sourceLanguage: "und",
      snapshotPath: null,
      snapshotHash: null,
      semanticSignals: { productTerms: [], accessTerms: [] },
      error: String(error)
    };
  }
}

function detectSignals(markdown: string) {
  const text = markdown.normalize("NFKC").replace(/\s+/g, " ");
  const productTerms = matches(text, /\b(?:ChatGPT(?: Edu)?|Microsoft (?:365 )?Copilot(?: Chat)?|Copilot Chat|GitHub Copilot|Google Gemini|Gemini Pro|Notebook\s*LM|Anthropic Claude|Claude|Perplexity(?: Pro| Enterprise Pro)?|Adobe Firefly|Adobe Express|Zoom AI Companion|Scopus AI|AI assistant|AI chatbot|AI platform|LLM platform)\b/giu);
  const accessTerms = matches(text, /(?:available to|access for|provided to|offered to|licensed? (?:for|to)|enterprise licen[cs]e|university licen[cs]e|institutional account|university account|campus account|sign in with|log in with|students? and (?:faculty|staff)|faculty,? staff,? and students?|all students?|all employees|free access|no additional cost|institutionally approved|approved AI tool|university-provided|campus-supported|self-hosted|university-operated)/giu);
  return { productTerms, accessTerms };
}

function matches(text: string, regex: RegExp) {
  return [...new Set([...text.matchAll(regex)].map((match) => match[0]))].slice(0, 30);
}

function scoreUrl(url: string) {
  const value = decodeURIComponent(url).toLowerCase();
  let score = 0;
  if (/chatgpt|copilot|gemini|notebook|claude|perplexity|firefly|ai-tools|aihub|ai-hub|ai-assistant|artificial-intelligence|generative-ai|\/ai(?:\/|$)/.test(value)) score += 80;
  if (/\/it|\/oit|\/ict|digital|software|service|tool|resource|library|teaching|learning/.test(value)) score += 20;
  if (/blog|news|event|course|research|publication|repository|bitstream/.test(value)) score -= 15;
  if (/\.pdf(?:$|\?)/.test(value)) score -= 10;
  return score;
}

function isOfficial(value: string, domain: string) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return Boolean(domain) && (host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

async function persist(rows: Json[]) {
  await writeFile(OUTPUT_PATH, `${JSON.stringify({ schemaVersion: "uapt-ai-tools-repair-discovery-v1", runId: RUN_ID, generatedAt: new Date().toISOString(), rows }, null, 2)}\n`);
}

async function readExisting(): Promise<Json> {
  try { return await readJson(OUTPUT_PATH); } catch { return { rows: [] }; }
}

async function readJson(file: string): Promise<Json> {
  return JSON.parse(await readFile(file, "utf8"));
}

async function firecrawlKey() {
  const config = await readFile("/Users/newvolume/.codex/config.toml", "utf8");
  const key = config.match(/^\s*FIRECRAWL_API_KEY\s*=\s*["']?([^\s"']+)/m)?.[1];
  if (!key) throw new Error("FIRECRAWL_API_KEY unavailable");
  return key;
}

function hash(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 110) || "page";
}

async function pool<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
