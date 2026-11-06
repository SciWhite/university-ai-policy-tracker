/**
 * `pnpm content:correct`: a reviewed policy-claim correction as a pure content
 * release (docs/content-release.md §12). No per-correction scripts, no
 * restart: the output is an overlay, an MCP catalog, a locale-index policy and
 * decisions for `content:build`.
 *
 *   prepare  --decisions <file> --out <NEW dir> [--source <tree or checkout> | --content-root <root> [--source-release <id>]]
 *            Applies the decisions to the selected V6 revision, runs the review
 *            lints and the production gates, and writes the candidate, a review
 *            packet and a review template. Records no reviewer.
 *   finalize --candidate <prepare dir> --review <review.json> --out <NEW dir> [--locale-index-policy <file>]
 *            Checks the independent review against the exact candidate, adds the
 *            presentation receipts and writes: overlay/ (V6 records, pages and
 *            history revision, Changes v2 projection, overviews, provenance),
 *            mcp/catalog.json, locale-index-policy.json, decisions.json and the
 *            content:build command.
 *   translations plan|template|build ...   record deltas for reading translations (reading-delta.ts)
 *
 * Nothing here selects a live pointer, restarts, purges or notifies.
 */
import { createHash, randomBytes } from "node:crypto";
import { constants, copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { V6ArtifactStore, type ShardIndex } from "../../apps/web/lib/v6-artifact-store";
import { buildEventHistories, buildChangeOverview, eventPreview, type ChangeProjectionInput, type ChangeOverviewPackage, type ScopedEventSource } from "../../apps/web/lib/change-events";
import { ChangeEventStore, historyManifest } from "../../apps/web/lib/public-change-history";
import { mergeSourceHashRegistry, type SourceHashRegistry } from "../../apps/web/lib/source-hash-registry";
import { publicHistoryBasisV2 } from "../../apps/web/lib/public-history-basis";
import { getV6PageInput } from "../../apps/web/lib/policy-v6-page-input";
import { v6SummaryAtRevision } from "../../apps/web/lib/v6-effective-records";
import { v6FrozenHistory } from "../../apps/web/lib/v6-history-cache";
import { getScopedRecordReleaseDiff } from "../../apps/web/lib/release-diffs";
import type { SupportedLocale } from "../../apps/web/lib/i18n";
import { acceptV6Release } from "../lib/v6-release-contract";
import { exportV6Revision } from "../export-v6-shards";
import { validateChangePackage } from "../lib/change-package";
import { retainChangeRevisions } from "../lib/retain-change-revisions";
import { exportMcpCatalog } from "../export-mcp-catalog";
import { collectContentFiles } from "./file-set";
import { readManifest, releaseDir, selectTree } from "./lib";
import { addReceipts, buildCandidate, checkDecisions, jsha, resolvePublishedAt, type CorrectionDecisions } from "./correction-apply";
import { lintCorrection, resolveLint } from "./correction-lint";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const fail = (message: string): never => { throw new Error(message); };
const raw = (value: unknown) => Buffer.from(JSON.stringify(value));

export function newDir(dir: string) { if (existsSync(dir)) fail(`Output must be a NEW directory: ${dir}`); mkdirSync(dir, { recursive: true }); return dir; }
function save(dir: string, name: string, value: unknown, pretty = false) {
  const file = path.join(dir, name); mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, pretty ? JSON.stringify(value, null, 2) + "\n" : JSON.stringify(value), { flag: "wx" }); return file;
}

/* ----------------------------------------------------------------- sources */

export interface CorrectionSource { root: string; contentRoot?: string; contentId?: string; manifestSha256?: string }

/** The tree corrections start from: the selected content release when a content root is known, else a checkout. */
export function resolveSource(options: { source?: string; contentRoot?: string; sourceRelease?: string }): CorrectionSource {
  if (options.source) return { root: path.resolve(options.source) };
  if (options.contentRoot) {
    const contentRoot = path.resolve(options.contentRoot);
    const contentId = options.sourceRelease ?? readJson(path.join(contentRoot, "current.json")).contentId as string;
    const { bytes } = readManifest(contentRoot, contentId);
    return { root: path.join(releaseDir(contentRoot, contentId), "tree"), contentRoot, contentId, manifestSha256: sha(bytes) };
  }
  return { root: process.cwd() };
}

/** Selected V6 revision of a tree. */
export function loadSelected(dataRoot: string) {
  const view = (family: string, revision: string) => {
    const root = path.join(dataRoot, family);
    return new V6ArtifactStore(root, readJson(path.join(root, "sharded/index.json")) as ShardIndex).view<Json>(revision) ?? fail(`Missing ${family}/${revision}`);
  };
  const revision: string = readJson(path.join(dataRoot, "public-v6-records/current.json")).revision;
  const pages = readJson(path.join(dataRoot, "public-v6-pages/current.json"));
  const history = readJson(path.join(dataRoot, "public-v6-history/current.json"));
  const overviews = readJson(path.join(dataRoot, "public-v6-change-overviews/current.json"));
  if (pages.releaseId !== revision || history.basisRevision !== revision || overviews.revision !== revision) fail("Selected V6 families are not paired");
  return { revision, records: view("public-v6-records", revision), pages: view("public-v6-pages", revision), history: view("public-v6-history", revision) };
}

/** Records summaries at earlier revisions, read from the shard store (cached per revision). */
function summaryReader(dataRoot: string) {
  const root = path.join(dataRoot, "public-v6-records");
  const index = readJson(path.join(root, "sharded/index.json")) as ShardIndex;
  const cache = new Map<string, Json>();
  return (revision: string, slug: string) => {
    if (!Object.hasOwn(index.revisions, revision)) return undefined;
    if (!cache.has(revision)) cache.set(revision, new V6ArtifactStore(root, index).view<Json>(revision));
    return cache.get(revision)?.summaries?.find((summary: Json) => summary.entity.slug === slug);
  };
}

/**
 * A scratch tree in release layout: the source's content file set plus an
 * overlay, hard-linked (copied across devices). The production loaders read it
 * exactly as they will read the built release.
 */
export class MergedTree {
  readonly root: string;
  private constructor(root: string) { this.root = root; }
  static create(source: string, scratch: string, overlay?: string): MergedTree {
    const tree = new MergedTree(newDir(scratch));
    for (const rel of collectContentFiles(source).files) tree.place(rel, path.join(source, rel));
    if (overlay) tree.apply(overlay);
    return tree;
  }
  place(rel: string, from: string) {
    const target = path.join(this.root, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    if (existsSync(target)) unlinkSync(target);
    try { linkSync(from, target); } catch { copyFileSync(from, target, constants.COPYFILE_FICLONE); }
  }
  apply(overlay: string) { for (const rel of walk(overlay)) this.place(rel, path.join(overlay, rel)); }
  select(): void { selectTree(`correction-${randomBytes(6).toString("hex")}`, this.root); }
  remove() { rmSync(this.root, { recursive: true, force: true }); }
}
function walk(root: string, rel = ""): string[] {
  return readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap(entry => {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(root, child) : entry.isFile() ? [child] : [];
  });
}

/* ------------------------------------------------------------------- write */

/** V6 records, pages and history of the new revision next to the source shards; pointers select it inside the overlay only. */
function writeV6Overlay(dataRoot: string, data: string, records: Json, pages: Json, history: Json) {
  const revision: string = records.revision;
  const families: [string, Json][] = [["public-v6-records", records], ["public-v6-pages", pages], ["public-v6-history", history]];
  for (const [family, value] of families) {
    const root = path.join(data, family); mkdirSync(path.join(root, "sharded"), { recursive: true });
    writeFileSync(path.join(root, "sharded/index.json"), readFileSync(path.join(dataRoot, family, "sharded/index.json")));
    const manifest = exportV6Revision(root, family, revision, raw(value));
    // Readback through the shard store with the source objects behind the overlay's.
    const reader = new V6ArtifactStore(root, readJson(path.join(root, "sharded/index.json")));
    if (!isDeepStrictEqual(reader.view(revision), value)) fail(`Shard readback differs: ${family}`);
    const registry = readJson(path.join(dataRoot, family, "revisions.json"));
    registry[revision] = { path: `revisions/${revision}.json`, sha256: manifest.sourceSha256 };
    writeFileSync(path.join(root, "revisions.json"), JSON.stringify(registry, null, 2) + "\n");
    const pointer = family === "public-v6-records" ? { path: `revisions/${revision}.json`, sha256: manifest.sourceSha256, revision }
      : family === "public-v6-pages" ? { path: `revisions/${revision}.json`, sha256: manifest.sourceSha256, releaseId: revision, slugs: pages.slugs }
      : { path: `revisions/${revision}.json`, sha256: manifest.sourceSha256, basisRevision: revision };
    writeFileSync(path.join(root, "current.json"), JSON.stringify(pointer) + "\n");
  }
}

/**
 * Production gates on the candidate tree: every locale of every changed school
 * passes the runtime completeness gate, the declared previous revision reads
 * back with the parent record, the /changes/<revision> diff builds, and the
 * frozen school histories load.
 */
async function productionGates(tree: MergedTree, records: Json, pages: Json, slugs: string[], previous: Record<string, { revision: string; recordSha256: string }>, withHistory: boolean): Promise<string[]> {
  tree.select();
  const problems: string[] = [];
  for (const slug of slugs) {
    for (const locale of Object.keys(pages.locales)) {
      try { getV6PageInput(slug, locale as SupportedLocale); }
      catch (error) { problems.push(`${slug} (${locale}): runtime page gate: ${(error as Error).message}`); }
    }
    const before = v6SummaryAtRevision(slug, previous[slug].revision);
    if (!before || jsha(before) !== previous[slug].recordSha256) problems.push(`${slug}: previousRevisionId ${previous[slug].revision} does not read back the parent record`);
    if (withHistory) { try { v6FrozenHistory(slug); } catch (error) { problems.push(`${slug}: frozen history: ${(error as Error).message}`); } }
  }
  try { if (!await getScopedRecordReleaseDiff(records.revision)) problems.push(`/changes/${records.revision} has no scoped diff`); }
  catch (error) { problems.push(`/changes/${records.revision}: ${(error as Error).message}`); }
  if (withHistory) { try { await historyManifest(); } catch (error) { problems.push(`change history: ${(error as Error).message}`); } }
  return problems;
}

/* ----------------------------------------------------------------- prepare */

export async function prepareCorrection(options: { decisionsFile: string; out: string; source: CorrectionSource; now?: Date }) {
  const decisionsRaw = readFileSync(options.decisionsFile);
  const decisions = JSON.parse(decisionsRaw.toString("utf8")) as CorrectionDecisions;
  const structural = checkDecisions(decisions);
  if (structural.length) fail(`Decisions file is invalid:\n- ${structural.join("\n- ")}`);
  const now = options.now ?? new Date();
  const dataRoot = path.join(options.source.root, "data");
  const out = newDir(path.resolve(options.out));
  const sel = loadSelected(dataRoot);
  const publishedAt = resolvePublishedAt(decisions.publishedAt, now, sel.records.publishedAt);
  const projections = existsSync(path.join(dataRoot, "policy-v6-compact-projections.json")) ? readJson(path.join(dataRoot, "policy-v6-compact-projections.json")).schools : {};
  const candidate = buildCandidate(sel, decisions, { publishedAt, projections, summaryAt: summaryReader(dataRoot) });
  const slugs = Object.keys(decisions.schools);

  const lint = resolveLint(lintCorrection({ slugs, touched: candidate.touched, parent: { records: sel.records, pages: sel.pages }, next: { records: candidate.records, pages: candidate.pages }, presentation: candidate.presentation }), decisions.lintAcknowledgements);

  // Structural acceptance and production gates on scratch receipts (never written to the candidate).
  const gates: string[] = [];
  const scratchPages = structuredClone(candidate.pages);
  addReceipts(scratchPages, candidate.records, slugs, "structural-validation-only", publishedAt);
  let coverage: Json;
  try { coverage = acceptV6Release(scratchPages, candidate.records); } catch (error) { gates.push(`V6 release contract: ${(error as Error).message}`); }
  if (!gates.length) {
    const scratch = path.join(out, ".gate");
    writeV6Overlay(dataRoot, path.join(scratch, "overlay/data"), candidate.records, scratchPages, candidate.history);
    const tree = MergedTree.create(options.source.root, path.join(scratch, "tree"), path.join(scratch, "overlay"));
    try { gates.push(...await productionGates(tree, candidate.records, scratchPages, slugs, previousOf(candidate.report), false)); }
    finally { rmSync(scratch, { recursive: true, force: true }); }
  }
  const ready = lint.blocking.length === 0 && gates.length === 0;
  const files = { records: save(out, "candidate/records.json", candidate.records), pages: save(out, "candidate/pages.json", candidate.pages), history: save(out, "candidate/history.json", candidate.history) };
  const candidateSha256 = { records: sha(readFileSync(files.records)), pages: sha(readFileSync(files.pages)), history: sha(readFileSync(files.history)) };
  const report = { ...candidate.report, ready, preparedAt: now.toISOString(), decisionsSha256: sha(decisionsRaw), author: decisions.author,
    source: { ...options.source, parentRevision: sel.revision, recordsSha256: jsha(sel.records), pagesSha256: jsha(sel.pages), historySha256: jsha(sel.history) },
    candidateSha256, coverage, lint: { blocking: lint.blocking, acknowledged: lint.acknowledged, notes: lint.notes }, gates };
  save(out, "prepare-report.json", report, true);
  writeFileSync(path.join(out, "decisions.input.json"), decisionsRaw, { flag: "wx" });
  save(out, "review-template.json", {
    schemaVersion: "uapt-content-correction-review-v1", revision: decisions.revision, candidateSha256, decision: "pending",
    reviewer: "", reviewedAt: "", scope: "presentation_only",
    checklist: ["Each corrected or added claim matches its quoted official evidence, scope and date", "Entity summary is specific, not generic counts", "zh states the same facts as en", "Every topic summary sentence is supported by that topic's evidence", "No claim is left without a topic", "No placeholder scopes", "Held decisions and original quotes are unchanged"],
    notes: ""
  }, true);
  writeReviewPacket(out, sel, candidate, decisions, lint, gates);
  return { out, revision: decisions.revision, ready, publishedAt, blocking: lint.blocking.length, acknowledged: lint.acknowledged.length, gates };
}

const previousOf = (report: Json) => Object.fromEntries(Object.entries(report.schools as Record<string, Json>).map(([slug, row]) => [slug, { revision: row.previousRevisionId, recordSha256: row.previousRecordSha256 }]));

function writeReviewPacket(out: string, sel: Json, candidate: Json, decisions: CorrectionDecisions, lint: ReturnType<typeof resolveLint>, gates: string[]) {
  const q = (text: string) => String(text).split("\n").map(line => "> " + line).join("\n");
  const lines: string[] = [`# Review packet: ${decisions.revision}`, "", `Parent revision \`${sel.revision}\`. publishedAt ${candidate.records.publishedAt}. Prepared by ${decisions.author}; no reviewer is recorded in the candidate.`, ""];
  if (gates.length || lint.blocking.length) {
    lines.push("## Blocking", "", ...gates.map(g => `- gate: ${g}`), ...lint.blocking.map(f => `- ${f.severity} \`${f.code}\` ${f.slug} ${f.target}: ${f.message}`), "");
  }
  if (lint.acknowledged.length) lines.push("## Acknowledged lint findings", "", ...lint.acknowledged.map(f => `- \`${f.code}\` ${f.slug} ${f.target}: ${f.message} (reason: ${f.reason})`), "");
  for (const slug of Object.keys(decisions.schools)) {
    const before = sel.records.summaries.find((s: Json) => s.entity.slug === slug), after = candidate.records.summaries.find((s: Json) => s.entity.slug === slug);
    lines.push(`## ${after.entity.name} (\`${slug}\`)`, "", `Record ${candidate.records.recordRevisions[slug].previousRevisionId} → ${decisions.revision}; claims ${before.claims.length} → ${after.claims.length}.`, "");
    for (const decision of decisions.schools[slug].claims) {
      const o = before.claims.find((c: Json) => c.id === decision.id), n = after.claims.find((c: Json) => c.id === decision.id);
      lines.push(`### ${decision.action === "add" ? "Added" : "Corrected"}: \`${decision.id}\``, "");
      if (o) lines.push("**Before**", "", q(o.claimText), "");
      lines.push("**After**", "", q(n.claimText), "");
      if (n.claimValue && n.claimValue !== n.claimText) lines.push("claimValue: `" + n.claimValue + "`", "");
      lines.push("Evidence:", ...n.evidence.map((e: Json) => `- ${e.sourceUrl} (${e.sourceSnapshotHash.slice(0, 12)}…, retrieved ${e.retrievedAt}): “${e.evidenceSnippet.replace(/\n/g, " ⏎ ").slice(0, 400)}”`), "");
    }
    const ps = candidate.presentation[slug] ?? {};
    for (const [key, s] of Object.entries(ps.topicSummaries ?? {}) as [string, Json][]) lines.push(`### Topic summary: ${key}`, "", "EN:", q(s.en), "", "ZH:", q(s.zh), "");
    for (const [key, s] of Object.entries(ps.topicScopes ?? {}) as [string, Json][]) lines.push(`### Topic scope: ${key}`, "", "EN:", q(s.en), "", "ZH:", q(s.zh), "");
    if (ps.entitySummary) lines.push("### Entity summary", "", "EN:", q(ps.entitySummary.en), "", "ZH:", q(ps.entitySummary.zh), "");
    for (const [k, ids] of Object.entries(ps.addTopicClaims ?? {}) as [string, string[]][]) lines.push(`### Shown in topic ${k}: ${ids.map(i => "`" + i + "`").join(", ")}`, "");
    for (const [id, s] of Object.entries(ps.claimScopes ?? {})) lines.push(`### Claim scope: \`${id}\``, "", q(String(s)), "");
  }
  writeFileSync(path.join(out, "review-packet.md"), lines.join("\n") + "\n", { flag: "wx" });
}

/* ---------------------------------------------------------------- finalize */

export interface CorrectionReview {
  schemaVersion: "uapt-content-correction-review-v1";
  revision: string;
  candidateSha256: { records: string; pages: string; history: string };
  decision: "accepted";
  reviewer: string;
  reviewedAt: string;
  scope: "presentation_only";
}

/** The review binds the exact candidate bytes and is not signed by the author. */
export function checkReview(review: Json, report: Json, now: Date): string[] {
  const problems: string[] = [];
  if (review?.schemaVersion !== "uapt-content-correction-review-v1") problems.push("review schemaVersion");
  if (review?.revision !== report.revision) problems.push("review names another revision");
  if (!isDeepStrictEqual(review?.candidateSha256, report.candidateSha256)) problems.push("review does not bind this exact candidate");
  if (review?.decision !== "accepted") problems.push("review decision is not accepted");
  if (review?.scope !== "presentation_only") problems.push("review scope must be presentation_only");
  if (!review?.reviewer?.trim()) problems.push("reviewer is required");
  else if (review.reviewer.trim() === String(report.author ?? "").trim()) problems.push("the reviewer must not be the author of the decisions");
  const at = Date.parse(review?.reviewedAt);
  if (!Number.isFinite(at)) problems.push("reviewedAt is not a date");
  else if (at > now.getTime()) problems.push("reviewedAt is in the future");
  else if (at < Date.parse(report.preparedAt)) problems.push("reviewedAt is before the candidate was prepared");
  return problems;
}

export async function finalizeCorrection(options: { candidate: string; reviewFile: string; out: string; localeIndexPolicy?: string; now?: Date }) {
  const now = options.now ?? new Date();
  const cand = path.resolve(options.candidate);
  const report = readJson(path.join(cand, "prepare-report.json"));
  if (!report.ready) fail("The candidate did not pass prepare (lint or gates); fix the decisions and prepare again");
  const decisions = readJson(path.join(cand, "decisions.input.json")) as CorrectionDecisions;
  const review = readJson(options.reviewFile) as CorrectionReview;
  const reviewProblems = checkReview(review, report, now);
  if (reviewProblems.length) fail(`Review is not acceptable: ${reviewProblems.join("; ")}`);
  const source = report.source as CorrectionSource & { parentRevision: string; recordsSha256: string; pagesSha256: string; historySha256: string };
  if (source.contentRoot && source.contentId && sha(readManifest(source.contentRoot, source.contentId).bytes) !== source.manifestSha256) fail("Source release manifest changed since prepare");
  const dataRoot = path.join(source.root, "data");
  const sel = loadSelected(dataRoot);
  if (sel.revision !== source.parentRevision || jsha(sel.records) !== source.recordsSha256 || jsha(sel.pages) !== source.pagesSha256 || jsha(sel.history) !== source.historySha256) fail("Selected parent changed since prepare");
  const read = (name: string) => { const bytes = readFileSync(path.join(cand, `candidate/${name}.json`)); if (sha(bytes) !== report.candidateSha256[name]) fail(`Candidate ${name} changed since prepare`); return JSON.parse(bytes.toString("utf8")); };
  const records = read("records"), pages = read("pages"), history = read("history");
  const slugs = Object.keys(decisions.schools), revision: string = records.revision;
  const out = newDir(path.resolve(options.out));

  addReceipts(pages, records, slugs, review.reviewer.trim(), new Date(review.reviewedAt).toISOString());
  const coverage = acceptV6Release(pages, records);
  const overlay = path.join(out, "overlay"), data = path.join(overlay, "data");
  writeV6Overlay(dataRoot, data, records, pages, history);
  const tree = MergedTree.create(source.root, path.join(out, ".tree"), overlay);
  try {
    // Changes v2: frozen projection input of the source + one scoped event source per changed school.
    const historyDir = path.join(dataRoot, "public-change-history"), current = readJson(path.join(historyDir, "current.json"));
    const oldStore = new ChangeEventStore(historyDir, current), input = structuredClone(oldStore.input()) as ChangeProjectionInput;
    input.revision = revision;
    // The v2 basis binds the selected V6 pointers, registries and indexes: compute it on the new tree.
    input.basisSha256 = await publicHistoryBasisV2(tree.root);
    const summaries = new Map<string, Json>(records.summaries.map((s: Json) => [s.entity.slug, s]));
    const parentSummaries = new Map<string, Json>(sel.records.summaries.map((s: Json) => [s.entity.slug, s]));
    const changedRevisionsBySlug: Record<string, string[]> = Object.fromEntries(Object.keys(input.schools).map(slug => [slug, []]));
    for (const slug of slugs) {
      const school = input.schools[slug] ?? fail(`Projection lacks school ${slug}`), now = summaries.get(slug), pin = records.recordRevisions[slug];
      if (school.currentRecordSha256 !== jsha(parentSummaries.get(slug))) fail(`Projection basis drift: ${slug}`);
      const page = pages.locales.en.schools.find((s: Json) => s.slug === slug), prevPage = sel.pages.locales.en.schools.find((s: Json) => s.slug === slug);
      const claimThemes: Record<string, string[]> = {};
      for (const t of [...page.topics, ...page.additionalTopics, ...prevPage.topics, ...prevPage.additionalTopics]) for (const c of t.claims) claimThemes[c.id] = [...new Set([...(claimThemes[c.id] ?? []), t.key])];
      const eventSource: ScopedEventSource = { kind: "scoped", slug, revision, previousRevision: pin.previousRevisionId, publishedAt: pin.publishedAt, current: now, before: parentSummaries.get(slug),
        held: records.heldBySlug[slug] ?? [], changes: records.changesBySlug[slug], gaps: [], metadataChanged: true, claimThemes };
      const firstScoped = school.sources.findIndex(s => s.kind === "scoped");
      school.sources.splice(firstScoped < 0 ? school.sources.length : firstScoped, 0, eventSource);
      school.currentRecordSha256 = pin.recordSha256; school.currentRevision = revision; school.currentClaimIds = now.claims.map((c: Json) => c.id);
      school.themeOrder = [...page.topics, ...page.additionalTopics].map((t: Json) => t.key);
      changedRevisionsBySlug[slug] = [revision];
    }
    const histories = buildEventHistories(input);
    for (const slug of slugs) if (!histories[slug].events.some(e => e.revision === revision)) fail(`No change event produced for ${slug}`);
    const ch = path.join(data, "public-change-history"); mkdirSync(path.join(ch, "objects"), { recursive: true });
    const put = (value: unknown) => { const bytes = raw(value), hash = sha(bytes), file = `objects/${hash}.json`; if (!existsSync(path.join(ch, file))) writeFileSync(path.join(ch, file), bytes); return { file, sha256: hash, bytes: bytes.length }; };
    const copyRef = (ref: Json) => { const bytes = readFileSync(path.join(historyDir, ref.file)); if (sha(bytes) !== ref.sha256) fail("Frozen history object changed"); if (!existsSync(path.join(ch, ref.file))) writeFileSync(path.join(ch, ref.file), bytes); return ref; };
    const m = oldStore.manifest;
    const entries = Object.fromEntries(Object.entries(m.entries).map(([k, r]) => [k, copyRef(r)])), releases = Object.fromEntries(Object.entries(m.releases).map(([k, r]) => [k, copyRef(r)]));
    const eventHistories = Object.fromEntries(Object.entries(histories).map(([slug, h]) => [slug, put(h)]));
    const eventIndex = put(Object.values(histories).flatMap(h => h.events.map(e => ({ ...eventPreview(e), slug: h.slug }))).sort((a, b) => (Date.parse(b.publishedAt ?? "") || 0) - (Date.parse(a.publishedAt ?? "") || 0) || a.id.localeCompare(b.id)));
    const manifest = { schemaVersion: "uapt-public-change-history-v2", revision, basisSha256: input.basisSha256, rulesVersion: input.rulesVersion, projectionInput: put(input), entries, releases, eventHistories, eventIndex };
    const mBytes = raw(manifest), mSha = sha(mBytes), mFile = `manifest-${mSha}.json`;
    writeFileSync(path.join(ch, mFile), mBytes);
    const overviews: ChangeOverviewPackage = { schemaVersion: "uapt-v6-change-overviews-v1", revision, projectionSha256: mSha, basisSha256: input.basisSha256, rulesVersion: input.rulesVersion,
      schools: Object.fromEntries(Object.entries(histories).filter(([, h]) => h.currentRecordSha256).map(([slug, h]) => [slug, buildChangeOverview(h, mSha)])) };
    if (!isDeepStrictEqual(Object.keys(overviews.schools).sort(), [...pages.slugs].sort())) fail("Overview scope differs from V6 scope");
    for (const slug of pages.slugs) if (overviews.schools[slug].recordSha256 !== records.recordRevisions[slug].recordSha256) fail(`Overview/record mismatch: ${slug}`);
    const ov = path.join(data, "public-v6-change-overviews"); mkdirSync(path.join(ov, "sharded"), { recursive: true }); mkdirSync(path.join(ov, "revisions"), { recursive: true });
    writeFileSync(path.join(ov, "sharded/index.json"), readFileSync(path.join(dataRoot, "public-v6-change-overviews/sharded/index.json")));
    const ovBytes = raw(overviews);
    exportV6Revision(ov, "public-v6-change-overviews", revision, ovBytes);
    writeFileSync(path.join(ov, `revisions/${revision}.json`), ovBytes);
    writeFileSync(path.join(ov, "current.json"), JSON.stringify({ revision, path: `revisions/${revision}.json`, sha256: sha(ovBytes) }) + "\n");
    // Validate the new package as the packer does, then retain every prior projection revision.
    const scratch = path.join(out, ".validate-history"); mkdirSync(path.join(scratch, "objects"), { recursive: true });
    for (const rel of walk(ch)) { mkdirSync(path.dirname(path.join(scratch, rel)), { recursive: true }); writeFileSync(path.join(scratch, rel), readFileSync(path.join(ch, rel))); }
    validateChangePackage(scratch, { path: mFile, sha256: mSha }, overviews);
    rmSync(scratch, { recursive: true });
    const retained = retainChangeRevisions(dataRoot, data);
    writeFileSync(path.join(ch, "current.json"), JSON.stringify({ path: mFile, sha256: mSha }) + "\n");
    // Source-hash provenance: explicit raw-capture bindings for the new snapshots.
    const provenance = readJson(path.join(dataRoot, "source-hash-provenance.json")) as SourceHashRegistry;
    const bindings = Object.values(decisions.captures).map(c => ({ sourceUrl: c.sourceUrl, snapshotHash: c.snapshotHash, hashKind: "raw_captured_bytes" as const, rawSha256: c.snapshotHash,
      verification: c.verification ?? `capture receipt ${c.packageId}${c.textSha256 ? `; extracted text sha256 ${c.textSha256}` : ""}` }));
    writeFileSync(path.join(data, "source-hash-provenance.json"), JSON.stringify(mergeSourceHashRegistry(provenance, bindings), null, 2) + "\n");

    // Production gates on the complete candidate tree, then the MCP catalog it serves.
    tree.apply(overlay);
    const gates = await productionGates(tree, records, pages, slugs, previousOf(report), true);
    if (gates.length) fail(`Production gates failed on the finalized tree:\n- ${gates.join("\n- ")}`);
    const mcp = await exportMcpCatalog({ root: tree.root, output: path.join(out, "mcp/catalog.json") });
    for (const slug of slugs) {
      const row = mcp.coverage.find(item => item.slug === slug);
      if (!row || row.revision !== revision) return fail(`MCP catalog does not serve ${slug} at ${revision}`);
      const ids = records.summaries.find((s: Json) => s.entity.slug === slug).claims.map((c: Json) => c.id).sort();
      if (!isDeepStrictEqual([...row.claimIds].sort(), ids)) fail(`MCP catalog Claim IDs differ from the record for ${slug}`);
    }

    // Locale-index policy: move each changed school's entry to its new record.
    const policyNotes: string[] = [];
    const policySource = options.localeIndexPolicy ?? (source.contentRoot && source.contentId ? parentPolicyFile(source.contentRoot, source.contentId) : undefined);
    let policyFile: string | undefined;
    if (policySource) {
      const policy = readJson(policySource);
      if (policy.schemaVersion !== "uapt-university-locale-index-policy-v1") fail("Not a university locale-index policy");
      for (const slug of slugs) {
        const entry = policy.schools?.[slug];
        if (!entry) { policyNotes.push(`${slug}: no locale-index entry (default locales only)`); continue; }
        if (entry.recordSha256 !== report.schools[slug].previousRecordSha256) policyNotes.push(`${slug}: entry was bound to ${entry.recordSha256}, not the parent record; rebound to the new record`);
        entry.recordSha256 = records.recordRevisions[slug].recordSha256;
      }
      policyFile = save(out, "locale-index-policy.json", policy, true);
    } else policyNotes.push("No locale-index policy source (pass --locale-index-policy or prepare from a content root); changed schools keep only their default index locales until it is supplied");

    const manifestDecisions = { correctedClaimIds: Object.fromEntries(slugs.map(s => [s, [...records.changesBySlug[s].updatedClaimIds]])), removedClaimIds: {}, releasedHeldClaimIds: {} };
    save(out, "decisions.json", manifestDecisions, true);
    save(out, "claim-decisions.json", { schemaVersion: "uapt-explicit-claim-decisions-v1", revision, schools: Object.fromEntries(slugs.map(s => [s, { corrected: records.changesBySlug[s].updatedClaimIds, added: records.changesBySlug[s].addedClaimIds, removed: [], heldReleased: [], publicClaimIds: records.summaries.find((x: Json) => x.entity.slug === s).claims.map((c: Json) => c.id) }])) }, true);
    save(out, "projection.json", { manifest: mFile, sha256: mSha, overviewSha256: sha(ovBytes), basisSha256: input.basisSha256, rulesVersion: input.rulesVersion, revision, changedRevisionsBySlug, retained }, true);
    const build = ["pnpm content:build --content-root \"$UAPT_CONTENT_ROOT\" --content-id <new content id>",
      source.contentId ? `--source-release ${source.contentId}` : `--source ${source.root}`,
      `--overlay ${overlay}`, `--mcp-catalog ${path.join(out, "mcp/catalog.json")}`, `--decisions ${path.join(out, "decisions.json")}`,
      ...(policyFile ? [`--locale-index-policy ${policyFile}`] : []), "[--translations-pointer <record-delta package>/current.json]"].join(" \\\n  ");
    writeFileSync(path.join(out, "content-build.sh.txt"), build + "\n", { flag: "wx" });
    const result = { schemaVersion: "uapt-content-correction-finalize-v1", revision, reviewer: review.reviewer, reviewedAt: review.reviewedAt, publishedAt: records.publishedAt, coverage,
      recordsSha256: sha(raw(records)), pagesSha256: sha(raw(pages)), historySha256: sha(raw(history)), projection: mSha,
      mcp: { releaseId: mcp.releaseId, catalogDigest: mcp.catalogDigest, universities: mcp.universities }, localeIndexPolicy: policyFile ? { file: policyFile, sha256: sha(readFileSync(policyFile)) } : null,
      notes: policyNotes, events: slugs.map(s => histories[s].events.find(e => e.revision === revision)), source, currentPointerSelected: false, publicationPerformed: false };
    save(out, "finalize-report.json", result, true);
    return { out, revision, projection: mSha, mcp: result.mcp, localeIndexPolicy: result.localeIndexPolicy, notes: policyNotes, build };
  } finally { tree.remove(); }
}

function parentPolicyFile(contentRoot: string, contentId: string): string | undefined {
  const { manifest } = readManifest(contentRoot, contentId);
  return manifest.localeIndexPolicy ? path.join(releaseDir(contentRoot, contentId), "tree", manifest.localeIndexPolicy.path) : undefined;
}

/* --------------------------------------------------------------------- CLI */

const USAGE = `usage:
  content:correct prepare  --decisions <file> --out <NEW dir> [--source <dir> | --content-root <root> [--source-release <id>]]
  content:correct finalize --candidate <prepare dir> --review <review.json> --out <NEW dir> [--locale-index-policy <file>]
  content:correct translations plan     --candidate <finalize dir> --out <plan.json> [--package <dir> --pointer <file>]
  content:correct translations template --plan <plan.json> --translations <dir> --translator <id> --out <review.json>
  content:correct translations build    --plan <plan.json> --translations <dir> --review <review.json> --out <NEW package dir>`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
  const need = (name: string) => arg(name) ?? (console.error(`${name} is required\n${USAGE}`), process.exit(2));
  const [command, sub] = [process.argv[2], process.argv[3]];
  const run = async () => {
    if (command === "prepare") {
      const source = resolveSource({ source: arg("--source"), contentRoot: arg("--content-root") ?? process.env.UAPT_CONTENT_ROOT, sourceRelease: arg("--source-release") });
      const result = await prepareCorrection({ decisionsFile: need("--decisions"), out: need("--out"), source });
      console.log(JSON.stringify(result, null, 2));
      if (!result.ready) process.exitCode = 1;
    } else if (command === "finalize") {
      console.log(JSON.stringify(await finalizeCorrection({ candidate: need("--candidate"), reviewFile: need("--review"), out: need("--out"), localeIndexPolicy: arg("--locale-index-policy") }), null, 2));
    } else if (command === "translations") {
      const delta = await import("./reading-delta");
      if (sub === "plan") console.log(JSON.stringify(await delta.planRecordDeltas({ finalized: need("--candidate"), out: need("--out"), packageDir: arg("--package"), pointer: arg("--pointer") }), null, 2));
      else if (sub === "template") console.log(JSON.stringify(delta.reviewTemplate({ plan: need("--plan"), translations: need("--translations"), translator: need("--translator"), out: need("--out") }), null, 2));
      else if (sub === "build") console.log(JSON.stringify(await delta.buildRecordDeltaPackage({ plan: need("--plan"), translations: need("--translations"), review: need("--review"), out: need("--out") }), null, 2));
      else { console.error(USAGE); process.exitCode = 2; }
    } else { console.error(USAGE); process.exitCode = 2; }
  };
  run().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}

