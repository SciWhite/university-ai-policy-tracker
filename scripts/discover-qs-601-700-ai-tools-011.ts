import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;
type RankingRow = { rowNumber: number; rankNumber: number; name: string; countryOrRegion: string };

const RUN_ID = "uapt-ai-tools-qs-601-700-20260719-011";
const OUTPUT = "staging/ai-tools/audits/qs-601-700-discovery-20260719-011.json";
const SNAPSHOT_ROOT = `staging/ai-tools/audits/snapshots/${RUN_ID}`;
const SEARCH_CONCURRENCY = 6;
const SCRAPE_CONCURRENCY = 8;

const DOMAIN_OVERRIDES: Record<number, string> = {
  601: "utm.rnu.tn",
  607: "sbu.ac.ir",
  608: "syr.edu",
  609: "catholic.ac.kr",
  636: "thapar.edu",
  674: "newschool.edu",
  686: "uet.edu.pk"
};

const LANGUAGE: Record<string, { code: string; country: string; terms: string }> = {
  Tunisia: { code: "fr", country: "TN", terms: "intelligence artificielle licence compte universitaire accès étudiants personnel" },
  "Türkiye": { code: "tr", country: "TR", terms: "yapay zeka lisans üniversite hesabı öğrenci personel erişim" },
  Poland: { code: "pl", country: "PL", terms: "sztuczna inteligencja licencja konto uczelniane dostęp studenci pracownicy" },
  Lithuania: { code: "lt", country: "LT", terms: "dirbtinis intelektas licencija universiteto paskyra prieiga studentams darbuotojams" },
  Russia: { code: "ru", country: "RU", terms: "искусственный интеллект лицензия университетский аккаунт доступ студентам сотрудникам" },
  Iran: { code: "fa", country: "IR", terms: "هوش مصنوعی مجوز حساب دانشگاه دسترسی دانشجویان کارکنان" },
  "South Korea": { code: "ko", country: "KR", terms: "인공지능 생성형 AI 라이선스 대학 계정 학생 교직원 이용" },
  Malta: { code: "mt", country: "MT", terms: "intelliġenza artifiċjali liċenzja kont universitarju aċċess studenti persunal" },
  Italy: { code: "it", country: "IT", terms: "intelligenza artificiale licenza account universitario accesso studenti personale" },
  Hungary: { code: "hu", country: "HU", terms: "mesterséges intelligencia licenc egyetemi fiók hozzáférés hallgatók dolgozók" },
  Germany: { code: "de", country: "DE", terms: "künstliche Intelligenz Lizenz Universitätskonto Zugang Studierende Beschäftigte" },
  France: { code: "fr", country: "FR", terms: "intelligence artificielle licence compte universitaire accès étudiants personnel" },
  Bangladesh: { code: "bn", country: "BD", terms: "কৃত্রিম বুদ্ধিমত্তা লাইসেন্স বিশ্ববিদ্যালয় অ্যাকাউন্ট শিক্ষার্থী কর্মী প্রবেশাধিকার" },
  Czechia: { code: "cs", country: "CZ", terms: "umělá inteligence licence univerzitní účet přístup studenti zaměstnanci" },
  Pakistan: { code: "ur", country: "PK", terms: "مصنوعی ذہانت لائسنس یونیورسٹی اکاؤنٹ طلبہ عملہ رسائی" },
  India: { code: "hi", country: "IN", terms: "कृत्रिम बुद्धिमत्ता लाइसेंस विश्वविद्यालय खाता छात्र कर्मचारी पहुंच" },
  Taiwan: { code: "zh", country: "TW", terms: "人工智慧 生成式AI 授權 學校帳號 學生 教職員 使用" },
  Kazakhstan: { code: "kk", country: "KZ", terms: "жасанды интеллект лицензия университет тіркелгісі студенттер қызметкерлер қолжетімді" },
  Latvia: { code: "lv", country: "LV", terms: "mākslīgais intelekts licence universitātes konts piekļuve studentiem darbiniekiem" },
  Serbia: { code: "sr", country: "RS", terms: "вештачка интелигенција лиценца универзитетски налог приступ студенти запослени" },
  Romania: { code: "ro", country: "RO", terms: "inteligență artificială licență cont universitar acces studenți personal" },
  Oman: { code: "ar", country: "OM", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Vietnam: { code: "vi", country: "VN", terms: "trí tuệ nhân tạo giấy phép tài khoản đại học sinh viên nhân viên truy cập" },
  Lebanon: { code: "ar", country: "LB", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Spain: { code: "es", country: "ES", terms: "inteligencia artificial licencia cuenta universitaria acceso estudiantes personal" },
  Egypt: { code: "ar", country: "EG", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  "Hong Kong SAR": { code: "zh", country: "HK", terms: "人工智能 生成式AI 授權 大學帳戶 學生 教職員 使用" },
  Kuwait: { code: "ar", country: "KW", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Colombia: { code: "es", country: "CO", terms: "inteligencia artificial licencia cuenta universitaria acceso estudiantes personal" },
  Portugal: { code: "pt", country: "PT", terms: "inteligência artificial licença conta universitária acesso estudantes funcionários" },
  Belgium: { code: "nl", country: "BE", terms: "kunstmatige intelligentie licentie universiteitsaccount toegang studenten medewerkers" },
  Ukraine: { code: "uk", country: "UA", terms: "штучний інтелект ліцензія університетський обліковий запис доступ студентам працівникам" },
  "China (Mainland)": { code: "zh", country: "CN", terms: "人工智能 生成式AI 采购 授权 校园账号 学生 教职工 使用" },
  Japan: { code: "ja", country: "JP", terms: "生成AI 人工知能 ライセンス 大学アカウント 学生 教職員 利用" },
  Norway: { code: "no", country: "NO", terms: "kunstig intelligens lisens universitetskonto tilgang studenter ansatte" },
  Chile: { code: "es", country: "CL", terms: "inteligencia artificial licencia cuenta universitaria acceso estudiantes personal" },
  Bahrain: { code: "ar", country: "BH", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  "Saudi Arabia": { code: "ar", country: "SA", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Jordan: { code: "ar", country: "JO", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Mexico: { code: "es", country: "MX", terms: "inteligencia artificial licencia cuenta universitaria acceso estudiantes personal" },
  Ecuador: { code: "es", country: "EC", terms: "inteligencia artificial licencia cuenta universitaria acceso estudiantes personal" },
  Cuba: { code: "es", country: "CU", terms: "inteligencia artificial licencia cuenta universitaria acceso estudiantes personal" },
  Uruguay: { code: "es", country: "UY", terms: "inteligencia artificial licencia cuenta universitaria acceso estudiantes personal" },
  Brazil: { code: "pt", country: "BR", terms: "inteligência artificial licença conta universitária acesso estudantes servidores" },
  Malaysia: { code: "ms", country: "MY", terms: "kecerdasan buatan lesen akaun universiti akses pelajar kakitangan" }
};

const ENGLISH_COUNTRIES = new Set(["United States", "United Kingdom", "Canada", "Australia", "Ireland"]);
const PRODUCT_RE = /\b(?:ChatGPT(?:\s+(?:Edu|Enterprise|Business|Team))?|Microsoft\s+(?:365\s+)?Copilot(?:\s+Chat)?|Copilot\s+Chat|Google\s+Gemini|Gemini(?:\s+(?:Advanced|Education|Pro))?|Notebook\s*LM|Anthropic\s+Claude|Claude(?:\s+Enterprise)?|Perplexity(?:\s+(?:Pro|Enterprise Pro))?|GitHub\s+Copilot|Adobe\s+Firefly|Adobe\s+Express|Zoom\s+AI\s+(?:Companion|Assistant)|Scopus\s+AI|Web\s+of\s+Science\s+Research\s+Assistant|Cursor\s+AI|Vertex\s+AI|Blackboard\s+AI|Grammarly|WarriorGPT|Clementine|Amplify)\b/giu;
const ACCESS_RE = /(?:available to|access(?:ible)? (?:to|for)|provided to|offered to|licensed? (?:for|to)|enterprise (?:agreement|licen[cs]e)|campus licen[cs]e|university licen[cs]e|institutional (?:account|licen[cs]e)|university account|campus account|sign in with|log in with|students? and (?:faculty|staff)|faculty,? staff,? and students?|all (?:students|employees|users|members)|no (?:additional )?cost|free (?:access|to)|institutionally approved|approved AI tool|university-provided|campus-supported|self-hosted|university-operated|managed licenses?|request access|purchase approval)/giu;

async function main() {
  const [ranking, key, existing, domainEvidence] = await Promise.all([
    readJson("data/rankings/qs-world-university-rankings-2026-top-1000.json"),
    firecrawlKey(),
    readExisting(),
    collectDomainEvidence()
  ]);
  const rows: RankingRow[] = ranking.universities.filter((row: RankingRow) => row.rowNumber >= 601 && row.rowNumber <= 700).sort((a: RankingRow, b: RankingRow) => a.rowNumber - b.rowNumber);
  if (rows.length !== 100) throw new Error(`Expected 100 ranking rows, got ${rows.length}`);
  const validExisting = (existing.rows ?? []).filter((row: Json) => {
    const rankingRow = rows.find((value) => value.rowNumber === row.qsRow);
    if (!rankingRow) return false;
    const candidates = [...(domainEvidence.get(slug(rankingRow.name)) ?? new Map()).entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
    const expectedDomain = DOMAIN_OVERRIDES[row.qsRow] ?? candidates[0]?.[0];
    return row.officialDomain === expectedDomain;
  });
  const complete = new Map<number, Json>(validExisting.map((row: Json) => [row.qsRow, row]));
  await mkdir(SNAPSHOT_ROOT, { recursive: true });
  for (let offset = 0; offset < rows.length; offset += 5) {
    const pending = rows.slice(offset, offset + 5).filter((row: RankingRow) => !complete.has(row.rowNumber));
    const results = await pool(pending, 5, (row) => discoverRow(row, key, domainEvidence));
    for (const result of results) complete.set(result.qsRow, result);
    await persist([...complete.values()].sort((a, b) => a.qsRow - b.qsRow));
    console.log(`QS 601-700 discovery: ${complete.size}/100`);
  }
}

async function discoverRow(row: RankingRow, key: string, evidence: Map<string, Map<string, number>>) {
  const slugValue = slug(row.name);
  const domainCandidates = [...(evidence.get(slugValue) ?? new Map()).entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
  const officialDomain = DOMAIN_OVERRIDES[row.rowNumber] ?? domainCandidates[0]?.[0];
  if (!officialDomain) throw new Error(`No official domain for QS ${row.rowNumber} ${row.name}`);
  const language = LANGUAGE[row.countryOrRegion] ?? (ENGLISH_COUNTRIES.has(row.countryOrRegion) ? { code: "en", country: "US", terms: "AI institutional license university account students staff access" } : null);
  if (!language) throw new Error(`No local-language profile for ${row.countryOrRegion}`);
  const queries = englishQueries(row.name, officialDomain).map((query, index) => ({ matrixId: `en-${index + 1}`, query, language: "en" }));
  if (language.code !== "en") {
    queries.push(...localQueries(row.name, officialDomain, language.terms).map((query, index) => ({ matrixId: `local-${index + 1}`, query, language: language.code })));
  }
  const searches = await pool(queries, SEARCH_CONCURRENCY, (item) => search(key, item, language.country, officialDomain));
  const rankedUrls = rankUrls(searches.flatMap((searchResult) => searchResult.results), officialDomain).slice(0, 8);
  const pages = await pool(rankedUrls, SCRAPE_CONCURRENCY, (candidate) => scrape(key, row, officialDomain, candidate));
  return {
    qsRow: row.rowNumber,
    qsRank: row.rankNumber,
    universityName: row.name,
    countryOrRegion: row.countryOrRegion,
    localLanguage: language.code,
    officialDomain,
    domainCandidates: domainCandidates.slice(0, 8).map(([domain, sources]) => ({ domain, sources })),
    searchedAt: new Date().toISOString(),
    searches,
    candidateUrls: rankedUrls.map((item) => item.url),
    pages,
    semanticCandidateCount: pages.filter((page) => page.semanticSignals.productTerms.length && page.semanticSignals.accessTerms.length).length
  };
}

function englishQueries(name: string, domain: string) {
  return [
    `site:${domain} "${name}" "AI tools" generative AI`,
    `site:${domain} ChatGPT Copilot Gemini Claude Perplexity`,
    `site:${domain} ("available to" OR "access for" OR "university account") (Copilot OR Gemini OR ChatGPT OR Claude)`,
    `site:${domain} (license OR licensed OR enterprise OR procurement) (AI OR Copilot OR Gemini OR ChatGPT)`,
    `site:${domain} ("AI platform" OR chatbot OR "AI assistant") students staff`,
    `site:${domain} (library OR IT OR digital) ("AI tools" OR Copilot OR Gemini OR ChatGPT)`,
    `site:${domain} ("Microsoft 365 Copilot" OR "Copilot Chat" OR "Claude Enterprise" OR "ChatGPT Edu")`,
    `site:${domain} (NotebookLM OR "Zoom AI" OR Firefly OR "Scopus AI" OR "Research Assistant")`
  ];
}

function localQueries(name: string, domain: string, terms: string) {
  return [
    `site:${domain} "${name}" ${terms}`,
    `site:${domain} ${terms} ChatGPT Copilot Gemini Claude`,
    `site:${domain} ${terms} NotebookLM Perplexity Zoom AI`,
    `site:${domain} ${terms} chatbot AI platform`
  ];
}

async function search(key: string, item: Json, country: string, officialDomain: string) {
  let last: Json = {};
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const searchedAt = new Date().toISOString();
    try {
      const response = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ query: item.query, limit: 10, sources: ["web"], country, timeout: 30000 }),
        signal: AbortSignal.timeout(45_000)
      });
      const body: any = await response.json().catch(() => ({}));
      const values = body?.data?.web ?? body?.data ?? [];
      const results = values.map((value: Json) => ({ url: value.url, title: value.title ?? null, description: value.description ?? null })).filter((value: Json) => value.url && official(value.url, officialDomain));
      last = { ...item, searchedAt, attempt, provider: "firecrawl_search_v2", searchId: body?.id ?? null, creditsUsed: body?.creditsUsed ?? null, status: response.ok ? (results.length ? "ok" : "empty") : "error", results, filteredResultCount: values.length - results.length, error: response.ok ? null : String(body?.error ?? `HTTP ${response.status}`) };
      if (response.ok) return last;
    } catch (error) {
      last = { ...item, searchedAt, attempt, provider: "firecrawl_search_v2", status: "error", results: [], error: String(error) };
    }
    await delay(750 * attempt);
  }
  return last;
}

function rankUrls(values: Json[], officialDomain: string) {
  const byUrl = new Map<string, Json>();
  for (const value of values) {
    if (!official(value.url, officialDomain)) continue;
    const current = byUrl.get(value.url) ?? { ...value, occurrences: 0 };
    current.occurrences += 1;
    byUrl.set(value.url, current);
  }
  return [...byUrl.values()].sort((a, b) => scoreUrl(b) - scoreUrl(a) || b.occurrences - a.occurrences || a.url.localeCompare(b.url));
}

function scoreUrl(value: Json) {
  const raw = `${value.url} ${value.title ?? ""} ${value.description ?? ""}`;
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { /* Keep malformed search-result URLs as returned. */ }
  const text = decoded.toLowerCase();
  let score = 0;
  if (/chatgpt|copilot|gemini|notebook|claude|perplexity|firefly|zoom-ai|scopus-ai|ai-tools|aihub|ai-hub|ai-assistant|generative-ai|artificial-intelligence|\/ai(?:\/|$)/.test(text)) score += 100;
  if (/available|access|licen[cs]e|enterprise|approved|account|student|staff|faculty/.test(text)) score += 35;
  if (/\/it|\/oit|\/ict|digital|software|service|tool|resource|library|teaching|learning/.test(text)) score += 15;
  if (/course|degree|program|research-paper|repository|bitstream|journal|conference|event/.test(text)) score -= 30;
  return score;
}

async function scrape(key: string, row: RankingRow, officialDomain: string, candidate: Json) {
  const fetchedAt = new Date().toISOString();
  let markdown = "";
  let finalUrl = candidate.url;
  let title = candidate.title ?? "Official university page";
  let language = "und";
  let provider = "http";
  let httpStatus: number | null = null;
  let error: string | null = null;
  try {
    const response = await fetch(candidate.url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; UAPT-Audit/2.0; +https://eduaipolicy.org)" }, signal: AbortSignal.timeout(20_000) });
    httpStatus = response.status;
    finalUrl = response.url || candidate.url;
    const contentType = response.headers.get("content-type") ?? "";
    if (response.ok && official(finalUrl, officialDomain) && /text\/(?:html|plain)/i.test(contentType)) markdown = htmlToText(await response.text());
    else error = `HTTP ${response.status} or unsupported content`;
  } catch (cause) { error = String(cause); }
  if (!markdown) {
    provider = "firecrawl_scrape_v2_fallback";
    try {
      const response = await fetch("https://api.firecrawl.dev/v2/scrape", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ url: candidate.url, formats: ["markdown"], onlyMainContent: true }), signal: AbortSignal.timeout(35_000) });
      const body: any = await response.json().catch(() => ({}));
      httpStatus = body?.data?.metadata?.statusCode ?? response.status;
      finalUrl = body?.data?.metadata?.sourceURL ?? body?.data?.metadata?.url ?? candidate.url;
      title = body?.data?.metadata?.title ?? title;
      language = body?.data?.metadata?.language ?? language;
      if (response.ok && official(finalUrl, officialDomain)) markdown = String(body?.data?.markdown ?? "");
      else error = String(body?.error ?? `HTTP ${response.status}`);
    } catch (cause) { error = String(cause); }
  }
  const ok = Boolean(markdown) && official(finalUrl, officialDomain);
  const snapshotPath = ok ? path.join(SNAPSHOT_ROOT, `${String(row.rowNumber).padStart(3, "0")}-${slug(new URL(finalUrl).hostname + new URL(finalUrl).pathname)}-${hash(finalUrl).slice(0, 10)}.md`) : null;
  if (snapshotPath) await writeFile(snapshotPath, markdown);
  const signals = semanticSignals(markdown);
  return { requestedUrl: candidate.url, finalUrl, title, language, provider, fetchedAt, fetchStatus: ok ? "ok" : "error", httpStatus, snapshotPath, snapshotHash: snapshotPath ? hash(markdown) : null, semanticSignals: signals, evidenceWindows: evidenceWindows(markdown), error: ok ? null : error };
}

function semanticSignals(text: string) {
  const normalized = normalize(text);
  return { productTerms: matches(normalized, PRODUCT_RE), accessTerms: matches(normalized, ACCESS_RE) };
}

function evidenceWindows(text: string) {
  const normalized = normalize(text);
  const sentences = normalized.split(/(?<=[.!?。！？])\s+/).filter((sentence) => sentence.length > 20);
  return sentences.filter((sentence) => { PRODUCT_RE.lastIndex = 0; return PRODUCT_RE.test(sentence); }).slice(0, 18);
}

async function collectDomainEvidence() {
  const ranking = await readJson("data/rankings/qs-world-university-rankings-2026-top-1000.json");
  const wanted = new Set(ranking.universities.filter((row: RankingRow) => row.rowNumber >= 601 && row.rowNumber <= 700).map((row: RankingRow) => slug(row.name)));
  const domains = new Map<string, Map<string, number>>();
  const blocked = new Set(["google.com", "dropbox.com", "sharepoint.com", "policystat.com", "doi.org", "researchgate.net"]);
  for (const entry of await readdir("staging/uapt-runs", { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const bundle = await readJson(path.join("staging/uapt-runs", entry.name, "artifacts.json"));
      for (const artifact of bundle.artifacts ?? []) {
        if (artifact.artifactType !== "source_candidate" || !wanted.has(artifact.entitySlug)) continue;
        const host = new URL(artifact.finalUrl ?? artifact.sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
        const domain = registrable(host);
        if (blocked.has(domain)) continue;
        const counts = domains.get(artifact.entitySlug) ?? new Map<string, number>();
        counts.set(domain, (counts.get(domain) ?? 0) + 1);
        domains.set(artifact.entitySlug, counts);
      }
    } catch { /* Ignore unrelated malformed or incomplete historic runs. */ }
  }
  return domains;
}

function registrable(host: string) {
  const labels = host.split(".");
  const second = labels.at(-2) ?? "";
  const tld = labels.at(-1) ?? "";
  if (tld.length === 2 && /^(?:ac|edu|com|org|gov|net)$/.test(second) && labels.length >= 3) return labels.slice(-3).join(".");
  return labels.slice(-2).join(".");
}

function official(value: string, domain: string) { try { const host = new URL(value).hostname.toLowerCase().replace(/^www\./, ""); return host === domain || host.endsWith(`.${domain}`); } catch { return false; } }
function matches(text: string, regex: RegExp) { regex.lastIndex = 0; return [...new Set([...text.matchAll(regex)].map((match) => match[0]))].slice(0, 30); }
function normalize(value: string) { return value.normalize("NFKC").replace(/[*_#`|]/g, " ").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/[\u00a0\s]+/g, " ").trim(); }
function htmlToText(value: string) { return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim(); }
function slug(value: string) { return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/^the-/, "").replace(/-formerly.*$/, "").slice(0, 120); }
function hash(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function readJson(file: string): Promise<Json> { return JSON.parse(await readFile(file, "utf8")); }
async function readExisting(): Promise<Json> { try { return await readJson(OUTPUT); } catch { return { rows: [] }; } }
async function persist(rows: Json[]) { await writeFile(OUTPUT, `${JSON.stringify({ schemaVersion: "uapt-ai-tools-discovery-v2", runId: RUN_ID, generatedAt: new Date().toISOString(), scope: { rows: [601, 700], count: 100 }, rows }, null, 2)}\n`); }
async function firecrawlKey() { const config = await readFile("/Users/newvolume/.codex/config.toml", "utf8"); const key = config.match(/^\s*FIRECRAWL_API_KEY\s*=\s*["']?([^\s"']+)/m)?.[1]; if (!key) throw new Error("FIRECRAWL_API_KEY unavailable"); return key; }
async function pool<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) { const output: R[] = []; let next = 0; await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => { while (next < items.length) { const index = next++; output[index] = await task(items[index]); } })); return output; }

void main().catch((error) => { console.error(error); process.exitCode = 1; });
