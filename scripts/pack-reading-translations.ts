import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { READING_LOCALES, type ReadingLocale } from "../apps/web/lib/language-catalog";
import { validateReadingTranslationBundle, type ReadingTranslationBundle, type ReadingTranslationSelection } from "../apps/web/lib/reading-translations";

interface SourceUse { slug: string; source?: string; sourceSha256?: string; substitutions?: Record<string, string> }
interface Source {
  schemaVersion: string;
  schools: { slug: string; recordSha256: string; originalEvidenceSha256: string }[];
  units: Record<string, { source: string; sourceSha256: string; uses: SourceUse[] }>;
}
interface Delivery {
  schemaVersion: "uapt-reviewed-translation-delivery-v1";
  sourceSha256: string;
  locales: Partial<Record<ReadingLocale, {
    status: "accepted";
    receipt: { path: string; sha256: string };
    strings: Record<string, string>;
  }>>;
}
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

/** Packages reviewed delivery only. No generator access, source edits or publication. */
export async function packReadingTranslations(sourcePath: string, sourceSha256: string, deliveryPath: string, output: string) {
  const raw = await readFile(sourcePath);
  if (digest(raw) !== sourceSha256) throw Error("Frozen translation source changed");
  const source = JSON.parse(raw.toString("utf8")) as Source;
  const delivery = JSON.parse(await readFile(deliveryPath, "utf8")) as Delivery;
  if (source.schemaVersion !== "uapt-multilingual-source-v1" || !source.schools?.length || !source.units || new Set(source.schools.map(s => s.slug)).size !== source.schools.length) throw Error("Invalid source inventory");
  if (delivery.schemaVersion !== "uapt-reviewed-translation-delivery-v1" || delivery.sourceSha256 !== sourceSha256) throw Error("Reviewed delivery basis mismatch");
  const locales = READING_LOCALES.filter(locale => locale !== "en");
  const requiredIds = Object.keys(source.units);
  for (const id of requiredIds) if (source.units[id].sourceSha256 !== id || digest(source.units[id].source) !== id) throw Error("Source unit identity changed");
  for (const locale of locales) {
    const accepted = delivery.locales[locale];
    if (accepted?.status !== "accepted" || !/^[a-f0-9]{64}$/.test(accepted.receipt?.sha256)) throw Error("Missing accepted delivery: " + locale);
    const missing = requiredIds.filter(id => typeof accepted.strings[id] !== "string" || !accepted.strings[id].trim());
    if (missing.length || Object.keys(accepted.strings).some(id => !Object.hasOwn(source.units, id))) throw Error(`Incomplete/unknown translated strings: ${locale}; missing=${missing.length}`);
    const root = await realpath(path.dirname(deliveryPath));
    const receiptPath = accepted.receipt.path;
    if (typeof receiptPath !== "string" || path.isAbsolute(receiptPath) || receiptPath.split(/[\\/]/).includes("..")) throw Error("Invalid review receipt reference");
    const target = await realpath(path.join(root, receiptPath));
    if (!target.startsWith(root + path.sep)) throw Error("Review receipt escaped delivery");
    const raw = await readFile(target);
    if (raw.length > 4 * 1024 * 1024 || digest(raw) !== accepted.receipt.sha256) throw Error("Review receipt bytes changed");
    const receipt = JSON.parse(raw.toString("utf8"));
    if (receipt.schemaVersion !== "uapt-translation-review-receipt-v1" || receipt.status !== "accepted" || receipt.sourceSha256 !== sourceSha256 || receipt.locale !== locale || receipt.translationsSha256 !== digest(JSON.stringify(accepted.strings)) || !Array.isArray(receipt.checkedSourceHashes) || [...receipt.checkedSourceHashes].sort().join() !== [...requiredIds].sort().join() || !Array.isArray(receipt.remainingSourceHashes) || receipt.remainingSourceHashes.length) throw Error("Review does not accept the complete delivered locale: " + locale);
  }
  // Check every locale and source before creating the candidate directory.
  const selection: ReadingTranslationSelection = { schemaVersion: "uapt-reading-selection-v1", revision: "reading-" + digest(await readFile(deliveryPath)).slice(0, 20), sourceSha256, publicationApproved: false, candidateOnly: true, shared: {}, schools: {} };
  function* preparedBundles() {
    for (const locale of locales) {
      const accepted = delivery.locales[locale]!;
      const bySlug = new Map<string, ReadingTranslationBundle>();
      for (const school of [{ slug: "_shared", recordSha256: sourceSha256, originalEvidenceSha256: sourceSha256 }, ...source.schools]) bySlug.set(school.slug, { schemaVersion: "uapt-reading-translations-v1", sourceSha256, locale, ...school, review: { status: "accepted", receiptSha256: accepted.receipt.sha256 }, requiredSourceHashes: [], strings: {} });
      for (const [id, unit] of Object.entries(source.units)) for (const use of unit.uses) {
        const bundle = bySlug.get(use.slug);
        if (!bundle) throw Error("Translation points outside source school set");
        const original = use.source ?? unit.source;
        const sourceId = digest(original);
        if (use.sourceSha256 && use.sourceSha256 !== sourceId) throw Error("Display source substitution changed");
        const substitute = (text: string) => text.replace(/\{([^{}]+)\}/g, (token, key: string) => use.substitutions?.[key] ?? token);
        if (use.source && substitute(unit.source) !== original) throw Error("Source template no longer reproduces its display");
        const translated = substitute(accepted.strings[id]);
        const existing = bundle.strings[sourceId];
        if (existing && existing.translation !== translated) throw Error("Conflicting exact-source translation");
        bundle.strings[sourceId] = { source: original, sourceSha256: sourceId, translation: translated };
      }
      for (const [slug, bundle] of bySlug) {
        bundle.requiredSourceHashes = Object.keys(bundle.strings).sort();
        validateReadingTranslationBundle(bundle, { sourceSha256, locale, slug });
        const filename = `${locale}/${slug}.json`;
        yield { filename, value: bundle };
      }
    }
  }
  let bundleCount = 0;
  for (const { filename, value: bundle } of preparedBundles()) {
      const { slug, locale } = bundle;
      const text = JSON.stringify(bundle) + "\n", ref = { path: filename, sha256: digest(text) };
      if (slug === "_shared") selection.shared[locale] = ref;
      else (selection.schools[slug] ??= {})[locale] = ref;
      bundleCount++;
  }
  await mkdir(output, { recursive: false });
  for (const locale of locales) await mkdir(path.join(output, locale));
  for (const bundle of preparedBundles()) await writeFile(path.join(output, bundle.filename), JSON.stringify(bundle.value) + "\n", { flag: "wx" });
  const manifest = JSON.stringify(selection, null, 2) + "\n";
  await writeFile(path.join(output, "selection.json"), manifest, { flag: "wx" });
  await writeFile(path.join(output, "candidate.json"), JSON.stringify({ path: "selection.json", sha256: digest(manifest) }, null, 2) + "\n", { flag: "wx" });
  return { revision: selection.revision, schools: source.schools.length, readingLocales: locales.length + 1, translatedLocales: locales.length, bundles: bundleCount, publicationApproved: false };
}
if (process.argv[1]?.endsWith("pack-reading-translations.ts")) {
  const args = process.argv.slice(2);
  if (args.length !== 4) { console.error("Usage: tsx scripts/pack-reading-translations.ts <frozen-source.json> <source-sha256> <reviewed-delivery.json> <new-output-directory>"); process.exitCode = 1; }
  else packReadingTranslations(args[0], args[1], args[2], args[3]).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error instanceof Error ? error.message : "Packaging failed"); process.exitCode = 1; });
}
