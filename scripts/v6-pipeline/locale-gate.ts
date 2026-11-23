/**
 * G3 on assembled V6 pages: every row a /zh/ page shows has Chinese (docs/v6-pipeline.md §3).
 * assemble.ts runs it on every view it publishes and refuses to build a content release otherwise.
 * As a CLI it audits a content release tree (for example the live parent):
 *
 *   tsx --tsconfig apps/web/tsconfig.json scripts/v6-pipeline/locale-gate.ts <release-dir> [--no-reading-package] [slug ...]
 *
 * Batches 1-2 (2026-11-19/20) shipped 197 /zh/ evidence rows in English; this check fails them.
 *
 * Two layers can supply the Chinese a /zh/ page shows:
 *  1. the V6 page view itself (summaryZh, action zh, toolDisplayCopy.zh, topic zh, hero zh);
 *  2. the release's accepted zh reading-translation package (`translations/current.json`), which the
 *     page applies to the English display strings when the school's package matches its record
 *     (apps/web/lib/reading-translations.ts readingDisplayView). The 132-school V6 cohort relies on it.
 * assemble.ts checks layer 1 only: new pages must carry their own Chinese. The release audit also
 * accepts layer 2 (unless --no-reading-package) and reports how many rows only layer 2 covers; the
 * page applies a package only when it covers every display string, so confirm those schools with a
 * live /zh/ readback (docs/audit-20261121/ZH-COVERAGE.md, 2026-11-22: 1,329 of 1,329 rows Chinese).
 *
 * Rows the page never renders are not counted: the hero of a `v6_presentation_integration` page
 * (only the legacy page renders it), toolDisplayCopy of a `historical_discovery` tool list (that
 * component shows the tool record's own prose, so the prose itself must have Chinese), and tools
 * without any description/access/cost prose.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { zhCoverageProblems, type ReadingLookup } from "../../apps/web/lib/v6-zh-coverage";

const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

export { zhCoverageProblems };
export type { ReadingLookup };

export interface PagesZhOptions {
  /** Per-slug zh reading-translation lookups (release audit only; assemble passes none). */
  readingLookups?: Record<string, ReadingLookup>;
  /** Release audit: a slug with no view in any locale is not served from public-v6-pages; list it instead of failing. */
  listSlugsWithoutViews?: string[];
}

/** Problems per slug for the zh views of a V6 pages package (englishOnly slugs are exempt). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pagesZhProblems(pages: any, slugs?: string[], options: PagesZhOptions = {}): Record<string, string[]> {
  const englishOnly = new Set<string>(pages.englishOnlySlugs ?? []);
  const out: Record<string, string[]> = {};
  for (const slug of slugs ?? pages.slugs ?? []) {
    if (englishOnly.has(slug)) continue;
    const view = pages.locales?.zh?.views?.[slug];
    if (!view && options.listSlugsWithoutViews && !Object.values(pages.locales ?? {}).some((l: any) => l?.views?.[slug])) { // eslint-disable-line @typescript-eslint/no-explicit-any
      options.listSlugsWithoutViews.push(slug);
      continue;
    }
    const problems = view ? zhCoverageProblems(view, options.readingLookups?.[slug]) : ["no zh view"];
    if (problems.length) out[slug] = problems;
  }
  return out;
}

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

interface ReadingRef { path: string; sha256: string }
interface ReadingBasis { recordSha256: string; originalEvidenceSha256: string }
interface ReadingBundle extends Partial<ReadingBasis> { slug?: string; locale?: string; strings: Record<string, { source: string; translation: string }> }
interface RecordDelta { receipt?: ReadingRef; schools?: Record<string, { parent?: ReadingBasis; record?: ReadingBasis; locales?: Record<string, ReadingRef> }> }

/**
 * zh lookups from a release tree's accepted reading selection. Every file is hash-checked against
 * its reference, as the web runtime does. A school's bundle counts only when its record basis reaches
 * the selected V6 record revision (the page's reading basis), directly or through the selection's
 * record deltas (`supplemental.recordDeltas`, applied in order, each pinned by the release manifest's
 * `translations.recordDeltaAcceptanceSha256s`), mirroring composeRecordDeltas in
 * apps/web/lib/reading-translations.ts. The per-string review checks of a delta are not re-run here.
 */
export function releaseZhReadingLookups(treeRoot: string, recordSha256BySlug: Record<string, string | undefined>, deltaPins: string[] = []) {
  const root = path.join(treeRoot, "translations");
  const pointer = path.join(root, "current.json");
  const info = { selection: null as string | null, schools: 0, viaRecordDelta: [] as string[], basisMismatch: [] as string[], missing: [] as string[] };
  const lookups: Record<string, ReadingLookup> = {};
  if (!existsSync(pointer)) return { lookups, info };
  const verified = <T>(ref: ReadingRef): T => {
    const file = path.resolve(root, ref.path);
    if (!file.startsWith(root + path.sep)) throw Error(`Reading package path escapes translations/: ${ref.path}`);
    const raw = readFileSync(file);
    if (sha256(raw) !== ref.sha256) throw Error(`Reading package file hash mismatch: ${ref.path}`);
    return JSON.parse(raw.toString("utf8")) as T;
  };
  const ref = JSON.parse(readFileSync(pointer, "utf8")) as ReadingRef;
  const selection = verified<{ publicationApproved?: boolean; candidateOnly?: boolean; shared: Record<string, ReadingRef>; schools: Record<string, Record<string, ReadingRef>>; supplemental?: { recordDeltas?: RecordDelta[] } }>(ref);
  if (selection.publicationApproved !== true || selection.candidateOnly) return { lookups, info };
  info.selection = ref.path;
  const shared = selection.shared?.zh ? verified<ReadingBundle>(selection.shared.zh) : undefined;
  for (const [slug, recordSha256] of Object.entries(recordSha256BySlug)) {
    const schoolRef = selection.schools?.[slug]?.zh;
    if (!schoolRef) { info.missing.push(slug); continue; }
    const bundle = verified<ReadingBundle>(schoolRef);
    if (bundle.slug && bundle.slug !== slug) { info.basisMismatch.push(slug); continue; }
    const deltas: ReadingBundle[] = [];
    let basis = { recordSha256: bundle.recordSha256, originalEvidenceSha256: bundle.originalEvidenceSha256 };
    for (const delta of selection.supplemental?.recordDeltas ?? []) {
      if (!recordSha256 || basis.recordSha256 === recordSha256) break;
      const entry = delta?.schools?.[slug];
      if (!entry?.parent || !entry.record || entry.parent.recordSha256 !== basis.recordSha256 || entry.parent.originalEvidenceSha256 !== basis.originalEvidenceSha256) continue;
      if (!delta.receipt?.sha256 || !deltaPins.includes(delta.receipt.sha256) || !entry.locales?.zh) break; // unpinned or no zh: the page falls back
      deltas.push(verified<ReadingBundle>(entry.locales.zh));
      basis = entry.record;
    }
    if (!recordSha256 || basis.recordSha256 !== recordSha256) { info.basisMismatch.push(slug); continue; }
    if (deltas.length) info.viaRecordDelta.push(slug);
    const bundles = [...deltas.reverse(), bundle, shared].filter(Boolean) as ReadingBundle[];
    lookups[slug] = (source: string) => {
      const key = sha256(source);
      return bundles.some(b => b.strings?.[key]?.source === source && text(b.strings[key].translation));
    };
    info.schools++;
  }
  return { lookups, info };
}

export async function releasePagesZhProblems(releaseDir: string, slugs?: string[], options: { readingPackage?: boolean } = {}) {
  const { selectTree } = await import("../content-release/lib");
  const { loadSelected } = await import("../content-release/correct");
  const manifest = JSON.parse(readFileSync(path.join(releaseDir, "manifest.json"), "utf8"));
  const tree = path.join(releaseDir, "tree");
  selectTree(manifest.contentId, tree, manifest);
  const { pages, records } = loadSelected(path.join(tree, "data"));
  const scope: string[] = slugs?.length ? slugs : pages.slugs ?? [];
  const strict = pagesZhProblems(pages, scope, { listSlugsWithoutViews: [] });
  const withoutViews: string[] = [];
  let reading: ReturnType<typeof releaseZhReadingLookups>["info"] | null = null;
  let problems = strict;
  if (options.readingPackage !== false) {
    const revisions: Record<string, { recordSha256?: string }> = records.recordRevisions ?? {};
    const loaded = releaseZhReadingLookups(tree, Object.fromEntries(scope.map(slug => [slug, revisions[slug]?.recordSha256])), manifest.translations?.recordDeltaAcceptanceSha256s ?? []);
    reading = loaded.info;
    problems = pagesZhProblems(pages, scope, { readingLookups: loaded.lookups, listSlugsWithoutViews: withoutViews });
  } else pagesZhProblems(pages, scope, { listSlugsWithoutViews: withoutViews });
  const count = (p: Record<string, string[]>) => Object.values(p).reduce((n, rows) => n + rows.length, 0);
  return { problems, ownChineseMissing: count(strict), coveredOnlyByReadingPackage: count(strict) - count(problems), slugsWithoutV6PageViews: withoutViews, readingPackage: reading };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const readingPackage = !args.includes("--no-reading-package");
  const [release, ...slugs] = args.filter(arg => arg !== "--no-reading-package");
  if (!release) { console.error("usage: locale-gate.ts <release-dir> [--no-reading-package] [slug ...]"); process.exit(2); }
  releasePagesZhProblems(path.resolve(release), slugs, { readingPackage }).then(result => {
    const rows = Object.values(result.problems).reduce((n, p) => n + p.length, 0);
    console.log(JSON.stringify({ schoolsWithProblems: Object.keys(result.problems).length, problems: rows,
      ownChineseMissing: result.ownChineseMissing, coveredOnlyByReadingPackage: result.coveredOnlyByReadingPackage,
      note: result.coveredOnlyByReadingPackage ? "Rows covered only by the zh reading package show Chinese only when the page applies the package; confirm with a live /zh/ readback." : undefined,
      slugsWithoutV6PageViews: result.slugsWithoutV6PageViews, readingPackage: result.readingPackage, detail: result.problems }, null, 1));
    process.exitCode = rows ? 1 : 0;
  }).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 2; });
}
