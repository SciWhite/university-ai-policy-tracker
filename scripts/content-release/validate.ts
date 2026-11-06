import { existsSync, lstatSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertContentCompatible, CONTENT_RELEASE_SCHEMA, type ContentReleaseManifest } from "../../apps/web/lib/content-runtime";
import { readPublishedV6 } from "../../apps/web/lib/policy-v6-published";
import { readV6RecordCorrections, v6RecordSlugs, v6SummaryAtRevision } from "../../apps/web/lib/v6-effective-records";
import { getScopedRecordReleaseDiff } from "../../apps/web/lib/release-diffs";
import { v6FrozenHistory } from "../../apps/web/lib/v6-history-cache";
import { historyManifest } from "../../apps/web/lib/public-change-history";
import { monthlyReportRegistry } from "../../apps/web/lib/monthly-report-registry";
import { getStagedPublicDataset } from "../../apps/web/lib/staged-public-data";
import { loadCatalog } from "../../apps/mcp/src/catalog";
import { privateFieldViolations, privatePathViolation } from "./file-set";
import { compareClaimSets, computeClaimSets, detectSchemas, objectRelPath, readManifest, releaseDir, selectTree, sha256, type ClaimSets } from "./lib";

export interface ValidationReport {
  ok: boolean;
  contentId: string;
  parentContentId: string | null;
  manifestSha256: string;
  errors: string[];
  notes: string[];
  stats: Record<string, number | string>;
  /** Per-school summary digests, used by the switch step to list changed URLs. */
  schoolDigests?: Record<string, string>;
  parentSchoolDigests?: Record<string, string>;
}

const baseline = JSON.parse(readFileSync(new URL("./private-field-baseline.json", import.meta.url), "utf8")) as { entries: { path: string; sha256: string; fields: string[] }[] };

function walkTree(root: string, rel = "", out: string[] = []): string[] {
  for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walkTree(root, child, out);
    else out.push(child);
  }
  return out;
}

/** Digest of each school's public record in the selected tree. */
export async function schoolDigests(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const records = readV6RecordCorrections();
  const v6 = new Set(v6RecordSlugs());
  for (const summary of records?.summaries ?? []) if (v6.has(summary.entity.slug)) out[summary.entity.slug] = sha256(JSON.stringify([summary, records?.heldBySlug[summary.entity.slug] ?? [], records?.toolsBySlug[summary.entity.slug] ?? []]));
  for (const summary of (await getStagedPublicDataset()).publicSummaries) if (!v6.has(summary.entity.slug)) out[summary.entity.slug] = sha256(JSON.stringify(summary));
  return out;
}

/** A record correction must ship a regenerated catalog; an inherited one would serve the old text. */
export function staleCatalogRecords(records: { summary: { entity: { slug: string } }; recordSha256?: string }[], pins: Record<string, string>): string[] {
  const bySlug = new Map(records.map(record => [record.summary.entity.slug, record]));
  return Object.entries(pins).flatMap(([slug, recordSha256]) => {
    const record = bySlug.get(slug);
    return record && record.recordSha256 !== recordSha256 ? [`MCP catalog is stale for ${slug}: it serves record ${record.recordSha256 ?? "(none)"}, the release publishes ${recordSha256}`] : [];
  });
}

/** Schools whose record changed in this release must move their locale-index entry with them. */
export function staleLocaleIndexEntries(policy: { schools: Record<string, { recordSha256: string }> }, pins: Record<string, string>, parentPins: Record<string, string>): string[] {
  return Object.keys(pins).filter(slug => parentPins[slug] && parentPins[slug] !== pins[slug]).flatMap(slug => {
    const entry = policy.schools[slug];
    return entry && entry.recordSha256 !== pins[slug] ? [`Locale-index policy still binds ${slug} to its previous record ${entry.recordSha256}; update it with the correction`] : [];
  });
}

/** recordSha256 of every V6 school in the selected tree. */
function recordPins(): Record<string, string> {
  const records = readV6RecordCorrections();
  return Object.fromEntries(v6RecordSlugs().flatMap(slug => records?.recordRevisions[slug] ? [[slug, records.recordRevisions[slug].recordSha256]] : []));
}

/**
 * Schools changed in the selected records revision: publication date not in
 * the future of the release, and a previous revision the production diff can read.
 */
export function checkRecordRevisions(manifest: Pick<ContentReleaseManifest, "createdAt">): string[] {
  const errors: string[] = [];
  const records = readV6RecordCorrections();
  if (!records) return errors;
  const createdAt = Date.parse(manifest.createdAt);
  for (const [slug, pin] of Object.entries(records.recordRevisions)) {
    if (pin.universityRevisionId !== records.revision) continue;
    if (!Number.isFinite(Date.parse(pin.publishedAt))) errors.push(`${slug}: invalid publishedAt ${pin.publishedAt}`);
    else if (Date.parse(pin.publishedAt) > createdAt) errors.push(`${slug}: publishedAt ${pin.publishedAt} is after the release was built (${manifest.createdAt})`);
    if (pin.previousRevisionId && !v6SummaryAtRevision(slug, pin.previousRevisionId)) errors.push(`${slug}: previousRevisionId ${pin.previousRevisionId} is not a readable V6 revision`);
  }
  if (Number.isFinite(Date.parse(records.publishedAt)) && Date.parse(records.publishedAt) > createdAt) errors.push(`Records revision ${records.revision} is published after the release was built`);
  return errors;
}

type LocaleIndexPolicyFile = { schemaVersion: string; sourceSha256: string; schools: Record<string, { recordSha256: string; locales: string[] }> };
function checkLocaleIndexPolicy(manifest: ContentReleaseManifest, tree: string, listed: Map<string, { sha: string }>, errors: string[]): LocaleIndexPolicyFile | undefined {
  const declared = manifest.localeIndexPolicy;
  if (!declared) return undefined;
  if (listed.get(declared.path)?.sha !== declared.sha256) { errors.push("Locale-index policy is not a listed file with the declared hash"); return undefined; }
  const policy = JSON.parse(readFileSync(path.join(tree, declared.path), "utf8")) as LocaleIndexPolicyFile;
  if (policy.schemaVersion !== "uapt-university-locale-index-policy-v1" || !/^[a-f0-9]{64}$/.test(policy.sourceSha256) || !policy.schools) { errors.push("Locale-index policy schema is invalid"); return undefined; }
  const selection = readSelection(manifest, tree);
  // The loader indexes a locale only when the bundles carry this corpus identity.
  if (selection && selection.sourceSha256 !== policy.sourceSha256) errors.push("Locale-index policy and translation package name different corpora");
  return policy;
}

type SelectionFile = { sourceSha256: string; schools?: Record<string, Record<string, { path: string; sha256: string }>>; supplemental?: { recordDeltas?: { receipt?: { sha256?: string }; schools?: Record<string, unknown> }[] } };
export function readSelection(manifest: Pick<ContentReleaseManifest, "translations">, tree: string): SelectionFile | undefined {
  if (!manifest.translations) return undefined;
  const pointer = path.join(tree, manifest.translations.pointer);
  if (!existsSync(pointer)) return undefined;
  const ref = JSON.parse(readFileSync(pointer, "utf8")) as { path: string };
  return JSON.parse(readFileSync(path.join(path.dirname(pointer), ref.path), "utf8")) as SelectionFile;
}

/** Every record delta in the translation package is accepted by this release's pins. */
function checkTranslationDeltas(manifest: ContentReleaseManifest, tree: string): string[] {
  const selection = readSelection(manifest, tree);
  const pins = new Set(manifest.translations?.recordDeltaAcceptanceSha256s ?? []);
  const receipts = (selection?.supplemental?.recordDeltas ?? []).map(delta => delta.receipt?.sha256 ?? "");
  return [
    ...receipts.filter(receipt => !pins.has(receipt)).map(receipt => `Record delta review ${receipt || "(missing)"} is not pinned by the release manifest`),
    ...[...pins].filter(pin => !receipts.includes(pin)).map(pin => `Manifest pins record delta review ${pin} that the translation package does not carry`)
  ];
}

export async function validateContentRelease(contentRoot: string, contentId: string, options: { compareParent?: boolean } = {}): Promise<ValidationReport> {
  const errors: string[] = [], notes: string[] = [], stats: Record<string, number | string> = {};
  const { manifest, bytes } = readManifest(contentRoot, contentId);
  const report: ValidationReport = { ok: false, contentId, parentContentId: manifest.parentContentId ?? null, manifestSha256: sha256(bytes), errors, notes, stats };
  const fail = (message: string) => { errors.push(message); return report; };

  // 1. Manifest schema and program compatibility.
  if (manifest.schemaVersion !== CONTENT_RELEASE_SCHEMA || manifest.contentId !== contentId) return fail("Manifest schema or content id mismatch");
  try { assertContentCompatible(manifest); } catch (error) { return fail((error as Error).message); }
  if (!["2.0.0", "2.1.0"].includes(manifest.requiredSyncContract)) return fail("Unknown required synchronization contract");
  if (manifest.parentContentId === contentId) return fail("A release cannot be its own parent");

  // 2. Exact file set, hashes, content-addressed objects, no extra or linked files.
  const tree = path.join(releaseDir(contentRoot, contentId), "tree");
  const listed = new Map<string, { sha: string; bytes: number }>();
  let previous = "";
  for (const entry of manifest.files) {
    const [rel, sha, size] = entry;
    if (typeof rel !== "string" || rel <= previous) return fail(`File list is not strictly sorted at ${rel}`);
    previous = rel;
    if (path.posix.isAbsolute(rel) || rel.split("/").some(part => !part || part === "." || part === "..")) return fail(`Unsafe content path: ${rel}`);
    if (!/^[a-f0-9]{64}$/.test(sha) || !Number.isSafeInteger(size) || size < 0) return fail(`Invalid file entry: ${rel}`);
    const privatePath = privatePathViolation(rel);
    if (privatePath) errors.push(privatePath);
    listed.set(rel, { sha, bytes: size });
  }
  const actual = walkTree(tree).sort();
  for (const rel of actual) if (!listed.has(rel)) errors.push(`Unlisted file in release tree: ${rel}`);
  const parentFiles = new Set<string>();
  if (manifest.parentContentId && existsSync(path.join(releaseDir(contentRoot, manifest.parentContentId), "manifest.json"))) {
    for (const [, sha] of readManifest(contentRoot, manifest.parentContentId).manifest.files) parentFiles.add(sha);
  }
  let totalBytes = 0, scanned = 0;
  for (const [rel, { sha, bytes: size }] of listed) {
    const file = path.join(tree, rel);
    let info;
    try { info = lstatSync(file); } catch { errors.push(`Missing content file: ${rel}`); continue; }
    if (!info.isFile()) { errors.push(`Not a regular file: ${rel}`); continue; }
    if (info.size !== size) { errors.push(`Size mismatch: ${rel}`); continue; }
    const raw = readFileSync(file);
    if (sha256(raw) !== sha) { errors.push(`Hash mismatch: ${rel}`); continue; }
    const object = path.join(contentRoot, objectRelPath(sha));
    if (!existsSync(object) || statSync(object).ino !== info.ino) notes.push(`Not hard-linked to its object: ${rel}`);
    totalBytes += size;
    // 3. Private-field exclusion. Objects already validated in the parent release are not rescanned.
    if (rel.endsWith(".json") && !parentFiles.has(sha)) {
      scanned++;
      const allowed = baseline.entries.find(item => item.path === rel && item.sha256 === sha)?.fields ?? [];
      let value: unknown;
      try { value = JSON.parse(raw.toString("utf8")); } catch { errors.push(`Invalid JSON: ${rel}`); continue; }
      for (const violation of privateFieldViolations(value)) {
        if (!allowed.includes(violation.split(":")[0])) errors.push(`Private field in public content: ${rel} ${violation}`);
      }
    }
  }
  Object.assign(stats, { files: listed.size, bytes: totalBytes, jsonScanned: scanned });
  if (errors.length) return report;

  // 4. Family pointers, schemas and identities through the production loaders.
  selectTree(contentId, tree, manifest);
  const detected = detectSchemas(tree);
  if (JSON.stringify(detected.families) !== JSON.stringify(manifest.families)) errors.push("Manifest family identities do not match the tree");
  if (detected.requiredSyncContract === "2.1.0" && manifest.requiredSyncContract !== "2.1.0") errors.push("Change-history v2/overview content requires synchronization contract 2.1.0");
  const missingSchemas = detected.schemas.filter(schema => !manifest.appCompatibility.schemas.includes(schema));
  if (missingSchemas.length) errors.push(`appCompatibility omits schemas: ${missingSchemas.join(", ")}`);
  try {
    const pages = readPublishedV6();
    if (!pages) throw new Error("No published V6 pages");
    const records = readV6RecordCorrections();
    if (!records) throw new Error("No V6 records");
    for (const slug of v6RecordSlugs()) v6FrozenHistory(slug);
    const { manifest: history } = await historyManifest();
    stats.v6Schools = pages.slugs.length;
    stats.changeHistory = history.revision ?? history.schemaVersion;
    const registry = monthlyReportRegistry();
    for (const [month, spec] of Object.entries(registry.reports)) if (!listed.has(spec.releaseManifestPath)) errors.push(`Report ${month} counts a release manifest outside the package: ${spec.releaseManifestPath}`);
    if (manifest.reports && (manifest.reports.current !== registry.current || manifest.reports.registry !== "data/monthly-reports/registry.json")) errors.push("Manifest report pointer does not match the registry");
    stats.currentReport = registry.current;
  } catch (error) {
    errors.push(`Loader identity check failed: ${(error as Error).message}`);
    return report;
  }

  // 5. Full Claim ID sets, original quotes/locators, held decisions.
  const current = await computeClaimSets();
  errors.push(...current.evidenceProblems.slice(0, 50));
  if (current.evidenceProblems.length > 50) errors.push(`... ${current.evidenceProblems.length - 50} more evidence problems`);
  if (JSON.stringify(current.summary) !== JSON.stringify(manifest.claimSets)) errors.push("Manifest claimSets do not match the computed Claim ID sets");
  Object.assign(stats, { schools: current.summary.schools, claims: current.summary.claims, held: current.summary.held });
  report.schoolDigests = await schoolDigests();

  // 6. MCP catalog: same release identity, and only published (never held) Claim IDs.
  if (manifest.mcp) {
    const file = listed.get(manifest.mcp.catalog);
    if (!file || file.sha !== manifest.mcp.sha256) errors.push("MCP catalog is not a listed file with the declared hash");
    else {
      const catalog = await loadCatalog(path.join(tree, manifest.mcp.catalog));
      if (catalog.releaseId !== manifest.mcp.releaseId) errors.push("MCP catalog release mismatch");
      for (const record of catalog.records) {
        const state = current.sets.get(record.summary.entity.slug);
        for (const claim of record.summary.claims) {
          if (!claim.id || !state?.published.has(claim.id)) errors.push(`MCP exposes a claim outside the published set: ${record.summary.entity.slug}/${claim.id}`);
          if (claim.id && state?.held.has(claim.id)) errors.push(`MCP exposes a held claim: ${record.summary.entity.slug}/${claim.id}`);
        }
      }
      stats.mcpUniversities = catalog.records.length;
    }
  }
  if (manifest.translations && !listed.has(manifest.translations.pointer)) errors.push("Translation pointer is not in the package");
  const pins = recordPins();
  if (manifest.mcp && listed.get(manifest.mcp.catalog)?.sha === manifest.mcp.sha256) {
    // A record correction must ship a regenerated catalog; an inherited one would serve the old text.
    errors.push(...staleCatalogRecords((await loadCatalog(path.join(tree, manifest.mcp.catalog))).records, pins));
  }
  errors.push(...checkRecordRevisions(manifest));
  if (pins && Object.keys(pins).length) {
    try { await getScopedRecordReleaseDiff(readV6RecordCorrections()!.revision); }
    catch (error) { errors.push(`Scoped release diff for /changes/${readV6RecordCorrections()!.revision} fails: ${(error as Error).message}`); }
  }
  const policy = checkLocaleIndexPolicy(manifest, tree, listed, errors);
  const deltas = checkTranslationDeltas(manifest, tree);
  errors.push(...deltas);

  // 7. Parent comparison: nothing removed, released or re-quoted without a decision.
  let parentPins: Record<string, string> = {};
  if (options.compareParent !== false && manifest.parentContentId) {
    const parentDir = releaseDir(contentRoot, manifest.parentContentId);
    if (!existsSync(path.join(parentDir, "manifest.json"))) {
      errors.push(`Parent release ${manifest.parentContentId} is not available for comparison`);
    } else {
      const parentManifest = readManifest(contentRoot, manifest.parentContentId).manifest;
      selectTree(manifest.parentContentId, path.join(parentDir, "tree"), parentManifest);
      const parent: ClaimSets = (await computeClaimSets()).sets;
      report.parentSchoolDigests = await schoolDigests();
      parentPins = recordPins();
      selectTree(contentId, tree, manifest);
      const compared = compareClaimSets(parent, current.sets, manifest);
      errors.push(...compared.errors);
      notes.push(...compared.notes);
      // Schools whose record changed in this release need their locale-index entry moved with them.
      const changed = Object.keys(pins).filter(slug => parentPins[slug] && parentPins[slug] !== pins[slug]);
      if (changed.length && policy) errors.push(...staleLocaleIndexEntries(policy, pins, parentPins));
      else if (changed.length && !manifest.localeIndexPolicy) {
        notes.push(`Locale-index policy is environment-pinned: ${changed.length} changed school(s) keep only their default index locales until the pinned file is replaced (${changed.slice(0, 5).join(", ")})`);
      }
      stats.changedRecords = changed.length;
    }
  }
  report.ok = errors.length === 0;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
  const contentRoot = path.resolve(arg("--content-root") ?? process.env.UAPT_CONTENT_ROOT ?? "");
  const contentId = arg("--content-id");
  if (!contentId || !contentRoot) { console.error("usage: content:validate --content-root <dir> --content-id <id> [--report <file>]"); process.exit(2); }
  validateContentRelease(contentRoot, contentId).then(result => {
    const { schoolDigests: _a, parentSchoolDigests: _b, ...printable } = result;
    if (arg("--report")) writeFileSync(arg("--report")!, JSON.stringify(printable, null, 2) + "\n");
    console.log(JSON.stringify(printable, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
