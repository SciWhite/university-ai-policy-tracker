import { readFile, writeFile } from "node:fs/promises";

type Json = Record<string, any>;

const INPUT = "staging/ai-tools/audits/qs-701-857-discovery-20260719-012.json";
const OUTPUT = "staging/ai-tools/audits/qs-701-857-semantic-candidates-20260719-012.json";
const STRONG_ACCESS = /(?:available to|access(?:ible)? (?:to|for)|provided to|offered to|licensed? (?:for|to|by)|enterprise (?:agreement|licen[cs]e|subscription)|campus licen[cs]e|university licen[cs]e|institutional (?:account|licen[cs]e|subscription)|university account|campus account|sign in with|log in with|included (?:in|with)|all (?:students|employees|users|members)|no (?:additional )?cost|free (?:access|to|for)|university-provided|campus-supported|self-hosted|university-operated|request access|purchase approval|purchase through|licencia institucional|licen[çc]a institucional|licence institutionnelle|licenza di ateneo|universit[aà] account|cuenta institucional|compte universitaire|conta institucional|universit[aä]tskonto|大学アカウント|大学账号|大學帳戶|校园账号|学校アカウント|라이선스|대학 계정|授[权權]|采购|利用できます|利用可能|使用できます|ترخيص|حساب الجامعة|доступ|лицензия|университетский аккаунт)/iu;
const WEAK_CONTEXT = /(?:course|assignment|syllabus|workshop|webinar|research study|survey|conference|journal|publication|bibliography|citation|student project|degree programme)/iu;

async function main() {
  const document = JSON.parse(await readFile(INPUT, "utf8"));
  const candidates: Json[] = [];
  for (const row of document.rows as Json[]) {
    const seen = new Set<string>();
    for (const page of row.pages ?? []) {
      if (page.fetchStatus !== "ok" || !(page.semanticSignals?.productTerms?.length) || !(page.semanticSignals?.accessTerms?.length)) continue;
      const key = canonical(page.finalUrl);
      if (seen.has(key)) continue;
      seen.add(key);
      const windows = (page.evidenceWindows ?? []).map(normalize).filter(Boolean);
      const strongWindows = windows.filter((window: string) => STRONG_ACCESS.test(window));
      const productMappings = mapProducts(page.semanticSignals.productTerms);
      const weakOnly = strongWindows.length > 0 && strongWindows.every((window: string) => WEAK_CONTEXT.test(window) && !/(?:licensed|available to|provided to|university account|institutional account|sign in with|free access)/iu.test(window));
      candidates.push({
        qsRow: row.qsRow,
        qsRank: row.qsRank,
        universityName: row.universityName,
        canonicalSlug: row.canonicalSlug,
        countryOrRegion: row.countryOrRegion,
        localLanguage: row.localLanguage,
        officialDomain: row.officialDomain,
        sourceUrl: page.finalUrl,
        sourceTitle: page.title,
        sourceLanguage: normalizeLanguage(page.language, row.localLanguage),
        provider: page.provider,
        fetchedAt: page.fetchedAt,
        snapshotPath: page.snapshotPath,
        snapshotHash: page.snapshotHash,
        productSignals: page.semanticSignals.productTerms,
        accessSignals: page.semanticSignals.accessTerms,
        productMappings,
        strongWindowCount: strongWindows.length,
        heuristicTier: productMappings.length && strongWindows.length && !weakOnly ? "strong_candidate" : "manual_boundary_review",
        evidenceWindows: windows.slice(0, 24),
        strongestWindows: strongWindows.slice(0, 12),
        semanticDecision: null,
        rationale: null,
        recordDrafts: []
      });
    }
  }
  const output = {
    schemaVersion: "uapt-ai-tools-semantic-candidates-v1",
    runId: "uapt-ai-tools-qs-701-857-20260719-012",
    generatedAt: new Date().toISOString(),
    policy: "Heuristics prioritize review only. No candidate becomes a record without an explicit source-level semantic decision and a continuous official-source evidence quote.",
    summary: {
      reviewedSurfacesRequired: candidates.length,
      strongCandidates: candidates.filter((item) => item.heuristicTier === "strong_candidate").length,
      boundaryCandidates: candidates.filter((item) => item.heuristicTier === "manual_boundary_review").length,
      universities: new Set(candidates.map((item) => item.canonicalSlug)).size
    },
    candidates
  };
  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output.summary, null, 2));
}

function mapProducts(values: string[]) {
  const output = new Map<string, string>();
  for (const value of values) {
    const normalized = value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
    if (/chatgpt/.test(normalized)) output.set("chatgpt", value);
    else if (/github\s+copilot/.test(normalized)) output.set("github_copilot", value);
    else if (/microsoft\s+365\s+copilot/.test(normalized)) output.set("microsoft_copilot_for_m365", value);
    else if (/copilot/.test(normalized)) output.set("microsoft_copilot", value);
    else if (/notebook\s*lm/.test(normalized)) output.set("notebooklm", value);
    else if (/gemini/.test(normalized)) output.set("gemini", value);
    else if (/claude/.test(normalized)) output.set("claude", value);
    else if (/perplexity/.test(normalized)) output.set("perplexity", value);
    else if (/firefly/.test(normalized)) output.set("adobe_firefly", value);
    else if (/adobe express/.test(normalized)) output.set("adobe_express", value);
    else if (/zoom/.test(normalized)) output.set("zoom_ai_companion", value);
    else if (/scopus/.test(normalized)) output.set("scopus_ai", value);
    else if (/web of science/.test(normalized)) output.set("web_of_science_research_assistant", value);
    else if (/cursor/.test(normalized)) output.set("cursor_ai", value);
    else if (/grammarly/.test(normalized)) output.set("grammarly", value);
  }
  return [...output.entries()].map(([tool, rawToolName]) => ({ tool, rawToolName }));
}

function canonical(value: string) { try { const url = new URL(value); url.hash = ""; return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${url.search}`; } catch { return value; } }
function normalize(value: unknown) { return String(value ?? "").normalize("NFKC").replace(/[*_#`|]/g, " ").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/[\u00a0\s]+/g, " ").trim(); }
function normalizeLanguage(value: unknown, fallback: string) { const code = String(value ?? "").toLowerCase().split("-")[0]; return /^[a-z]{2,3}$/.test(code) ? code : fallback; }

void main().catch((error) => { console.error(error); process.exitCode = 1; });
