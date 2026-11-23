/**
 * Which languages every school page is indexed in under a content release, and what a candidate
 * would lose against its parent. Uses the page's own decision (universityReadingIndexLocales), so
 * robots, hreflang and the sitemap agree with it.
 *
 *   UAPT_V6_PUBLISHED_PAGES=1 UAPT_CONTENT_ROOT=<runtime root> [UAPT_CONTENT_ALLOW_UNSYNCHRONIZED=1] \
 *     pnpm content:index-locales --out <file> [--against <parent file>] [--accept-loss <json>]
 *
 * Exit 1 when a school loses a language it had in --against, unless --accept-loss lists it
 * ({"<slug>": {"<locale>": "reason"}}). 2026-11-23: each base -> full V6 upgrade silently dropped
 * /zh/ from the index, and update-mode batch 7 dropped five schools; no step compared the two.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export type IndexLocales = Record<string, { tier: string; locales: string[] }>;

/** Languages indexed in `parent` and not in `candidate`, per school (a removed school loses all). */
export function lostIndexLocales(parent: IndexLocales, candidate: IndexLocales, accepted: Record<string, Record<string, string>> = {}): Record<string, string[]> {
  const lost: Record<string, string[]> = {};
  for (const [slug, before] of Object.entries(parent)) {
    const missing = before.locales.filter(locale => !candidate[slug]?.locales.includes(locale) && !accepted[slug]?.[locale]?.trim());
    if (missing.length) lost[slug] = missing;
  }
  return lost;
}

export async function readIndexLocales(): Promise<IndexLocales> {
  const [{ getCatalogUniversities, getPublicUniversitySummaryBySlug }, { universityReadingBasis }, { universityReadingIndexLocales }, { policyV6Tier }] = await Promise.all([
    import("../../apps/web/lib/catalog"), import("../../apps/web/lib/university-reading-basis"),
    import("../../apps/web/lib/university-reading-metadata"), import("../../apps/web/lib/policy-v6-tier")
  ]);
  const out: IndexLocales = {};
  for (const school of await getCatalogUniversities()) {
    const summary = await getPublicUniversitySummaryBySlug(school.slug);
    if (!summary) continue;
    const basis = universityReadingBasis(school.slug, summary) ?? { recordSha256: "", originalEvidenceSha256: "" };
    out[school.slug] = { tier: policyV6Tier(school.slug), locales: await universityReadingIndexLocales(school.slug, basis, summary) };
  }
  return out;
}

async function main() {
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
  const out = arg("--out"), against = arg("--against"), accept = arg("--accept-loss");
  // Each of these once let the check pass on the wrong data.
  if (!out || out.startsWith("--")) throw new Error("Pass --out <file>");
  for (const name of ["--against", "--accept-loss"]) if (process.argv.includes(name) && (!arg(name) || arg(name)!.startsWith("--"))) throw new Error(`${name} needs a file`);
  if (!process.env.UAPT_CONTENT_ROOT?.trim()) throw new Error("Set UAPT_CONTENT_ROOT to the release's runtime root (workspace data is not a release)");
  if (process.env.UAPT_V6_PUBLISHED_PAGES !== "1") throw new Error("Set UAPT_V6_PUBLISHED_PAGES=1; without it no V6 school is measured as indexed in zh");
  const current = await readIndexLocales();
  writeFileSync(out, JSON.stringify(current, null, 1) + "\n");
  const rows = Object.values(current), full = rows.filter(row => row.tier === "full");
  const lost = against ? lostIndexLocales(JSON.parse(readFileSync(against, "utf8")), current, accept ? JSON.parse(readFileSync(accept, "utf8")) : {}) : {};
  console.log(JSON.stringify({
    schools: rows.length, full: full.length, fullInChinese: full.filter(row => row.locales.includes("zh")).length,
    fullNotInChinese: Object.entries(current).filter(([, row]) => row.tier === "full" && !row.locales.includes("zh")).map(([slug]) => slug),
    otherLanguagePages: rows.reduce((n, row) => n + row.locales.filter(locale => locale !== "en" && locale !== "zh").length, 0),
    ...(against ? { lost } : {})
  }, null, 1));
  if (Object.keys(lost).length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error); process.exit(1); });
