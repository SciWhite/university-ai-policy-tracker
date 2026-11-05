import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import {
  CONTENT_API_VERSION, CONTENT_RELEASE_SCHEMA, selectContentForTools, sha256Hex,
  type ActiveContent, type ContentReleaseManifest
} from "../../apps/web/lib/content-runtime";
import { getStagedPublicDataset } from "../../apps/web/lib/staged-public-data";
import { readV6RecordCorrections, v6RecordSlugs } from "../../apps/web/lib/v6-effective-records";

export const CONTENT_ID_PATTERN = /^[a-z0-9][a-z0-9.-]{2,95}$/;
export const sha256 = sha256Hex;
export const sha256File = (file: string) => sha256Hex(readFileSync(file));
export const objectRelPath = (sha: string) => `objects/${sha.slice(0, 2)}/${sha}`;
export const releaseDir = (contentRoot: string, contentId: string) => path.join(contentRoot, "releases", contentId);

export function readManifest(contentRoot: string, contentId: string): { manifest: ContentReleaseManifest; bytes: Buffer; file: string } {
  if (!CONTENT_ID_PATTERN.test(contentId)) throw new Error(`Invalid content id: ${contentId}`);
  const file = path.join(releaseDir(contentRoot, contentId), "manifest.json");
  const bytes = readFileSync(file);
  return { manifest: JSON.parse(bytes.toString("utf8")), bytes, file };
}

/** Evaluate a release tree with the production loaders (V6 gates on). */
export function selectTree(contentId: string, root: string, manifest?: ContentReleaseManifest): ActiveContent {
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  // Always release mode: workspace mode would fall back to the checkout's data/.
  const content: ActiveContent = { mode: "release", contentId, root: realpathSync(root), manifest };
  selectContentForTools(content);
  return content;
}

export interface ClaimState { published: Map<string, string>; held: Set<string> }
export type ClaimSets = Map<string, ClaimState>;
export interface ClaimCheck { sets: ClaimSets; evidenceProblems: string[]; summary: ContentReleaseManifest["claimSets"] }

/** Original quote and locator identity of one claim; any change must be a declared correction. */
function evidenceFingerprint(evidence: { sourceUrl: string; sourceSnapshotHash: string; evidenceSnippet: string; snippetLocation?: string; sourceLanguage?: string }[]) {
  return sha256(JSON.stringify(evidence.map(e => [e.sourceUrl, e.sourceSnapshotHash, e.evidenceSnippet, e.snippetLocation ?? null, e.sourceLanguage ?? null])));
}

/**
 * Full public Claim ID sets of the selected tree: V6 effective records (with
 * their held claims) for V6 schools, the staged public catalog for the rest.
 */
export async function computeClaimSets(): Promise<ClaimCheck> {
  const sets: ClaimSets = new Map();
  const evidenceProblems: string[] = [];
  const add = (slug: string, claims: { id?: string; evidence: Parameters<typeof evidenceFingerprint>[0] }[], held: { id?: string }[]) => {
    const state: ClaimState = { published: new Map(), held: new Set() };
    for (const claim of claims) {
      if (!claim.id) { evidenceProblems.push(`${slug}: published claim without Claim ID`); continue; }
      if (state.published.has(claim.id)) evidenceProblems.push(`${slug}: duplicate Claim ID ${claim.id}`);
      if (!claim.evidence.length) evidenceProblems.push(`${slug}/${claim.id}: no evidence`);
      for (const e of claim.evidence) {
        if (!e.evidenceSnippet?.trim()) evidenceProblems.push(`${slug}/${claim.id}: empty original quote`);
        if (!/^https?:\/\//.test(e.sourceUrl ?? "")) evidenceProblems.push(`${slug}/${claim.id}: source URL is not http(s)`);
        if (!/^[a-f0-9]{64}$/.test(e.sourceSnapshotHash ?? "")) evidenceProblems.push(`${slug}/${claim.id}: invalid snapshot hash`);
      }
      state.published.set(claim.id, evidenceFingerprint(claim.evidence));
    }
    for (const claim of held) if (claim.id) state.held.add(claim.id);
    sets.set(slug, state);
  };
  const v6 = new Set(v6RecordSlugs());
  const records = readV6RecordCorrections();
  for (const slug of v6) {
    const summary = records?.summaries.find(s => s.entity.slug === slug);
    if (!summary) { evidenceProblems.push(`${slug}: V6 record scope without summary`); continue; }
    add(slug, summary.claims, records?.heldBySlug[slug] ?? []);
  }
  const dataset = await getStagedPublicDataset();
  for (const summary of dataset.publicSummaries) if (!v6.has(summary.entity.slug)) add(summary.entity.slug, summary.claims, []);
  const canonical = [...sets].sort(([a], [b]) => a.localeCompare(b)).map(([slug, state]) => [slug, [...state.published.keys()].sort(), [...state.held].sort()]);
  const summary = {
    schools: sets.size,
    claims: [...sets.values()].reduce((n, s) => n + s.published.size, 0),
    held: [...sets.values()].reduce((n, s) => n + s.held.size, 0),
    sha256: sha256(JSON.stringify(canonical))
  };
  return { sets, evidenceProblems, summary };
}

export interface DecisionProblems { errors: string[]; notes: string[] }

/**
 * Parent -> candidate rules for Claim IDs, held decisions and original quotes:
 * nothing disappears, leaves a hold, or changes its quote/locator silently.
 */
export function compareClaimSets(parent: ClaimSets, next: ClaimSets, manifest: ContentReleaseManifest): DecisionProblems {
  const errors: string[] = [], notes: string[] = [];
  const decisions = manifest.decisions ?? {};
  const records = readV6RecordCorrections();
  const declared = (kind: "removedClaimIds" | "releasedHeldClaimIds" | "correctedClaimIds", slug: string, id: string) => {
    if (decisions[kind]?.[slug]?.includes(id)) return true;
    const change = records?.changesBySlug?.[slug];
    if (kind === "releasedHeldClaimIds") return Boolean(change?.addedClaimIds?.includes(id));
    if (kind === "correctedClaimIds") return Boolean(change?.updatedClaimIds?.includes(id));
    return false;
  };
  for (const [slug, before] of parent) {
    const after = next.get(slug);
    for (const [id, fingerprint] of before.published) {
      const now = after?.published.get(id);
      if (now === undefined) {
        if (after?.held.has(id)) { if (!declared("removedClaimIds", slug, id)) errors.push(`${slug}/${id}: published claim moved to held without a declared decision`); }
        else if (!declared("removedClaimIds", slug, id)) errors.push(`${slug}/${id}: Claim ID removed without a declared decision`);
      } else if (now !== fingerprint && !declared("correctedClaimIds", slug, id)) {
        errors.push(`${slug}/${id}: original quote or locator changed without a declared correction`);
      }
    }
    for (const id of before.held) {
      if (after?.held.has(id)) continue;
      if (after?.published.has(id)) { if (!declared("releasedHeldClaimIds", slug, id)) errors.push(`${slug}/${id}: held claim published without a recorded decision`); }
      else if (!declared("removedClaimIds", slug, id)) errors.push(`${slug}/${id}: held decision dropped`);
    }
  }
  for (const [slug, after] of next) if (!parent.has(slug)) notes.push(`${slug}: new school (${after.published.size} claims, ${after.held.size} held)`);
  return { errors, notes };
}

export function detectSchemas(root: string): { schemas: string[]; requiredSyncContract: "2.0.0" | "2.1.0"; families: ContentReleaseManifest["families"] } {
  const read = (rel: string) => JSON.parse(readFileSync(path.join(root, rel), "utf8"));
  const schemas = new Set<string>(["uapt-public-release-manifest-v1", "uapt-v6-published-pages-v1", "uapt-v6-effective-records-v1", "uapt-bounded-public-history-v1"]);
  const families: ContentReleaseManifest["families"] = {};
  for (const file of ["data/public-releases/current.json", "data/public-v6-pages/current.json", "data/public-v6-records/current.json", "data/public-v6-history/current.json", "data/public-change-history/current.json", "data/public-v6-change-overviews/current.json", "data/public-record-repairs/current.json"]) {
    if (!existsSync(path.join(root, file))) continue;
    const value = read(file);
    families[file.split("/")[1]] = { schemaVersion: value.schemaVersion, revision: value.releaseId ?? value.revision ?? value.basisRevision, sha256: value.sha256 ?? sha256File(path.join(root, file)) };
  }
  const history = read("data/public-change-history/current.json");
  const historySchema = read(`data/public-change-history/${history.path}`).schemaVersion as string;
  schemas.add(historySchema);
  const overviews = existsSync(path.join(root, "data/public-v6-change-overviews/sharded/index.json"));
  if (overviews) schemas.add("uapt-v6-change-overviews-v1");
  if (existsSync(path.join(root, "data/monthly-reports/registry.json"))) schemas.add(read("data/monthly-reports/registry.json").schemaVersion);
  // Releases carrying change-history v2 or V6 overview packages need contract 2.1.0 (AGENTS.md).
  const requiredSyncContract = historySchema === "uapt-public-change-history-v2" || overviews ? "2.1.0" : "2.0.0";
  return { schemas: [...schemas].sort(), requiredSyncContract, families };
}

export const defaultCompatibility = (schemas: string[]) => ({ contentApi: [CONTENT_API_VERSION], schemas });
export { CONTENT_RELEASE_SCHEMA };
export const digestJson = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
