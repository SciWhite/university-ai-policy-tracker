import { existsSync, lstatSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertContentCompatible, CONTENT_RELEASE_SCHEMA, type ContentReleaseManifest } from "../../apps/web/lib/content-runtime";
import { readPublishedV6 } from "../../apps/web/lib/policy-v6-published";
import { readV6RecordCorrections, v6RecordSlugs } from "../../apps/web/lib/v6-effective-records";
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

  // 7. Parent comparison: nothing removed, released or re-quoted without a decision.
  if (options.compareParent !== false && manifest.parentContentId) {
    const parentDir = releaseDir(contentRoot, manifest.parentContentId);
    if (!existsSync(path.join(parentDir, "manifest.json"))) {
      errors.push(`Parent release ${manifest.parentContentId} is not available for comparison`);
    } else {
      const parentManifest = readManifest(contentRoot, manifest.parentContentId).manifest;
      selectTree(manifest.parentContentId, path.join(parentDir, "tree"), parentManifest);
      const parent: ClaimSets = (await computeClaimSets()).sets;
      report.parentSchoolDigests = await schoolDigests();
      selectTree(contentId, tree, manifest);
      const compared = compareClaimSets(parent, current.sets, manifest);
      errors.push(...compared.errors);
      notes.push(...compared.notes);
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
