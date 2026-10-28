import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { getEntityAliasResolver } from "../apps/web/lib/entity-aliases";
import { parseBingAiPagesCsv } from "../apps/web/lib/bing-ai-performance";
import { matchReadingLocale, type ReadingLocale } from "../apps/web/lib/language-catalog";
import type { UniversityLocaleIndexPolicy } from "../apps/web/lib/university-locale-index-policy";

type SourceSchool = { slug: string; recordSha256: string; languageEvidence: Array<{ language?: string; url: string; sourceSnapshotHash?: string }> };
type ExtraEvidence = { slug: string; locale: ReadingLocale; kind: "verified_institution_language" | "user_instruction"; url?: string };
const sha = (raw: string) => createHash("sha256").update(raw).digest("hex");

async function main() {
  const argument = (name: string) => {
    const index = process.argv.indexOf(name);
    if (index < 0 || !process.argv[index + 1]) throw Error(`Missing ${name}`);
    return process.argv[index + 1];
  };
  const sourceRaw = await readFile(argument("--source"), "utf8");
  const source = JSON.parse(sourceRaw) as { schools: SourceSchool[] };
  const csv = await readFile(argument("--bing-pages"), "utf8");
  const extras = JSON.parse(await readFile(argument("--verified-extras"), "utf8")) as ExtraEvidence[];
  const aliases = (await getEntityAliasResolver()).slugAliases;
  const policy: UniversityLocaleIndexPolicy = { schemaVersion: "uapt-university-locale-index-policy-v1", sourceSha256: sha(sourceRaw), schools: {}, globalCitationExceptions: {} };
  for (const school of source.schools) {
    if (policy.schools[school.slug]) throw Error("Duplicate school identity");
    const evidence: UniversityLocaleIndexPolicy["schools"][string]["evidence"] = [];
    for (const item of school.languageEvidence) {
      const locale = matchReadingLocale(item.language);
      if (locale && locale !== "en") evidence.push({ locale, kind: "published_source_language", url: item.url, sourceSnapshotHash: item.sourceSnapshotHash });
    }
    policy.schools[school.slug] = { recordSha256: school.recordSha256, locales: ["en", ...new Set(evidence.map(item => item.locale))], evidence };
  }
  for (const extra of extras) {
    const school = policy.schools[extra.slug];
    if (!school || matchReadingLocale(extra.locale) !== extra.locale) throw Error("Unbound verified school language: " + extra.slug);
    if (!school.locales.includes(extra.locale)) school.locales.push(extra.locale);
    school.evidence.push({ locale: extra.locale, kind: extra.kind, ...(extra.url ? { url: extra.url } : {}) });
  }
  const citedRoutes: Array<{ observedUrl: string; canonicalPath: string; locale: ReadingLocale; canonicalVariant: boolean }> = [];
  const unresolvedCitations: Array<{ observedUrl: string; reason: string }> = [];
  for (const row of parseBingAiPagesCsv(csv)) {
    const url = new URL(row.key);
    if (!["eduaipolicy.org", "www.eduaipolicy.org"].includes(url.hostname)) throw Error("Unexpected host in owned citation export");
    const parts = url.pathname.split("/").filter(Boolean);
    const locale = matchReadingLocale(parts[0]);
    if (!locale || locale === "en") continue;
    const unprefixed = "/" + parts.slice(1).join("/");
    const university = /^\/universities\/([a-z0-9-]+)$/.exec(unprefixed);
    let canonicalPath = unprefixed;
    if (university) {
      const slug = aliases.get(university[1]) ?? university[1];
      const school = policy.schools[slug];
      if (!school) { unresolvedCitations.push({ observedUrl: row.key, reason: "No canonical public-catalog identity; verify existing response and migration before cutover" }); continue; }
      canonicalPath = `/universities/${slug}`;
      if (!school.locales.includes(locale)) school.locales.push(locale);
      if (!school.evidence.some(item => item.kind === "retained_citation" && item.locale === locale)) school.evidence.push({ locale, kind: "retained_citation" });
    } else {
      policy.globalCitationExceptions[unprefixed] ??= [];
      if (!policy.globalCitationExceptions[unprefixed].includes(locale)) policy.globalCitationExceptions[unprefixed].push(locale);
    }
    // A host/alias variant needs response verification; its existence alone
    // does not establish that the live server redirects or needs a new rule.
    citedRoutes.push({ observedUrl: row.key, canonicalPath, locale, canonicalVariant: url.hostname === "www.eduaipolicy.org" || unprefixed !== canonicalPath });
  }
  for (const school of Object.values(policy.schools)) school.locales.sort((a, b) => a === "en" ? -1 : b === "en" ? 1 : a.localeCompare(b));
  await writeFile(argument("--output"), JSON.stringify(policy, null, 2) + "\n", { flag: "wx" });
  const report = { checkedAt: new Date().toISOString(), sourceSha256: policy.sourceSha256, bingPageExportSha256: sha(csv), schoolCount: source.schools.length, potentialSchoolIndexUrlsBeforeTranslationGate: Object.values(policy.schools).reduce((n, school) => n + school.locales.length, 0), citedRoutes, unresolvedCitations, translationComplete: false, publicationApproved: false };
  await writeFile(argument("--report"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ schools: report.schoolCount, potentialSchoolIndexUrlsBeforeTranslationGate: report.potentialSchoolIndexUrlsBeforeTranslationGate, retainedCitedRows: citedRoutes.length, unresolvedCitations: unresolvedCitations.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
