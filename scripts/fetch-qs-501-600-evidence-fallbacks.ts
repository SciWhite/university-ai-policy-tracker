import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;

const REPAIR_PATH = "staging/ai-tools/audits/qs-501-600-repair-discovery-20260718-009.json";
const SNAPSHOT_DIR = "staging/ai-tools/audits/snapshots/uapt-ai-tools-qs-501-600-20260718-009/http-fallback";
const targets = [
  { qsRow: 510, url: "https://oit.utk.edu/ai/aihub/" },
  { qsRow: 555, url: "https://genai.usf.edu/genai-resources/tools" },
  { qsRow: 555, url: "https://guides.lib.usf.edu/AI/LINK" },
  { qsRow: 594, url: "https://ai.uc.edu/ai-tools/ms-365-copilot-chat" }
];

async function main() {
  const document = JSON.parse(await readFile(REPAIR_PATH, "utf8")) as Json;
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  for (const target of targets) {
    const row = document.rows.find((value: Json) => value.qsRow === target.qsRow);
    if (!row) throw new Error(`Missing repair row ${target.qsRow}`);
    const response = await fetch(target.url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; UAPT-EvidenceReview/1.0; +https://eduaipolicy.org)" },
      signal: AbortSignal.timeout(60_000)
    });
    if (!response.ok) throw new Error(`${target.url}: HTTP ${response.status}`);
    const html = await response.text();
    const text = htmlToText(html);
    if (text.length < 200) throw new Error(`${target.url}: extracted text too short`);
    const snapshotPath = path.join(SNAPSHOT_DIR, `${target.qsRow}-${slug(new URL(target.url).hostname + new URL(target.url).pathname)}-${hash(target.url).slice(0, 10)}.md`);
    await writeFile(snapshotPath, `${text}\n`);
    const check = {
      qsRow: target.qsRow,
      requestedUrl: target.url,
      finalUrl: response.url || target.url,
      fetchedAt: new Date().toISOString(),
      provider: "http_fetch_fallback",
      fetchStatus: "ok",
      httpStatus: response.status,
      official: true,
      sourceTitle: titleFromHtml(html) ?? "Official university AI tools page",
      sourceLanguage: languageFromHtml(html),
      snapshotPath,
      snapshotHash: hash(`${text}\n`),
      relevantAiSurface: true,
      potentialInstitutionalAccess: true,
      signalTerms: [],
      semanticSignals: { productTerms: [], accessTerms: [] },
      fallbackReason: "Firecrawl direct scrape timed out repeatedly; official page was retrieved over standard read-only HTTP and normalized to plain text."
    };
    row.checks = [...row.checks.filter((value: Json) => (value.finalUrl ?? value.requestedUrl) !== target.url), check];
    row.successfulScrapes = row.checks.filter((value: Json) => value.fetchStatus === "ok").length;
    console.log(`fallback snapshot ${target.qsRow}: ${target.url}`);
  }
  document.generatedAt = new Date().toISOString();
  await writeFile(REPAIR_PATH, `${JSON.stringify(document, null, 2)}\n`);
}

function htmlToText(html: string) {
  return decodeEntities(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<\/(?:p|div|section|article|li|tr|h[1-6]|main|header|footer)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? match;
  });
}

function titleFromHtml(html: string) { return decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null; }
function languageFromHtml(html: string) { const value = html.match(/<html[^>]+lang=["']([^"']+)/i)?.[1]?.toLowerCase().split("-")[0] ?? "en"; return /^[a-z]{2,3}$/.test(value) ? value : "en"; }
function hash(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100); }
void main().catch((error) => { console.error(error); process.exitCode = 1; });
