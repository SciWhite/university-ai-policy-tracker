import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;
type RankingRow = { rowNumber: number; rankNumber: number; name: string; countryOrRegion: string };

const OUTPUT = "staging/ai-tools/audits/qs-701-857-domain-seeds-20260719-012.json";
const ROW_START = 701;
const ROW_END = 857;
const NON_OFFICIAL = new Set([
  "academia.edu", "facebook.com", "instagram.com", "linkedin.com", "libguides.com",
  "microsoftonline.com", "researchgate.net", "sharepoint.com", "topuniversities.com",
  "wikipedia.org", "youtube.com"
]);
const GENERIC_ACADEMIC = new Set([
  "ac.bd", "ac.in", "ac.jp", "ac.ke", "ac.kr", "ac.lk", "ac.th", "ac.uk", "ac.za",
  "edu.au", "edu.az", "edu.cn", "edu.et", "edu.iq", "edu.jo", "edu.lb", "edu.my",
  "edu.ng", "edu.om", "edu.pk", "edu.pl", "edu.sa", "edu.tr", "edu.tw", "edu.vn"
]);
const DOMAIN_OVERRIDES: Record<number, string> = {
  701: "vnuhcm.edu.vn",
  714: "effatuniversity.edu.sa",
  788: "univ-sfax.tn",
  792: "sggw.edu.pl",
  814: "calpoly.edu",
  818: "cupl.edu.cn",
  821: "damascusuniversity.edu.sy",
  826: "ulacit.ac.cr",
  827: "unimet.edu.ve",
  833: "up.ac.pa",
  837: "luz.edu.ve",
  839: "ufrn.br",
  846: "umsl.edu",
  847: "uom.lk",
  850: "uot.edu.ly",
  851: "zcu.cz"
};

async function main() {
  const [ranking, key, previous, publicIndexes, artifactDomains] = await Promise.all([
    json("data/rankings/qs-world-university-rankings-2026-top-1000.json"),
    firecrawlKey(),
    existing(),
    loadPublicIndexes(),
    collectArtifactDomains()
  ]);
  const rows: RankingRow[] = ranking.universities
    .filter((row: RankingRow) => row.rowNumber >= ROW_START && row.rowNumber <= ROW_END)
    .sort((a: RankingRow, b: RankingRow) => a.rowNumber - b.rowNumber);
  if (rows.length !== 157 || rows.at(-1)?.rowNumber !== ROW_END) throw new Error(`Expected exact QS rows 701-857, got ${rows.length}`);
  const priorByRow = new Map<number, Json>((previous.rows ?? []).map((row: Json) => [row.qsRow, row]));
  const output: Json[] = [];
  for (let offset = 0; offset < rows.length; offset += 8) {
    const chunk = rows.slice(offset, offset + 8);
    const resolved = await pool(chunk, 8, async (row) => {
      const prior = priorByRow.get(row.rowNumber);
      if (prior?.status === "resolved" && prior.officialDomain && !DOMAIN_OVERRIDES[row.rowNumber]) return prior;
      const indexed = publicIndexes.byRow.get(row.rowNumber);
      const canonicalSlug = indexed?.slug ?? slug(row.name);
      const candidates = new Map<string, number>();
      for (const domain of indexed?.domains ?? []) addDomain(candidates, domain, 3);
      for (const [domain, count] of artifactDomains.get(canonicalSlug) ?? []) addDomain(candidates, domain, count);
      if (DOMAIN_OVERRIDES[row.rowNumber]) addDomain(candidates, DOMAIN_OVERRIDES[row.rowNumber], 1000);
      let discovery: Json | null = null;
      let officialDomain = chooseDomain(candidates, row.name);
      if (!officialDomain) {
        discovery = await discoverDomain(key, row);
        for (const result of discovery.results ?? []) addDomain(candidates, result.url, 1);
        officialDomain = chooseDomain(candidates, row.name);
      }
      return {
        qsRow: row.rowNumber,
        qsRank: row.rankNumber,
        universityName: row.name,
        countryOrRegion: row.countryOrRegion,
        canonicalSlug,
        officialDomain,
        status: officialDomain ? "resolved" : "unresolved",
        resolutionMethod: DOMAIN_OVERRIDES[row.rowNumber]
          ? "reviewed_override"
          : indexed?.domains?.length
            ? "promoted_public_entity_sources"
            : officialDomain
              ? "firecrawl_official_homepage_discovery"
              : "unresolved",
        domainCandidates: [...candidates.entries()].sort((a, b) => b[1] - a[1]).map(([domain, score]) => ({ domain, score })),
        discovery
      };
    });
    output.push(...resolved);
    await persist([...output, ...rows.slice(offset + chunk.length).map((row) => priorByRow.get(row.rowNumber)).filter(Boolean)]);
    console.log(`Domain seeds ${Math.min(offset + chunk.length, rows.length)}/${rows.length}`);
  }
  await persist(output.sort((a, b) => a.qsRow - b.qsRow));
  const unresolved = output.filter((row) => !row.officialDomain);
  console.log(JSON.stringify({ rows: output.length, resolved: output.length - unresolved.length, unresolved: unresolved.map((row) => ({ qsRow: row.qsRow, universityName: row.universityName })) }, null, 2));
}

async function loadPublicIndexes() {
  const cacheBust = Date.now();
  const [universities, entities] = await Promise.all([
    fetch(`https://eduaipolicy.org/api/public/v1/university-index.json?_domain_seed=${cacheBust}`).then(assertJson),
    fetch(`https://eduaipolicy.org/api/public/v1/entities/index.json?_domain_seed=${cacheBust}`).then(assertJson)
  ]);
  const entitiesBySlug = new Map<string, Json>(entities.data.records.map((record: Json) => [record.entitySlug, record]));
  const byRow = new Map<number, { slug: string; domains: string[] }>();
  for (const record of universities.data.records as Json[]) {
    const qs = record.rankings?.find((ranking: Json) => ranking.systemId === "qs" && ranking.rankingYear === 2026);
    if (!qs?.rowNumber) continue;
    const entity = entitiesBySlug.get(record.slug);
    byRow.set(qs.rowNumber, { slug: record.slug, domains: entity?.domainMatches ?? [] });
  }
  return { byRow };
}

async function collectArtifactDomains() {
  const output = new Map<string, Map<string, number>>();
  for (const entry of await readdir("staging/uapt-runs", { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const bundle = await json(path.join("staging/uapt-runs", entry.name, "artifacts.json"));
      for (const artifact of bundle.artifacts ?? []) {
        if (artifact.artifactType !== "source_candidate" || artifact.entityType !== "university") continue;
        const domain = rootDomain(new URL(artifact.finalUrl ?? artifact.sourceUrl).hostname);
        if (NON_OFFICIAL.has(domain) || GENERIC_ACADEMIC.has(domain)) continue;
        const values = output.get(artifact.entitySlug) ?? new Map<string, number>();
        values.set(domain, (values.get(domain) ?? 0) + 1);
        output.set(artifact.entitySlug, values);
      }
    } catch { /* Ignore unrelated or incomplete historical bundles. */ }
  }
  return output;
}

async function discoverDomain(key: string, row: RankingRow) {
  const query = `"${row.name}" official university website`;
  const searchedAt = new Date().toISOString();
  try {
    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ query, limit: 6, sources: ["web"], timeout: 30000 }),
      signal: AbortSignal.timeout(45_000)
    });
    const body: any = await response.json().catch(() => ({}));
    const values = body?.data?.web ?? body?.data ?? [];
    return {
      query,
      searchedAt,
      provider: "firecrawl_search_v2",
      searchId: body?.id ?? null,
      creditsUsed: body?.creditsUsed ?? null,
      status: response.ok ? (values.length ? "ok" : "empty") : "error",
      results: values.map((value: Json) => ({ url: value.url, title: value.title ?? null, description: value.description ?? null })).filter((value: Json) => value.url),
      error: response.ok ? null : String(body?.error ?? `HTTP ${response.status}`)
    };
  } catch (error) {
    return { query, searchedAt, provider: "firecrawl_search_v2", searchId: null, creditsUsed: null, status: "error", results: [], error: String(error) };
  }
}

function addDomain(values: Map<string, number>, urlOrDomain: string, weight: number) {
  try {
    const host = urlOrDomain.includes("://") ? new URL(urlOrDomain).hostname : urlOrDomain;
    const domain = rootDomain(host);
    if (!domain || NON_OFFICIAL.has(domain) || GENERIC_ACADEMIC.has(domain)) return;
    values.set(domain, (values.get(domain) ?? 0) + weight);
  } catch { /* Ignore malformed candidates. */ }
}

function chooseDomain(values: Map<string, number>, universityName: string) {
  const tokens = new Set(slug(universityName).split("-").filter((token) => token.length >= 3 && !["university", "universidad", "universite", "universita", "universiti", "universitas"].includes(token)));
  return [...values.entries()]
    .map(([domain, weight]) => ({ domain, score: weight * 20 + [...tokens].filter((token) => domain.includes(token)).length * 8 + (/\.(?:edu|ac)\./.test(domain) || /\.(?:edu|ac)$/.test(domain) ? 5 : 0) }))
    .sort((a, b) => b.score - a.score || a.domain.length - b.domain.length)[0]?.domain ?? null;
}

function rootDomain(hostValue: string) {
  const host = hostValue.toLowerCase().replace(/^www\./, "");
  const labels = host.split(".");
  const second = labels.at(-2) ?? "";
  const tld = labels.at(-1) ?? "";
  if (tld.length === 2 && /^(?:ac|edu|com|org|gov|net)$/.test(second) && labels.length >= 3) return labels.slice(-3).join(".");
  return labels.slice(-2).join(".");
}

function slug(value: string) { return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/^the-/, "").replace(/-formerly.*$/, "").slice(0, 120); }
async function assertJson(response: Response) { if (!response.ok) throw new Error(`Public index HTTP ${response.status}`); return response.json(); }
async function json(file: string): Promise<Json> { return JSON.parse(await readFile(file, "utf8")); }
async function existing(): Promise<Json> { try { return await json(OUTPUT); } catch { return { rows: [] }; } }
async function persist(rows: Json[]) { await writeFile(OUTPUT, `${JSON.stringify({ schemaVersion: "uapt-ai-tools-domain-seeds-v1", runId: "uapt-ai-tools-qs-701-857-20260719-012", generatedAt: new Date().toISOString(), scope: { rows: [ROW_START, ROW_END], count: 157 }, rows: rows.sort((a, b) => a.qsRow - b.qsRow) }, null, 2)}\n`); }
async function firecrawlKey() { const config = await readFile("/Users/newvolume/.codex/config.toml", "utf8"); const key = config.match(/^\s*FIRECRAWL_API_KEY\s*=\s*["']?([^\s"']+)/m)?.[1]; if (!key) throw new Error("FIRECRAWL_API_KEY unavailable"); return key; }
async function pool<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) { const output: R[] = []; let next = 0; await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => { while (next < items.length) { const index = next++; output[index] = await task(items[index]); } })); return output; }

void main().catch((error) => { console.error(error); process.exitCode = 1; });
