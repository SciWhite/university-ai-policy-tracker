import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;
type RankingRow = { rowNumber: number; rankNumber: number; name: string; countryOrRegion: string };

const RUN_ID = "uapt-ai-tools-qs-701-857-20260719-012";
const OUTPUT = "staging/ai-tools/audits/qs-701-857-discovery-20260719-012.json";
const DOMAIN_SEEDS = "staging/ai-tools/audits/qs-701-857-domain-seeds-20260719-012.json";
const SNAPSHOT_ROOT = `staging/ai-tools/audits/snapshots/${RUN_ID}`;
const ROW_START = 701;
const ROW_END = 857;
const SEARCH_CONCURRENCY = 12;
const SCRAPE_CONCURRENCY = 16;
const URLS_PER_ROW = 6;
const MAX_FIRECRAWL_SCRAPES = 450;
let firecrawlScrapes = 0;

const LANGUAGE: Record<string, { code: string; terms: string }> = {
  Argentina: { code: "es", terms: "inteligencia artificial licencia cuenta institucional acceso estudiantes personal" },
  Australia: { code: "en", terms: "AI institutional license university account students staff access" },
  Azerbaijan: { code: "az", terms: "süni intellekt lisenziya universitet hesabı tələbələr əməkdaşlar giriş" },
  Bangladesh: { code: "bn", terms: "কৃত্রিম বুদ্ধিমত্তা লাইসেন্স বিশ্ববিদ্যালয় অ্যাকাউন্ট শিক্ষার্থী কর্মী প্রবেশাধিকার" },
  Belarus: { code: "ru", terms: "искусственный интеллект лицензия университетский аккаунт доступ студентам сотрудникам" },
  Brazil: { code: "pt", terms: "inteligência artificial licença conta institucional acesso estudantes servidores" },
  Canada: { code: "en", terms: "AI institutional license university account students staff access" },
  Chile: { code: "es", terms: "inteligencia artificial licencia cuenta institucional acceso estudiantes personal" },
  "China (Mainland)": { code: "zh", terms: "人工智能 生成式AI 采购 授权 校园账号 学生 教职工 使用" },
  "Costa Rica": { code: "es", terms: "inteligencia artificial licencia cuenta institucional acceso estudiantes personal" },
  Czechia: { code: "cs", terms: "umělá inteligence licence univerzitní účet přístup studenti zaměstnanci" },
  Ecuador: { code: "es", terms: "inteligencia artificial licencia cuenta institucional acceso estudiantes personal" },
  Egypt: { code: "ar", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Ethiopia: { code: "en", terms: "AI institutional license university account students staff access" },
  France: { code: "fr", terms: "intelligence artificielle licence compte universitaire accès étudiants personnel" },
  Greece: { code: "el", terms: "τεχνητή νοημοσύνη άδεια πανεπιστημιακός λογαριασμός πρόσβαση φοιτητές προσωπικό" },
  Hungary: { code: "hu", terms: "mesterséges intelligencia licenc egyetemi fiók hozzáférés hallgatók dolgozók" },
  India: { code: "hi", terms: "कृत्रिम बुद्धिमत्ता लाइसेंस विश्वविद्यालय खाता छात्र कर्मचारी पहुंच" },
  Indonesia: { code: "id", terms: "kecerdasan buatan lisensi akun universitas akses mahasiswa staf" },
  Iran: { code: "fa", terms: "هوش مصنوعی مجوز حساب دانشگاه دسترسی دانشجویان کارکنان" },
  Iraq: { code: "ar", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Italy: { code: "it", terms: "intelligenza artificiale licenza account universitario accesso studenti personale" },
  Japan: { code: "ja", terms: "生成AI 人工知能 ライセンス 大学アカウント 学生 教職員 利用" },
  Jordan: { code: "ar", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Kenya: { code: "en", terms: "AI institutional license university account students staff access" },
  Kyrgyzstan: { code: "ru", terms: "искусственный интеллект лицензия университетский аккаунт доступ студентам сотрудникам" },
  Lebanon: { code: "ar", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Libya: { code: "ar", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Lithuania: { code: "lt", terms: "dirbtinis intelektas licencija universiteto paskyra prieiga studentams darbuotojams" },
  Malaysia: { code: "ms", terms: "kecerdasan buatan lesen akaun universiti akses pelajar kakitangan" },
  Mexico: { code: "es", terms: "inteligencia artificial licencia cuenta institucional acceso estudiantes personal" },
  Nigeria: { code: "en", terms: "AI institutional license university account students staff access" },
  Oman: { code: "ar", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Pakistan: { code: "ur", terms: "مصنوعی ذہانت لائسنس یونیورسٹی اکاؤنٹ طلبہ عملہ رسائی" },
  Panama: { code: "es", terms: "inteligencia artificial licencia cuenta institucional acceso estudiantes personal" },
  "Palestinian Territories": { code: "ar", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Peru: { code: "es", terms: "inteligencia artificial licencia cuenta institucional acceso estudiantes personal" },
  Poland: { code: "pl", terms: "sztuczna inteligencja licencja konto uczelniane dostęp studenci pracownicy" },
  Portugal: { code: "pt", terms: "inteligência artificial licença conta institucional acesso estudantes funcionários" },
  Romania: { code: "ro", terms: "inteligență artificială licență cont universitar acces studenți personal" },
  Russia: { code: "ru", terms: "искусственный интеллект лицензия университетский аккаунт доступ студентам сотрудникам" },
  "Saudi Arabia": { code: "ar", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Slovakia: { code: "sk", terms: "umelá inteligencia licencia univerzitný účet prístup študenti zamestnanci" },
  "South Africa": { code: "en", terms: "AI institutional license university account students staff access" },
  "South Korea": { code: "ko", terms: "인공지능 생성형 AI 라이선스 대학 계정 학생 교직원 이용" },
  Spain: { code: "es", terms: "inteligencia artificial licencia cuenta institucional acceso estudiantes personal" },
  "Sri Lanka": { code: "en", terms: "AI institutional license university account students staff access" },
  Switzerland: { code: "de", terms: "künstliche Intelligenz Lizenz Hochschulkonto Zugang Studierende Mitarbeitende" },
  Syria: { code: "ar", terms: "الذكاء الاصطناعي ترخيص حساب الجامعة وصول الطلاب الموظفين" },
  Taiwan: { code: "zh", terms: "人工智慧 生成式AI 授權 學校帳號 學生 教職員 使用" },
  Thailand: { code: "th", terms: "ปัญญาประดิษฐ์ ใบอนุญาต บัญชีมหาวิทยาลัย นักศึกษา บุคลากร เข้าใช้" },
  Tunisia: { code: "fr", terms: "intelligence artificielle licence compte universitaire accès étudiants personnel" },
  "Türkiye": { code: "tr", terms: "yapay zeka lisans üniversite hesabı öğrenci personel erişim" },
  "United Kingdom": { code: "en", terms: "AI institutional license university account students staff access" },
  "United States": { code: "en", terms: "AI institutional license university account students staff access" },
  Venezuela: { code: "es", terms: "inteligencia artificial licencia cuenta institucional acceso estudiantes personal" },
  Vietnam: { code: "vi", terms: "trí tuệ nhân tạo giấy phép tài khoản đại học sinh viên nhân viên truy cập" }
};

const PRODUCT_RE = /\b(?:ChatGPT(?:\s+(?:Edu|Enterprise|Business|Team|Plus))?|Microsoft\s+(?:365\s+)?Copilot(?:\s+Chat)?|Copilot\s+Chat|Google\s+Gemini|Gemini(?:\s+(?:Advanced|Education|Pro|Enterprise))?|Notebook\s*LM|Anthropic\s+Claude|Claude(?:\s+Enterprise)?|Perplexity(?:\s+(?:Pro|Enterprise Pro))?|GitHub\s+Copilot|Adobe\s+Firefly|Adobe\s+Express|Zoom\s+(?:AI\s+)?(?:Companion|Assistant)|Scopus\s+AI|Web\s+of\s+Science\s+Research\s+Assistant|Cursor\s+AI|Vertex\s+AI|Blackboard\s+AI|Grammarly(?:\s+AI)?|Institutional\s+AI|University\s+GPT|UniGPT|AI\s+Assistant|AI\s+Hub)\b/giu;
const ACCESS_RE = /(?:available to|access(?:ible)? (?:to|for)|provided to|offered to|licensed? (?:for|to)|enterprise (?:agreement|licen[cs]e)|campus licen[cs]e|university licen[cs]e|institutional (?:account|licen[cs]e)|university account|campus account|sign in with|log in with|students? and (?:faculty|staff)|faculty,? staff,? and students?|all (?:students|employees|users|members)|no (?:additional )?cost|free (?:access|to)|institutionally approved|approved AI tool|university-provided|campus-supported|self-hosted|university-operated|managed licenses?|request access|purchase approval|licencia|licen[çc]a|licence|licenza|lisensi|lisans|licenc|lizenz|acc[eè]s|acceso|accesso|acesso|zugang|konto|cuenta institucional|conta institucional|account universitario|compte universitaire|大学アカウント|라이선스|대학 계정|大学账号|大學帳戶|校园账号|授[权權]|采购|利用|使用|ترخيص|حساب الجامعة|доступ|лицензия|университетский аккаунт)/giu;

async function main() {
  const [ranking, seeds, key, prior] = await Promise.all([
    json("data/rankings/qs-world-university-rankings-2026-top-1000.json"),
    json(DOMAIN_SEEDS),
    firecrawlKey(),
    existing()
  ]);
  const rows: RankingRow[] = ranking.universities.filter((row: RankingRow) => row.rowNumber >= ROW_START && row.rowNumber <= ROW_END).sort((a: RankingRow, b: RankingRow) => a.rowNumber - b.rowNumber);
  if (rows.length !== 157) throw new Error(`Expected 157 exact ranking rows, got ${rows.length}`);
  const seedsByRow = new Map<number, Json>(seeds.rows.map((row: Json) => [row.qsRow, row]));
  const completed = new Map<number, Json>((prior.rows ?? []).map((row: Json) => [row.qsRow, row]));
  await mkdir(SNAPSHOT_ROOT, { recursive: true });
  for (let offset = 0; offset < rows.length; offset += 10) {
    const batch = rows.slice(offset, offset + 10).filter((row) => !completed.has(row.rowNumber));
    const searchJobs = batch.flatMap((row) => {
      const seed = seedsByRow.get(row.rowNumber);
      if (!seed?.officialDomain) throw new Error(`Missing official domain for QS ${row.rowNumber}`);
      const profile = LANGUAGE[row.countryOrRegion];
      if (!profile) throw new Error(`Missing language profile for ${row.countryOrRegion}`);
      return queries(row, seed.officialDomain, profile).map((query) => ({ row, seed, profile, query }));
    });
    const searched = await pool(searchJobs, SEARCH_CONCURRENCY, async (job) => ({ ...job, result: await search(key, job.query, job.seed.officialDomain) }));
    const searchesByRow = new Map<number, Json[]>();
    for (const item of searched) searchesByRow.set(item.row.rowNumber, [...(searchesByRow.get(item.row.rowNumber) ?? []), item.result]);
    const pageJobs: Array<{ row: RankingRow; seed: Json; candidate: Json }> = [];
    for (const row of batch) {
      const seed = seedsByRow.get(row.rowNumber)!;
      const candidates = rankUrls((searchesByRow.get(row.rowNumber) ?? []).flatMap((result) => result.results ?? []), seed.officialDomain).slice(0, URLS_PER_ROW);
      pageJobs.push(...candidates.map((candidate) => ({ row, seed, candidate })));
    }
    const fetched = await pool(pageJobs, SCRAPE_CONCURRENCY, async (job) => ({ ...job, page: await scrape(key, job.row, job.seed.officialDomain, job.candidate) }));
    for (const row of batch) {
      const seed = seedsByRow.get(row.rowNumber)!;
      const searches = searchesByRow.get(row.rowNumber) ?? [];
      const pages = fetched.filter((item) => item.row.rowNumber === row.rowNumber).map((item) => item.page);
      completed.set(row.rowNumber, {
        qsRow: row.rowNumber,
        qsRank: row.rankNumber,
        universityName: row.name,
        countryOrRegion: row.countryOrRegion,
        canonicalSlug: seed.canonicalSlug,
        localLanguage: LANGUAGE[row.countryOrRegion].code,
        officialDomain: seed.officialDomain,
        domainResolutionMethod: seed.resolutionMethod,
        searchedAt: new Date().toISOString(),
        searches,
        candidateUrls: pages.map((page) => page.requestedUrl),
        pages,
        semanticCandidateCount: pages.filter((page) => page.fetchStatus === "ok" && page.semanticSignals.productTerms.length && page.semanticSignals.accessTerms.length).length
      });
    }
    await persist([...completed.values()].sort((a, b) => a.qsRow - b.qsRow));
    console.log(`QS 701-857 discovery: ${completed.size}/157; Firecrawl scrape fallbacks: ${firecrawlScrapes}`);
  }
  const values = [...completed.values()].sort((a, b) => a.qsRow - b.qsRow);
  await persist(values);
  const searches = values.flatMap((row) => row.searches);
  console.log(JSON.stringify({ rows: values.length, searches: searches.length, searchErrors: searches.filter((item) => item.status === "error").length, pages: values.flatMap((row) => row.pages).length, semanticCandidates: values.reduce((sum, row) => sum + row.semanticCandidateCount, 0), firecrawlScrapes }, null, 2));
}

function queries(row: RankingRow, domain: string, profile: { code: string; terms: string }) {
  const output = [
    { matrixId: "en-institutional-tools", language: "en", query: `site:${domain} ("AI tools" OR "generative AI tools") (students OR staff OR faculty)` },
    { matrixId: "en-products-access", language: "en", query: `site:${domain} (ChatGPT OR Copilot OR Gemini OR Claude OR Perplexity OR NotebookLM) (access OR available OR license OR account)` },
    { matrixId: "en-enterprise-platform", language: "en", query: `site:${domain} (enterprise OR licensed OR "university account" OR "institutional account" OR "self-hosted") (AI OR chatbot OR Copilot OR Gemini)` }
  ];
  if (profile.code === "en") {
    output.push(
      { matrixId: "en-premium-products", language: "en", query: `site:${domain} ("Microsoft 365 Copilot" OR "Copilot Chat" OR "ChatGPT Edu" OR "Claude Enterprise")` },
      { matrixId: "en-library-products", language: "en", query: `site:${domain} (NotebookLM OR "Zoom AI" OR Firefly OR "Scopus AI" OR "Research Assistant" OR Grammarly)` }
    );
  } else {
    output.push(
      { matrixId: "local-products-access", language: profile.code, query: `site:${domain} ${profile.terms} ChatGPT Copilot Gemini Claude` },
      { matrixId: "local-platform-procurement", language: profile.code, query: `site:${domain} ${profile.terms} (chatbot OR "AI platform" OR NotebookLM OR Perplexity)` }
    );
  }
  return output.map((item) => ({ ...item, universityName: row.name }));
}

async function search(key: string, item: Json, officialDomain: string) {
  let last: Json = {};
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const searchedAt = new Date().toISOString();
    try {
      const response = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ query: item.query, limit: 8, sources: ["web"], timeout: 30000 }),
        signal: AbortSignal.timeout(45_000)
      });
      const body: any = await response.json().catch(() => ({}));
      const values = body?.data?.web ?? body?.data ?? [];
      const results = values.map((value: Json) => ({ url: value.url, title: value.title ?? null, description: value.description ?? null })).filter((value: Json) => value.url && official(value.url, officialDomain));
      last = { ...item, searchedAt, attempt, provider: "firecrawl_search_v2", searchId: body?.id ?? null, creditsUsed: body?.creditsUsed ?? null, status: response.ok ? (results.length ? "ok" : "empty") : "error", results, filteredResultCount: values.length - results.length, error: response.ok ? null : String(body?.error ?? `HTTP ${response.status}`) };
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) return last;
    } catch (error) {
      last = { ...item, searchedAt, attempt, provider: "firecrawl_search_v2", searchId: null, creditsUsed: null, status: "error", results: [], filteredResultCount: 0, error: String(error) };
    }
    await delay(900 * attempt);
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
  let text = `${value.url} ${value.title ?? ""} ${value.description ?? ""}`;
  try { text = decodeURIComponent(text); } catch { /* Retain malformed search URL text. */ }
  text = text.toLowerCase();
  let score = 0;
  if (/chatgpt|copilot|gemini|notebook|claude|perplexity|firefly|zoom.ai|scopus.ai|ai.tools|aihub|ai-hub|ai.assistant|generative.ai|artificial.intelligence|\/ai(?:\/|$)/.test(text)) score += 100;
  if (/available|access|licen[cs]e|enterprise|approved|account|student|staff|faculty|procurement|purchase/.test(text)) score += 40;
  if (/\/it|\/oit|\/ict|digital|software|service|tool|resource|library|teaching|learning/.test(text)) score += 15;
  if (/course|degree|program|research.paper|repository|bitstream|journal|conference|event|publication/.test(text)) score -= 35;
  return score;
}

async function scrape(key: string, row: RankingRow, officialDomain: string, candidate: Json) {
  const fetchedAt = new Date().toISOString();
  let text = "";
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
    if (response.ok && official(finalUrl, officialDomain) && /text\/(?:html|plain)/i.test(contentType)) text = htmlToText(await response.text());
    else if (response.ok && official(finalUrl, officialDomain) && /application\/pdf/i.test(contentType)) {
      const converted = spawnSync("pdftotext", ["-", "-"], { input: Buffer.from(await response.arrayBuffer()), maxBuffer: 30_000_000 });
      if (converted.status === 0) text = converted.stdout.toString("utf8");
      else error = "pdftotext failed";
    } else error = `HTTP ${response.status} or unsupported content`;
  } catch (cause) { error = String(cause); }
  if (!text && firecrawlScrapes < MAX_FIRECRAWL_SCRAPES) {
    firecrawlScrapes += 1;
    provider = "firecrawl_scrape_v2_fallback";
    try {
      const response = await fetch("https://api.firecrawl.dev/v2/scrape", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ url: candidate.url, formats: ["markdown"], onlyMainContent: true }), signal: AbortSignal.timeout(40_000) });
      const body: any = await response.json().catch(() => ({}));
      httpStatus = body?.data?.metadata?.statusCode ?? response.status;
      finalUrl = body?.data?.metadata?.sourceURL ?? body?.data?.metadata?.url ?? candidate.url;
      title = body?.data?.metadata?.title ?? title;
      language = body?.data?.metadata?.language ?? language;
      if (response.ok && official(finalUrl, officialDomain)) text = String(body?.data?.markdown ?? "");
      else error = String(body?.error ?? `HTTP ${response.status}`);
    } catch (cause) { error = String(cause); }
  }
  const ok = Boolean(text.trim()) && official(finalUrl, officialDomain);
  const snapshotPath = ok ? path.join(SNAPSHOT_ROOT, `${row.rowNumber}-${slug(new URL(finalUrl).hostname + new URL(finalUrl).pathname)}-${hash(finalUrl).slice(0, 10)}.md`) : null;
  if (snapshotPath) await writeFile(snapshotPath, text);
  const signals = semanticSignals(text);
  return { requestedUrl: candidate.url, finalUrl, title, language, provider, fetchedAt, fetchStatus: ok ? "ok" : "error", httpStatus, snapshotPath, snapshotHash: snapshotPath ? hash(text) : null, semanticSignals: signals, evidenceWindows: evidenceWindows(text), error: ok ? null : error };
}

function semanticSignals(text: string) { const normalized = normalize(text); return { productTerms: matches(normalized, PRODUCT_RE), accessTerms: matches(normalized, ACCESS_RE) }; }
function evidenceWindows(text: string) { const normalized = normalize(text); const windows: string[] = []; for (const match of normalized.matchAll(PRODUCT_RE)) { const start = Math.max(0, (match.index ?? 0) - 360); const end = Math.min(normalized.length, (match.index ?? 0) + match[0].length + 520); windows.push(normalized.slice(start, end)); } return [...new Set(windows)].slice(0, 24); }
function official(value: string, domain: string) { try { const host = new URL(value).hostname.toLowerCase().replace(/^www\./, ""); return host === domain || host.endsWith(`.${domain}`); } catch { return false; } }
function matches(text: string, regex: RegExp) { regex.lastIndex = 0; return [...new Set([...text.matchAll(regex)].map((match) => match[0]))].slice(0, 40); }
function normalize(value: string) { return value.normalize("NFKC").replace(/[*_#`|]/g, " ").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/[\u00a0\s]+/g, " ").trim(); }
function htmlToText(value: string) { return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim(); }
function slug(value: string) { return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120); }
function hash(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function json(file: string): Promise<Json> { return JSON.parse(await readFile(file, "utf8")); }
async function existing(): Promise<Json> { try { return await json(OUTPUT); } catch { return { rows: [] }; } }
async function persist(rows: Json[]) { await writeFile(OUTPUT, `${JSON.stringify({ schemaVersion: "uapt-ai-tools-discovery-v2", runId: RUN_ID, generatedAt: new Date().toISOString(), scope: { rows: [ROW_START, ROW_END], count: 157 }, budgetPolicy: { queriesPerUniversityInitial: 5, urlsPerUniversity: URLS_PER_ROW, httpFirst: true, maxFirecrawlScrapeFallbacks: MAX_FIRECRAWL_SCRAPES }, rows }, null, 2)}\n`); }
async function firecrawlKey() { const config = await readFile("/Users/newvolume/.codex/config.toml", "utf8"); const key = config.match(/^\s*FIRECRAWL_API_KEY\s*=\s*["']?([^\s"']+)/m)?.[1]; if (!key) throw new Error("FIRECRAWL_API_KEY unavailable"); return key; }
async function pool<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) { const output: R[] = []; let next = 0; await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => { while (next < items.length) { const index = next++; output[index] = await task(items[index]); } })); return output; }

void main().catch((error) => { console.error(error); process.exitCode = 1; });
