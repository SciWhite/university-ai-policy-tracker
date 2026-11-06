/**
 * Reading-translation record deltas for `content:correct translations ...`
 * (docs/content-release.md §12.4). Translations bind per source string: a
 * corrected school keeps its accepted bundles byte for byte, and a record
 * delta adds only the strings (and new display-field uses) the new record
 * needs, under an independent review receipt that the loader machine-checks
 * (`checkReadingTranslationDelta` in apps/web/lib/reading-translations.ts).
 *
 *   plan     --candidate <finalize dir> --out <plan.json> [--package <dir> --pointer <file>]
 *            Uses the production display inventory on the candidate tree; lists
 *            per locale the strings to translate, reusable accepted pairs and
 *            new field uses of unchanged strings.
 *   template --plan <plan.json> --translations <dir of <locale>.json> --translator <id> --out <review.json>
 *            Review receipt with every delta pair (verdict "pending").
 *   build    --plan <plan.json> --translations <dir> --review <review.json> --out <NEW package dir>
 *            New package: the old files hard-linked, delta bundles, the receipt
 *            and a selection with one more `supplemental.recordDeltas` entry.
 *            Verified with the production loader before it is reported.
 */
import { createHash } from "node:crypto";
import { constants, copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPublicUniversitySummaryBySlug } from "../../apps/web/lib/catalog";
import { universityReadingBasis } from "../../apps/web/lib/university-reading-basis";
import { policySceneDisplaySources, v6DisplayRequirements } from "../../apps/web/lib/university-reading-metadata";
import { getUniversityToolRecords } from "../../apps/web/lib/tool-records";
import { selectContentForTools, type ContentReleaseManifest } from "../../apps/web/lib/content-runtime";
import {
  checkReadingTranslationDelta, getReadingTranslations, recordDeltaChain,
  type ReadingDeltaReviewPair, type ReadingDeltaReviewReceipt, type ReadingRecordBasis, type ReadingRecordDelta,
  type ReadingTranslation, type ReadingTranslationBundle, type ReadingTranslationDelta, type ReadingTranslationSelection
} from "../../apps/web/lib/reading-translations";
import type { ReadingLocale } from "../../apps/web/lib/language-catalog";
import { readManifest, releaseDir } from "./lib";
import { MergedTree, newDir } from "./correct";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const fail = (message: string): never => { throw new Error(message); };

interface PackageRef { dir: string; pointer: string }
function openPackage(ref: PackageRef) {
  const pointerFile = path.join(ref.dir, ref.pointer);
  const pointer = readJson(pointerFile) as { path: string; sha256: string };
  const bytes = readFileSync(path.join(ref.dir, pointer.path));
  if (sha(bytes) !== pointer.sha256) fail("Translation selection does not match its pointer");
  const selection = JSON.parse(bytes.toString("utf8")) as ReadingTranslationSelection;
  const file = <T>(item: { path: string; sha256: string }): T => { const raw = readFileSync(path.join(ref.dir, item.path)); if (sha(raw) !== item.sha256) fail(`Translation artifact changed: ${item.path}`); return JSON.parse(raw.toString("utf8")) as T; };
  return { selection, selectionSha256: pointer.sha256, file };
}

/** Strings and fields accepted for one school/locale: its bundle plus the record deltas that chain from it. */
function acceptedStrings(pkg: ReturnType<typeof openPackage>, slug: string, locale: ReadingLocale) {
  const base = pkg.file<ReadingTranslationBundle>(pkg.selection.schools[slug][locale]!);
  const strings: Record<string, ReadingTranslation> = { ...base.strings };
  const uses: Record<string, string[]> = Object.fromEntries(Object.entries(base.sourceFieldUses ?? {}).map(([k, v]) => [k, [...v]]));
  const { chain, basis } = recordDeltaChain(pkg.selection, slug, { recordSha256: base.recordSha256, originalEvidenceSha256: base.originalEvidenceSha256 });
  for (const { entry } of chain) {
    const ref = entry.locales[locale];
    if (!ref) return { strings, uses, basis: undefined };
    const delta = pkg.file<ReadingTranslationDelta>(ref);
    Object.assign(strings, delta.strings);
    for (const [k, v] of Object.entries(delta.sourceFieldUses)) uses[k] = [...new Set([...(uses[k] ?? []), ...v])];
  }
  return { strings, uses, basis: basis as ReadingRecordBasis | undefined, protectedClaimIds: base.protectedClaimIds };
}

/** Display strings a school's pages need, with the fields that show them (production inventory). */
async function requiredStrings(slug: string) {
  const summary = await getPublicUniversitySummaryBySlug(slug) ?? fail(`No public summary for ${slug}`);
  const basis = universityReadingBasis(slug, summary) ?? fail(`No reading basis for ${slug}`);
  const inventory = await v6DisplayRequirements(slug, summary);
  const strings = new Map<string, { source: string; fields: Set<string> }>();
  const add = (source: string | undefined, field: string) => {
    if (!source?.trim() || /^https?:\/\//.test(source)) return;
    const key = sha(source);
    const row = strings.get(key) ?? { source, fields: new Set<string>() };
    row.fields.add(field); strings.set(key, row);
  };
  for (const requirement of [...policySceneDisplaySources(slug, summary), ...inventory.requirements]) {
    add(requirement.source, requirement.field);
    for (const alias of requirement.fieldAliases ?? []) add(requirement.source, alias);
  }
  add(summary.summary, "/public/summary");
  for (const claim of summary.claims) add(claim.claimText, `/public/claims/${claim.id}/claimText`);
  (await getUniversityToolRecords(slug)).forEach((tool, i) => { for (const key of ["description", "howToObtain", "costToUser"] as const) add(tool[key] as string | undefined, `/tools/${i}/${key}`); });
  return { basis, strings, claimIds: summary.claims.map(claim => claim.id!).filter(Boolean), sourceScopeComplete: inventory.sourceScopeComplete };
}

export async function planRecordDeltas(options: { finalized: string; out: string; packageDir?: string; pointer?: string }) {
  const finalized = path.resolve(options.finalized);
  const report = readJson(path.join(finalized, "finalize-report.json"));
  const source = report.source as { root: string; contentRoot?: string; contentId?: string };
  let ref: PackageRef;
  if (options.packageDir) ref = { dir: path.resolve(options.packageDir), pointer: options.pointer ?? "current.json" };
  else if (source.contentRoot && source.contentId) {
    const { manifest } = readManifest(source.contentRoot, source.contentId);
    if (!manifest.translations) fail("The source release carries no translation package; pass --package");
    const pointerFile = path.join(releaseDir(source.contentRoot, source.contentId), "tree", manifest.translations!.pointer);
    ref = { dir: path.dirname(pointerFile), pointer: path.basename(pointerFile) };
  } else return fail("Pass --package <reading package dir> (no content release source)");
  const pkg = openPackage(ref);
  const slugs = Object.keys(readJson(path.join(finalized, "claim-decisions.json")).schools);
  const tree = MergedTree.create(source.root, path.join(finalized, `.plan-tree-${process.pid}`), path.join(finalized, "overlay"));
  try {
    tree.select();
    // Accepted translations of each locale, by source hash, from every bundle of the package.
    const pools = new Map<string, Map<string, string>>();
    const pool = (locale: ReadingLocale) => {
      if (!pools.has(locale)) {
        const map = new Map<string, string>();
        for (const refs of [pkg.selection.shared, ...Object.values(pkg.selection.schools)]) {
          const item = refs[locale]; if (!item) continue;
          for (const [k, unit] of Object.entries(pkg.file<ReadingTranslationBundle>(item).strings)) if (!map.has(k)) map.set(k, unit.translation);
        }
        pools.set(locale, map);
      }
      return pools.get(locale)!;
    };
    const plan: Json = { schemaVersion: "uapt-reading-record-delta-plan-v1", revision: `${report.revision}-reading`, correctionRevision: report.revision,
      package: { dir: ref.dir, pointer: ref.pointer, selectionSha256: pkg.selectionSha256, corpusSourceSha256: pkg.selection.sourceSha256, parentSelectionRevision: pkg.selection.revision },
      schools: {}, requests: {} as Record<string, Record<string, string>> };
    for (const slug of slugs) {
      const locales = Object.keys(pkg.selection.schools[slug] ?? {}).filter(locale => locale !== "en") as ReadingLocale[];
      if (!locales.length) continue;
      const need = await requiredStrings(slug);
      const school: Json = { record: need.basis, parent: undefined, protectedClaimIds: need.claimIds, sourceScopeComplete: need.sourceScopeComplete,
        strings: Object.fromEntries([...need.strings].map(([k, v]) => [k, { source: v.source, fields: [...v.fields].sort() }])), locales: {} };
      for (const locale of locales) {
        const accepted = acceptedStrings(pkg, slug, locale);
        const start = accepted.basis ?? fail(`${slug}/${locale}: an earlier record delta does not cover this locale; repack the school first`);
        if (start.recordSha256 === need.basis.recordSha256 && start.originalEvidenceSha256 === need.basis.originalEvidenceSha256) continue;
        if (school.parent && (school.parent.recordSha256 !== start.recordSha256 || school.parent.originalEvidenceSha256 !== start.originalEvidenceSha256)) fail(`${slug}: locales start from different record bases; repack the school first`);
        school.parent = start;
        const row: Json = { missing: [], reused: {}, fieldUseAdditions: {} };
        for (const [key, { fields }] of need.strings) {
          if (accepted.strings[key]) {
            const added = [...fields].filter(field => !(accepted.uses[key] ?? []).includes(field)).sort();
            if (added.length) row.fieldUseAdditions[key] = added;
          } else if (pool(locale).has(key)) row.reused[key] = pool(locale).get(key);
          else { row.missing.push(key); ((plan.requests[locale] ??= {}) as Record<string, string>)[key] = need.strings.get(key)!.source; }
        }
        school.locales[locale] = row;
      }
      if (Object.keys(school.locales).length) plan.schools[slug] = school;
    }
    plan.totals = {
      schools: Object.keys(plan.schools).length,
      newPairs: Object.values(plan.requests as Record<string, Record<string, string>>).reduce((n, r) => n + Object.keys(r).length, 0),
      reusedPairs: Object.values(plan.schools as Record<string, Json>).reduce((n, s) => n + Object.values(s.locales as Record<string, Json>).reduce((m, l) => m + Object.keys(l.reused).length, 0), 0),
      fieldUseAdditions: Object.values(plan.schools as Record<string, Json>).reduce((n, s) => n + Object.values(s.locales as Record<string, Json>).reduce((m, l) => m + Object.keys(l.fieldUseAdditions).length, 0), 0)
    };
    writeFileSync(options.out, JSON.stringify(plan, null, 1) + "\n", { flag: "wx" });
    return { out: options.out, ...plan.totals, requestFiles: Object.fromEntries(Object.entries(plan.requests as Record<string, Json>).map(([l, r]) => [l, Object.keys(r).length])) };
  } finally { tree.remove(); }
}

/** Every delta item of the plan with its translation and the fields it is shown in. */
function deltaItems(plan: Json, translationsDir: string) {
  const items: { slug: string; locale: ReadingLocale; key: string; source: string; translation?: string; fields: string[]; origin: ReadingDeltaReviewPair["origin"] }[] = [];
  const fresh = new Map<string, Record<string, string>>();
  const translated = (locale: string) => {
    if (!fresh.has(locale)) { const file = path.join(translationsDir, `${locale}.json`); fresh.set(locale, existsSync(file) ? readJson(file) : {}); }
    return fresh.get(locale)!;
  };
  for (const [slug, school] of Object.entries(plan.schools as Record<string, Json>)) for (const [locale, row] of Object.entries(school.locales as Record<string, Json>)) {
    for (const key of row.missing) items.push({ slug, locale: locale as ReadingLocale, key, source: school.strings[key].source, translation: translated(locale)[key] ?? fail(`Missing translation ${locale}/${key}: ${school.strings[key].source.slice(0, 80)}`), fields: school.strings[key].fields, origin: "new_translation" });
    for (const [key, translation] of Object.entries(row.reused as Record<string, string>)) items.push({ slug, locale: locale as ReadingLocale, key, source: school.strings[key].source, translation, fields: school.strings[key].fields, origin: "reused_accepted_translation" });
    for (const [key, fields] of Object.entries(row.fieldUseAdditions as Record<string, string[]>)) items.push({ slug, locale: locale as ReadingLocale, key, source: school.strings[key].source, fields, origin: "field_use_addition" });
  }
  return items;
}

export function reviewTemplate(options: { plan: string; translations: string; translator: string; out: string }) {
  const plan = readJson(options.plan);
  const pkg = openPackage({ dir: plan.package.dir, pointer: plan.package.pointer });
  const pairs = deltaItems(plan, options.translations).map(item => ({
    slug: item.slug, locale: item.locale, sourceSha256: item.key,
    targetSha256: sha(item.translation ?? acceptedStrings(pkg, item.slug, item.locale).strings[item.key].translation),
    fieldUses: item.fields, origin: item.origin, verdict: "pending",
    // For the reviewer only; the receipt binds the hashes.
    source: item.source, translation: item.translation ?? acceptedStrings(pkg, item.slug, item.locale).strings[item.key].translation
  }));
  const template = { schemaVersion: "uapt-reading-delta-review-v1", status: "pending", revision: plan.revision, parentSelectionSha256: plan.package.selectionSha256, corpusSourceSha256: plan.package.corpusSourceSha256,
    translator: { id: options.translator, method: "" }, reviewer: { id: "", method: "" }, reviewedAt: "", coverage: "every_delta_pair", nativeSpeakerApproval: false, publicationApproved: false, pairs };
  writeFileSync(options.out, JSON.stringify(template, null, 1) + "\n", { flag: "wx" });
  return { out: options.out, pairs: pairs.length };
}

function linkTree(from: string, to: string, rel = "") {
  for (const entry of readdirSync(path.join(from, rel), { withFileTypes: true })) {
    const child = path.join(rel, entry.name);
    if (entry.isDirectory()) linkTree(from, to, child);
    else if (entry.isFile()) {
      mkdirSync(path.dirname(path.join(to, child)), { recursive: true });
      try { linkSync(path.join(from, child), path.join(to, child)); } catch { copyFileSync(path.join(from, child), path.join(to, child), constants.COPYFILE_FICLONE); }
    }
  }
}

export async function buildRecordDeltaPackage(options: { plan: string; translations: string; review: string; out: string }) {
  const plan = readJson(options.plan);
  const pkg = openPackage({ dir: plan.package.dir, pointer: plan.package.pointer });
  if (pkg.selectionSha256 !== plan.package.selectionSha256) fail("The translation package changed since the plan");
  const reviewBytes = readFileSync(options.review);
  const review = JSON.parse(reviewBytes.toString("utf8")) as ReadingDeltaReviewReceipt;
  // The receipt in the package carries hashes only; reviewer-facing text stays out.
  const receipt: ReadingDeltaReviewReceipt = { ...review, pairs: review.pairs.map(pair => ({ slug: pair.slug, locale: pair.locale, sourceSha256: pair.sourceSha256, targetSha256: pair.targetSha256, fieldUses: pair.fieldUses, origin: pair.origin, verdict: pair.verdict })) };
  const receiptBytes = Buffer.from(JSON.stringify(receipt, null, 1) + "\n");
  const out = newDir(path.resolve(options.out));
  linkTree(plan.package.dir, out);
  const base = `record-deltas/${plan.revision}`;
  const receiptRef = { path: `${base}/review.json`, sha256: sha(receiptBytes) };
  mkdirSync(path.join(out, base), { recursive: true });
  writeFileSync(path.join(out, receiptRef.path), receiptBytes, { flag: "wx" });
  const items = deltaItems(plan, options.translations);
  const recordDelta: ReadingRecordDelta = { schemaVersion: "uapt-reading-record-delta-v1", revision: plan.revision, parentSelectionSha256: pkg.selectionSha256, receipt: receiptRef, schools: {} };
  const problems: string[] = [];
  for (const [slug, school] of Object.entries(plan.schools as Record<string, Json>)) {
    recordDelta.schools[slug] = { parent: school.parent, record: school.record, locales: {} };
    for (const locale of Object.keys(school.locales) as ReadingLocale[]) {
      const mine = items.filter(item => item.slug === slug && item.locale === locale);
      const strings: Record<string, ReadingTranslation> = {}, uses: Record<string, string[]> = {};
      for (const item of mine) {
        if (item.origin !== "field_use_addition") strings[item.key] = { source: item.source, sourceSha256: item.key, translation: item.translation! };
        uses[item.key] = item.fields;
      }
      const delta: ReadingTranslationDelta = { schemaVersion: "uapt-reading-translation-delta-v1", revision: plan.revision, corpusSourceSha256: pkg.selection.sourceSha256, locale, slug,
        parent: school.parent, record: school.record, protectedClaimIds: school.protectedClaimIds, strings, sourceFieldUses: uses };
      const accepted = acceptedStrings(pkg, slug, locale);
      const options = { statusEnumExceptions: pkg.selection.samplingAcceptance?.statusEnumExceptions ?? [], matchAcceptedBrandVocabulary: Boolean(pkg.selection.samplingAcceptance) };
      const problem = checkReadingTranslationDelta({ accepted, delta, recordDelta, receipt, corpusSourceSha256: pkg.selection.sourceSha256, slug, locale }, options);
      if (problem) { problems.push(`${slug}/${locale}: ${problem.state}: ${problem.reason}`); continue; }
      const bytes = Buffer.from(JSON.stringify(delta)), rel = `${base}/${locale}/${slug}.json`;
      mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
      writeFileSync(path.join(out, rel), bytes, { flag: "wx" });
      recordDelta.schools[slug].locales[locale] = { path: rel, sha256: sha(bytes) };
    }
  }
  if (problems.length) fail(`Record delta not accepted:\n- ${problems.slice(0, 20).join("\n- ")}`);
  const selection: ReadingTranslationSelection = structuredClone(pkg.selection);
  selection.revision = plan.revision;
  selection.supplemental = { ...(selection.supplemental ?? {}), recordDeltas: [...(selection.supplemental?.recordDeltas ?? []), recordDelta] };
  const selectionBytes = Buffer.from(JSON.stringify(selection));
  const selectionRel = `selection-${plan.revision}.json`;
  writeFileSync(path.join(out, selectionRel), selectionBytes, { flag: "wx" });
  const pointerFile = path.join(out, "current.json");
  if (existsSync(pointerFile)) (await import("node:fs")).unlinkSync(pointerFile);
  writeFileSync(pointerFile, JSON.stringify({ path: selectionRel, sha256: sha(selectionBytes) }) + "\n", { flag: "wx" });

  // End-to-end: the production loader, pinned as a release would pin this package, serves every planned locale.
  const pins: NonNullable<ContentReleaseManifest["translations"]> = {
    pointer: `${path.basename(out)}/current.json`,
    ...(selection.sampledPublicationAcceptance ? { sampledPublication: { acceptanceSha256: selection.sampledPublicationAcceptance.acceptanceSha256, selectionSha256: sha(selectionBytes) } } : {}),
    recordDeltaAcceptanceSha256s: (selection.supplemental.recordDeltas ?? []).map(delta => delta.receipt.sha256)
  };
  selectContentForTools({ mode: "release", contentId: `reading-delta-${plan.revision}`, root: realpathSync(path.dirname(out)), manifest: { translations: pins } as ContentReleaseManifest });
  const states: Record<string, string> = {};
  for (const [slug, school] of Object.entries(plan.schools as Record<string, Json>)) for (const locale of Object.keys(school.locales) as ReadingLocale[]) {
    const result = await getReadingTranslations(slug, locale, school.record);
    states[`${slug}/${locale}`] = result.state;
  }
  const notReady = Object.entries(states).filter(([, state]) => state !== "ready");
  if (notReady.length) fail(`The loader does not accept the new package: ${notReady.slice(0, 10).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  return { out, pointer: pointerFile, selectionSha256: sha(selectionBytes), receipt: receiptRef, recordDeltaAcceptanceSha256s: pins.recordDeltaAcceptanceSha256s, schoolsLocales: Object.keys(states).length };
}
