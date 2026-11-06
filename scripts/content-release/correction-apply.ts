/**
 * Decisions file and record/page transforms for `content:correct`.
 * Generalized from the 2026-11-06 nine-school generator
 * (`reviewed-corrections.ts` on claude/content-9-schools-5fce2c) and the
 * per-correction scripts (`scripts/prepare-v6-audit-correction.py`,
 * `scripts/finalize-v6-audit-correction.ts`). Pure functions: no file I/O.
 */
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { publicEntitySummarySchema } from "@uapt/shared";
import { editorialContentHash } from "../../apps/web/lib/policy-v6-editorial-projection";
import { presentationEvidenceHash } from "../../apps/web/lib/policy-v6-presentation-evidence";
import { toolPresentationHash } from "../../apps/web/lib/policy-v6-tool-presentation";
import { v6CompletenessContentHash } from "../../apps/web/lib/policy-v6-completeness";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
export const jsha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const clone = <T>(value: T): T => structuredClone(value);
const fail = (message: string): never => { throw new Error(message); };
const RIGHTS = "Official university source retains its rights; tracker interpretations are separate from original English evidence.";
const SHA = /^[a-f0-9]{64}$/;

export interface Bilingual { en: string; zh: string }
export interface Capture {
  sourceUrl: string; finalUrl?: string; snapshotHash: string; retrievedAt: string;
  citationTitle: string; publisher: string; sourceType: string;
  /** Raw capture provenance; one of packageId/verification is required. */
  packageId?: string; textSha256?: string; verification?: string;
}
export interface EvidenceDecision { capture?: string; sourceUrl?: string; snapshotHash?: string; quote: string; location: string; display?: string }
export interface ClaimDecision {
  action: "add" | "correct" | "amend";
  id: string;
  claimType?: string; claimText?: string; claimValue?: string; confidence?: number;
  evidence: EvidenceDecision[];
  /** correct: earlier evidence IDs to keep after the new evidence. */
  keepEvidenceIds?: string[];
  /** add: place after this Claim ID (default: end). */
  insertAfter?: string;
  /** amend: text appended to the claim; claimValue follows when it mirrored the text. */
  appendText?: string; claimValueMirrorsText?: boolean; claimValueAppend?: Record<string, string>;
  /** Topics that show this claim (shorthand for presentation.addTopicClaims). */
  topics?: string[];
}
export interface ToolDecision { match: string; set?: Record<string, unknown>; appendHowToObtain?: string; appendDescription?: string; evidence?: EvidenceDecision[]; replaceEvidence?: EvidenceDecision[] }
export interface PresentationDecision {
  entitySummary?: Bilingual;
  topicSummaries?: Record<string, Bilingual>;
  topicScopes?: Record<string, Bilingual>;
  statusOverrides?: Record<string, Bilingual & { status: string }>;
  claimScopes?: Record<string, string>;
  addTopicClaims?: Record<string, string[]>;
  replacePresentationEvidence?: Json[];
  presentationTitles?: Record<string, string>;
  gaps?: Record<string, string>;
  addGaps?: string[];
  dispositionReasons?: Record<string, string>;
  /** Dispositions for added claims, where the school's view dispositions every claim. */
  dispositions?: Record<string, { mode: "scoped_reference" | "historical_only" | "excluded_pending_review"; scope: string; reason: string }>;
  /** Build a complete bilingual view from the accepted compact projection (schools on frozen legacy inputs). */
  convertToView?: "compactProjection";
  heroTitleZh?: string;
}
export interface SchoolDecision { claims: ClaimDecision[]; tools?: ToolDecision[]; presentation?: PresentationDecision }
export interface CorrectionDecisions {
  schemaVersion: "uapt-content-correction-v1";
  /** New V6 revision id. */
  revision: string;
  /** Defaults to build time; a future date is refused. */
  publishedAt?: string;
  /** Who prepared the decisions; the reviewer in finalize must be someone else. */
  author: string;
  changeSummary: Bilingual;
  approval: { publication: string; review?: { document: string; sha256: string } };
  captures: Record<string, Capture>;
  schools: Record<string, SchoolDecision>;
  lintAcknowledgements?: { code: string; slug: string; target: string; reason: string }[];
}

/** Structural checks before anything is built; returns every problem found. */
export function checkDecisions(value: Json): string[] {
  const problems: string[] = [];
  const need = (ok: unknown, message: string) => { if (!ok) problems.push(message); };
  need(value?.schemaVersion === "uapt-content-correction-v1", "schemaVersion must be uapt-content-correction-v1");
  need(typeof value?.revision === "string" && /^v6-[a-z0-9-]{3,80}$/.test(value.revision), "revision must match v6-[a-z0-9-]+");
  need(typeof value?.author === "string" && value.author.trim(), "author is required");
  need(value?.changeSummary?.en?.trim() && value?.changeSummary?.zh?.trim(), "changeSummary needs en and zh");
  need(typeof value?.approval?.publication === "string" && value.approval.publication.trim().length >= 10, "approval.publication must record who approved publication");
  need(value?.publishedAt === undefined || Number.isFinite(Date.parse(value.publishedAt)), "publishedAt must be an ISO date when given");
  const captures = value?.captures ?? {};
  for (const [key, cap] of Object.entries(captures) as [string, Json][]) {
    need(/^https?:\/\//.test(cap?.sourceUrl ?? ""), `capture ${key}: sourceUrl must be http(s)`);
    need(SHA.test(cap?.snapshotHash ?? ""), `capture ${key}: snapshotHash must be 64-hex`);
    need(Number.isFinite(Date.parse(cap?.retrievedAt)), `capture ${key}: retrievedAt must be an ISO date`);
    need(cap?.citationTitle && cap?.publisher && cap?.sourceType, `capture ${key}: citationTitle, publisher and sourceType are required`);
    need(cap?.packageId || cap?.verification, `capture ${key}: packageId or verification (raw capture provenance) is required`);
    need(cap?.textSha256 === undefined || SHA.test(cap.textSha256), `capture ${key}: textSha256 must be 64-hex`);
  }
  const schools = value?.schools ?? {};
  need(Object.keys(schools).length > 0, "schools must name at least one school");
  for (const [slug, school] of Object.entries(schools) as [string, Json][]) {
    need(Array.isArray(school?.claims), `${slug}: claims must be a list`);
    const ids = new Set<string>();
    for (const claim of school?.claims ?? []) {
      const where = `${slug}/${claim?.id}`;
      need(typeof claim?.id === "string" && claim.id.trim(), `${slug}: every claim decision needs an id`);
      need(!ids.has(claim?.id), `${where}: decided twice`); ids.add(claim?.id);
      need(["add", "correct", "amend"].includes(claim?.action), `${where}: action must be add, correct or amend`);
      if (claim?.action !== "amend") need(claim?.claimType && claim?.claimText?.trim() && typeof claim?.confidence === "number", `${where}: claimType, claimText and confidence are required`);
      else need(claim?.appendText?.trim(), `${where}: amend needs appendText`);
      need(Array.isArray(claim?.evidence) && claim.evidence.length > 0, `${where}: evidence quotes are required`);
      for (const evidence of claim?.evidence ?? []) problems.push(...evidenceProblems(evidence, captures, where));
    }
    for (const tool of school?.tools ?? []) for (const evidence of [...(tool?.evidence ?? []), ...(tool?.replaceEvidence ?? [])]) problems.push(...evidenceProblems(evidence, captures, `${slug}/tool ${tool?.match}`));
  }
  for (const ack of value?.lintAcknowledgements ?? []) need(ack?.code && ack?.slug && ack?.target && ack?.reason?.trim()?.length >= 10, "lint acknowledgements need code, slug, target and a reason");
  return problems;
}

function evidenceProblems(evidence: Json, captures: Record<string, Capture>, where: string): string[] {
  const problems: string[] = [];
  if (!evidence?.quote?.trim()) problems.push(`${where}: evidence quote is empty`);
  if (!evidence?.location?.trim()) problems.push(`${where}: evidence location is required`);
  try { captureFor(evidence, captures); } catch (error) { problems.push(`${where}: ${(error as Error).message}`); }
  return problems;
}

/** The capture an evidence decision cites: by key, or by exact URL + snapshot hash. */
export function captureFor(evidence: EvidenceDecision, captures: Record<string, Capture>): { key: string; capture: Capture } {
  if (evidence.capture) {
    const capture = captures[evidence.capture] ?? fail(`unknown capture ${evidence.capture}`);
    if ((evidence.sourceUrl && evidence.sourceUrl !== capture.sourceUrl) || (evidence.snapshotHash && evidence.snapshotHash !== capture.snapshotHash)) fail(`evidence URL/hash differ from capture ${evidence.capture}`);
    return { key: evidence.capture, capture };
  }
  const found = Object.entries(captures).find(([, capture]) => capture.sourceUrl === evidence.sourceUrl && capture.snapshotHash === evidence.snapshotHash);
  if (!found) fail(`no capture declared for ${evidence.sourceUrl} @ ${evidence.snapshotHash}`);
  return { key: found![0], capture: found![1] };
}

/** publishedAt: build time unless given; never in the future, never before the parent revision. */
export function resolvePublishedAt(declared: string | undefined, now: Date, parentPublishedAt?: string): string {
  const value = declared ?? now.toISOString();
  const at = Date.parse(value);
  if (!Number.isFinite(at)) fail(`publishedAt is not a date: ${value}`);
  if (at > now.getTime()) fail(`publishedAt ${value} is in the future (build time ${now.toISOString()}); pages would show an unpublished date and the history order breaks`);
  if (parentPublishedAt && Number.isFinite(Date.parse(parentPublishedAt)) && at < Date.parse(parentPublishedAt)) fail(`publishedAt ${value} is before the parent revision (${parentPublishedAt})`);
  return new Date(at).toISOString();
}

/**
 * The previous revision a school's change event and /changes/<revision> diff
 * read. It must be a V6 records revision that holds this school's exact
 * parent summary; a dataset release id or a records-only candidate breaks the
 * production diff (CMU and Edinburgh, 2026-11-06).
 */
export function resolvePreviousRevision(slug: string, candidates: (string | undefined)[], parentRecordSha256: string, summaryAt: (revision: string, slug: string) => Json | undefined): string {
  const tried: string[] = [];
  for (const revision of candidates) {
    if (!revision || tried.includes(revision)) continue;
    tried.push(revision);
    const summary = summaryAt(revision, slug);
    if (summary && jsha(summary) === parentRecordSha256) return revision;
  }
  return fail(`${slug}: no readable V6 revision holds the parent record (tried ${tried.join(", ") || "none"})`);
}

/* ------------------------------------------------------------------ records */

function attributionFor(key: string, cap: Capture) {
  return { id: `src-${key}-${cap.snapshotHash.slice(0, 12)}`, sourceUrl: cap.sourceUrl, ...(cap.finalUrl ? { finalUrl: cap.finalUrl } : {}), citationTitle: cap.citationTitle, publisher: cap.publisher,
    retrievedAt: cap.retrievedAt, trackerCheckedAt: cap.retrievedAt, snapshotHash: cap.snapshotHash, sourceType: cap.sourceType, official: true, sourceRights: RIGHTS };
}
function evidenceFor(decisions: CorrectionDecisions, claimId: string, evidence: EvidenceDecision, id: string) {
  const { key, capture } = captureFor(evidence, decisions.captures);
  return { id, sourceUrl: capture.sourceUrl, sourceLanguage: "en", sourceSnapshotHash: capture.snapshotHash, evidenceSnippet: evidence.quote,
    ...(evidence.display ? { evidenceSnippetDisplay: evidence.display } : {}), snippetLocation: evidence.location, retrievedAt: capture.retrievedAt, attribution: attributionFor(key, capture) };
}
function orderedClaim(claim: Json) {
  const keys = ["id", "entitySlug", "entityType", "claimType", "claimText", "claimValue", "confidence", "reviewState", "lastCheckedAt", "lastChangedAt", "evidence"];
  return Object.fromEntries([...keys.filter(k => claim[k] !== undefined).map(k => [k, claim[k]]), ...Object.keys(claim).filter(k => !keys.includes(k)).map(k => [k, claim[k]])]);
}
/** Checked dates are the capture times of the cited evidence, never the publication or review date. */
const newestRetrieved = (evidence: Json[]) => evidence.map(item => item.retrievedAt).filter(Boolean).sort((a: string, b: string) => Date.parse(a) - Date.parse(b)).at(-1);
const later = (a: string | undefined, b: string | undefined) => !a ? b : !b ? a : Date.parse(b) > Date.parse(a) ? b : a;

export function applyClaims(decisions: CorrectionDecisions, slug: string, summary: Json, publishedAt: string) {
  const school = decisions.schools[slug], added: string[] = [], updated: string[] = [];
  const claims = summary.claims as Json[];
  const claimsBefore = claims.length, sourcesBefore = summary.officialSources.length;
  const tag = publishedAt.slice(0, 10).replaceAll("-", "");
  const freshEvidence = (claimId: string, list: EvidenceDecision[], taken: Set<string>) => list.map((item, index) => {
    let id = `ev-${claimId}-${tag}-${index + 1}`;
    for (let n = 2; taken.has(id); n++) id = `ev-${claimId}-${tag}-${index + 1}-${n}`;
    taken.add(id);
    return evidenceFor(decisions, claimId, item, id);
  });
  for (const decision of school.claims) {
    const at = claims.findIndex(claim => claim.id === decision.id);
    if (decision.action === "add") {
      if (at >= 0) fail(`Added Claim ID already exists: ${slug}/${decision.id}`);
      const evidence = freshEvidence(decision.id, decision.evidence, new Set());
      const claim = orderedClaim({ id: decision.id, entitySlug: slug, entityType: "university", claimType: decision.claimType, claimText: decision.claimText, claimValue: decision.claimValue,
        confidence: decision.confidence, reviewState: "agent_reviewed", lastCheckedAt: newestRetrieved(evidence), lastChangedAt: publishedAt, evidence });
      const after = decision.insertAfter ? claims.findIndex(item => item.id === decision.insertAfter) : -1;
      if (decision.insertAfter && after < 0) fail(`insertAfter ${decision.insertAfter} is not a claim of ${slug}`);
      claims.splice(after >= 0 ? after + 1 : claims.length, 0, claim);
      added.push(decision.id);
      continue;
    }
    if (at < 0) fail(`Corrected Claim ID missing: ${slug}/${decision.id}`);
    const old = claims[at], next: Json = clone(old);
    const fresh = freshEvidence(decision.id, decision.evidence, new Set(old.evidence.map((item: Json) => item.id)));
    if (decision.action === "amend") {
      next.claimText = old.claimText + decision.appendText;
      if (decision.claimValueMirrorsText) next.claimValue = next.claimText;
      if (decision.claimValueAppend) { const value = JSON.parse(old.claimValue); for (const [k, s] of Object.entries(decision.claimValueAppend)) value[k] = (value[k] ?? "") + s; next.claimValue = JSON.stringify(value); }
      next.evidence = [...old.evidence, ...fresh];
    } else {
      next.claimType = decision.claimType; next.claimText = decision.claimText; next.confidence = decision.confidence;
      if (decision.claimValue !== undefined) next.claimValue = decision.claimValue;
      const keep = decision.keepEvidenceIds ?? [];
      const missing = keep.filter(id => !old.evidence.some((item: Json) => item.id === id));
      if (missing.length) fail(`Kept evidence missing for ${slug}/${decision.id}: ${missing.join(", ")}`);
      next.evidence = [...fresh, ...old.evidence.filter((item: Json) => keep.includes(item.id))];
    }
    next.reviewState = "agent_reviewed"; next.lastCheckedAt = newestRetrieved(next.evidence); next.lastChangedAt = publishedAt;
    claims[at] = orderedClaim(next);
    updated.push(decision.id);
  }
  // Attributions for the new captures; earlier attributions remain as historical context.
  const used = new Set<string>();
  for (const decision of school.claims) for (const item of decision.evidence) used.add(captureFor(item, decisions.captures).key);
  for (const key of used) {
    const attribution = attributionFor(key, decisions.captures[key]);
    if (!summary.officialSources.some((source: Json) => source.id === attribution.id)) summary.officialSources.push(attribution);
  }
  // Counts in the record's own prose follow the new sets.
  const recount = (text: string) => text
    .replace(new RegExp(`\\b${claimsBefore} (source-backed AI policy claim records|reviewed current record claims|reviewed current claims|current source-backed claims)\\b`), `${claims.length} $1`)
    .replace(new RegExp(`\\b${sourcesBefore} (official source attributions)\\b`), `${summary.officialSources.length} $1`);
  if (summary.entity.summary) summary.entity.summary = recount(summary.entity.summary);
  summary.summary = recount(summary.summary);
  summary.lastChangedAt = publishedAt;
  summary.lastCheckedAt = later(summary.lastCheckedAt, newestRetrieved([...used].map(key => decisions.captures[key])));
  return { added, updated };
}

export function applyTools(decisions: CorrectionDecisions, slug: string, tools: Json[]) {
  const renamed: Record<string, string> = {};
  for (const decision of decisions.schools[slug].tools ?? []) {
    const tool = tools.find(item => item.rawToolName === decision.match) ?? fail(`Tool ${decision.match} missing for ${slug}`);
    const evidence = (item: EvidenceDecision) => { const { capture } = captureFor(item, decisions.captures); return { sourceUrl: capture.sourceUrl, evidenceSnippet: item.quote, snapshotHash: capture.snapshotHash, reviewState: "agent_reviewed" }; };
    if (decision.set) Object.assign(tool, decision.set);
    if (decision.appendHowToObtain) tool.howToObtain += decision.appendHowToObtain;
    if (decision.appendDescription) tool.description += decision.appendDescription;
    if (decision.replaceEvidence) tool.evidence = decision.replaceEvidence.map(evidence);
    if (decision.evidence) tool.evidence = [...tool.evidence, ...decision.evidence.map(evidence)];
    if (typeof decision.set?.rawToolName === "string") renamed[decision.match] = decision.set.rawToolName;
  }
  return renamed;
}

/* -------------------------------------------------------------------- pages */

const PRESENTATION_FIELDS: Record<string, (claim: Json, evidence: Json) => unknown> = {
  quote: (_c, e) => e.evidenceSnippet, url: (_c, e) => e.sourceUrl, title: (_c, e) => e.attribution.citationTitle, language: (_c, e) => e.sourceLanguage ?? "und",
  location: (_c, e) => e.snippetLocation ?? "", retrievedAt: (_c, e) => e.retrievedAt, hash: (_c, e) => e.sourceSnapshotHash
};
/** A presentation copy of a record claim in the copy's own field layout. */
function presentationCopy(template: Json | undefined, claim: Json) {
  const keys = template?.evidence?.[0] ? Object.keys(template.evidence[0]) : ["quote", "url", "title", "language", "location", "retrievedAt", "hash"];
  const out: Json = template ? clone(template) : { id: claim.id, text: claim.claimText, checkedAt: claim.lastCheckedAt };
  out.text = claim.claimText;
  if ("checkedAt" in out) out.checkedAt = claim.lastCheckedAt;
  if ("claimType" in out) out.claimType = claim.claimType;
  out.evidence = claim.evidence.map((e: Json) => Object.fromEntries(keys.filter(k => PRESENTATION_FIELDS[k]).map(k => [k, PRESENTATION_FIELDS[k](claim, e)])));
  return out;
}
const actionRow = (template: Json, claim: Json) => ({ ...clone(template), id: claim.id, text: claim.claimText,
  ...(template.claimType !== undefined ? { claimType: claim.claimType } : {}),
  evidence: claim.evidence.map((e: Json) => ({ quote: e.evidenceSnippet, url: e.sourceUrl, language: e.sourceLanguage ?? "und", hash: e.sourceSnapshotHash, location: e.snippetLocation ?? "" })) });

const sourceKey = (url: string, hash: string) => url + "\u0000" + hash;
const evidenceKeys = (topic: Json) => new Set<string>(topic.claims.flatMap((c: Json) => c.evidence.filter((e: Json) => e.hash).map((e: Json) => sourceKey(e.url, e.hash))));
function refreshTopicSources(topic: Json, before: Set<string>) {
  const after = evidenceKeys(topic);
  const removed = [...before].filter(k => !after.has(k));
  topic.sources = topic.sources.filter((s: Json) => !removed.includes(sourceKey(s.url, s.hash)));
  for (const k of after) if (!topic.sources.some((s: Json) => sourceKey(s.url, s.hash) === k)) { const [url, hash] = k.split("\u0000"); topic.sources.push({ url, hash }); }
}

export interface PageContext { slug: string; revision: string; summary: Json; tools: Json[]; changed: Set<string>; added: string[]; renamed: Record<string, string>; ps: PresentationDecision; projection?: Json }

export function updateSchoolTopics(ctx: PageContext, school: Json, language: "en" | "zh") {
  const claims = new Map<string, Json>(ctx.summary.claims.map((c: Json) => [c.id, c]));
  for (const topic of [...school.topics, ...school.additionalTopics]) {
    const before = evidenceKeys(topic);
    let touched = false;
    topic.claims = topic.claims.map((c: Json) => { if (!ctx.changed.has(c.id)) return c; touched = true; return presentationCopy(c, claims.get(c.id)); });
    for (const r of ctx.ps.replacePresentationEvidence ?? []) {
      if (r.topic !== topic.key) continue;
      const group = topic.claims.find((c: Json) => c.id === r.claimId) ?? fail(`Presentation group ${r.claimId} missing in ${ctx.slug}/${topic.key}`);
      const shape = (e: Json) => { const keys = Object.keys(group.evidence[0]); return Object.fromEntries(keys.map(k => [k, e[k] ?? (k === "retrievedAt" ? undefined : "")]).filter(([, v]) => v !== undefined)); };
      if (r.evidenceIndex === "all") group.evidence = r.withAll.map(shape);
      else { if (!group.evidence[r.evidenceIndex]) fail("Presentation evidence index missing"); group.evidence[r.evidenceIndex] = shape(r.with); }
      if (r.text) group.text = r.text;
      if (ctx.ps.presentationTitles?.[group.id]) group.text = ctx.ps.presentationTitles[group.id];
      touched = true;
    }
    for (const id of ctx.ps.addTopicClaims?.[topic.key] ?? []) {
      if (topic.claims.some((c: Json) => c.id === id)) continue;
      if (!claims.has(id)) fail(`addTopicClaims names ${id}, which is not a current claim of ${ctx.slug}`);
      const template = topic.claims.find((c: Json) => claims.has(c.id)) ?? topic.claims.find((c: Json) => c.evidence?.[0]?.hash);
      const copy = presentationCopy(template ? { ...clone(template), id, basisObjectType: template.basisObjectType === "source" ? undefined : template.basisObjectType } : undefined, claims.get(id));
      if (copy.basisObjectType === undefined) delete copy.basisObjectType;
      copy.id = id; topic.claims.push(copy); touched = true;
    }
    const summary = ctx.ps.topicSummaries?.[topic.key];
    if (summary) { topic.summary = summary[language]; touched = true; }
    const status = ctx.ps.statusOverrides?.[topic.key];
    if (status) { topic.status = status.status; topic.statusLabel = status[language]; }
    const scope = ctx.ps.topicScopes?.[topic.key];
    if (scope && !ctx.ps.convertToView) topic.scope = scope[language];
    if (touched) refreshTopicSources(topic, before);
  }
  for (const key of Object.keys(ctx.ps.addTopicClaims ?? {})) if (![...school.topics, ...school.additionalTopics].some((t: Json) => t.key === key)) fail(`Topic ${key} is not on ${ctx.slug}'s page`);
  school.fingerprint = jsha(ctx.summary); school.revision = ctx.revision;
  school.checkedAt = later(school.checkedAt, ctx.summary.lastCheckedAt);
  if (typeof school.reviewedClaimCount === "number") school.reviewedClaimCount = ctx.summary.claims.length;
}

export function updateView(ctx: PageContext, view: Json, school: Json, oldFingerprint: string) {
  const claims = new Map<string, Json>(ctx.summary.claims.map((c: Json) => [c.id, c]));
  view.school = clone(school);
  view.claims = clone(ctx.summary.claims); view.sources = clone(ctx.summary.officialSources);
  if (view.sourceBundleSha256 === oldFingerprint || ctx.ps.convertToView) view.sourceBundleSha256 = school.fingerprint;
  // Tool cards keep their directory label; source-bearing fields follow the canonical record.
  view.tools = ctx.tools.map(t => { const old = view.tools?.find((x: Json) => x.rawToolName === t.rawToolName || ctx.renamed[x.rawToolName] === t.rawToolName); return old?.relationship ? { ...clone(t), relationship: old.relationship } : clone(t); });
  if (Array.isArray(view.scopedToolNames)) view.scopedToolNames = view.scopedToolNames.map((n: string) => ctx.renamed[n] ?? n);
  if (view.claimScopes || ctx.ps.claimScopes) view.claimScopes = { ...(view.claimScopes ?? {}), ...(ctx.ps.claimScopes ?? {}) };
  if (ctx.ps.gaps) {
    const missing = Object.keys(ctx.ps.gaps).filter(gap => !(view.gaps as string[]).includes(gap));
    if (missing.length) fail(`Gap text to replace is not on ${ctx.slug}: ${missing[0].slice(0, 80)}`);
    view.gaps = view.gaps.map((g: string) => ctx.ps.gaps![g] ?? g);
  }
  if (ctx.ps.dispositions && Object.keys(ctx.ps.dispositions).length && !view.claimDispositions) fail(`${ctx.slug} does not disposition its claims; place added claims with claim.topics instead of presentation.dispositions`);
  if (view.claimDispositions) {
    // Views with dispositions disposition every claim; an added claim needs its own.
    for (const id of ctx.added) {
      if (view.claimDispositions.some((d: Json) => d.claimId === id)) continue;
      const declared = ctx.ps.dispositions?.[id] ?? fail(`New claim ${id} needs presentation.dispositions.${id} (mode, scope, reason): ${ctx.slug} dispositions every claim`);
      view.claimDispositions.push({ claimId: id, mode: declared.mode, scope: declared.scope, reason: declared.reason, historyHref: `/changes/${ctx.slug}` });
    }
    view.claimDispositions = view.claimDispositions.map((d: Json) => ({ ...d, claimSha256: jsha(claims.get(d.claimId) ?? fail(`Disposition for missing claim ${d.claimId}`)), ...(ctx.ps.dispositionReasons?.[d.claimId] ? { reason: ctx.ps.dispositionReasons[d.claimId] } : {}) }));
  }
  for (const [key, s] of Object.entries(ctx.ps.topicSummaries ?? {})) {
    if (!view.topicSummaries?.[key]) fail(`Topic ${key} missing in the ${ctx.slug} view`);
    view.topicSummaries[key] = { en: s.en, zh: s.zh };
    const t = view.studentActions?.topics?.[key]; if (t) { t.en = s.en; t.zh = s.zh; }
  }
  for (const [key, s] of Object.entries(ctx.ps.topicScopes ?? {})) {
    if (view.topicScopes?.[key]) view.topicScopes[key] = { en: s.en, zh: s.zh };
    const t = view.studentActions?.topics?.[key]; if (t) { t.meaningEn = s.en; t.meaningZh = s.zh; }
  }
  const sa = view.studentActions;
  if (sa) {
    for (const [id, row] of Object.entries(sa.claims) as [string, Json][]) if (claims.has(id) && ctx.changed.has(id)) sa.claims[id] = actionRow(row, claims.get(id));
    sa.recordSha256 = jsha(view.claims); sa.schoolFingerprint = school.fingerprint; sa.universityRevisionId = ctx.revision;
  }
  if (view.publication) view.publication = { ...view.publication, releaseId: ctx.revision };
  // Receipts are added only in finalize, after the named independent review.
  delete view.presentationEvidenceAcceptance; delete view.toolPresentationAcceptance; delete view.completenessReview;
  if (view.editorialProjection) { view.editorialProjection = { ...view.editorialProjection, canonicalRecordSha256: school.fingerprint, contentSha256: editorialContentHash(view), reviewState: "pending_independent_presentation_review" }; delete view.editorialProjection.acceptance; }
}

/** Complete bilingual view from the accepted compact projection (schools that relied on frozen legacy inputs). */
export function convertToView(ctx: PageContext, en: Json, zh: Json, existing: Json | undefined) {
  const p = ctx.projection ?? fail(`No compact projection for ${ctx.slug}`);
  const all = (school: Json) => [...school.topics, ...school.additionalTopics];
  const keys = all(en).map((t: Json) => t.key);
  const enTopic = (k: string) => all(en).find((t: Json) => t.key === k), zhTopic = (k: string) => all(zh).find((t: Json) => t.key === k);
  const topicLabels: Json = {}, topicSummaries: Json = {}, topicScopes: Json = {};
  for (const k of keys) {
    const pt = p.topics[k] ?? fail(`Projection lacks topic ${k} for ${ctx.slug}`);
    if (p.topicBasis?.[k] !== undefined && p.topicBasis[k] !== enTopic(k).summary && !ctx.ps.topicSummaries?.[k]) fail(`Projection basis drift ${ctx.slug}/${k}: supply topicSummaries.${k}`);
    const so = ctx.ps.statusOverrides?.[k];
    topicLabels[k] = { en: enTopic(k).title, zh: zhTopic(k).title };
    topicLabels[k + ":status"] = so ? { en: so.en, zh: so.zh } : { en: enTopic(k).statusLabel, zh: zhTopic(k).statusLabel };
    topicSummaries[k] = ctx.ps.topicSummaries?.[k] ? { en: ctx.ps.topicSummaries[k].en, zh: ctx.ps.topicSummaries[k].zh } : { en: pt.en, zh: pt.zh };
    topicScopes[k] = ctx.ps.topicScopes?.[k] ? { en: ctx.ps.topicScopes[k].en, zh: ctx.ps.topicScopes[k].zh } : { en: pt.meaningEn, zh: pt.meaningZh };
  }
  const claims = new Map<string, Json>(ctx.summary.claims.map((c: Json) => [c.id, c]));
  const studentActions: Json = { slug: ctx.slug, name: en.name, experience: p.experience ?? "compact_evidence", presentationRevision: p.presentationRevision, recordSha256: "", schoolFingerprint: "", universityRevisionId: ctx.revision,
    scope: clone(p.scope), do: clone(p.do), dont: clone(p.dont), procedures: clone(p.procedures),
    claims: Object.fromEntries(Object.entries(p.claims).map(([id, row]: [string, Json]) => [id, claims.has(id) ? actionRow(row, claims.get(id)) : clone(row)])),
    topics: Object.fromEntries(keys.map((k: string) => [k, { en: topicSummaries[k].en, zh: topicSummaries[k].zh, meaningEn: topicScopes[k].en, meaningZh: topicScopes[k].zh }])), images: clone(p.images ?? []) };
  for (const row of Object.values(studentActions.claims) as Json[]) if (!claims.has(row.id) && row.basisObjectType !== "published_supplement") fail(`Projection action row ${row.id} is not a current claim (${ctx.slug})`);
  const base = existing ? clone(existing) : {};
  return { ...base, schemaVersion: "uapt-v6-local-view-v1", publicationApproved: false, sourceBundleSha256: "", school: {}, claims: [], sources: [], tools: [], gaps: [...(base.gaps ?? []), ...(ctx.ps.addGaps ?? [])], remainingRecordKeys: base.remainingRecordKeys ?? [],
    topicLabels, topicSummaries, topicScopes, studentActions,
    hero: base.hero ?? { title: { en: en.name, zh: ctx.ps.heroTitleZh ?? zh.name }, scope: { en: p.scope.en, zh: p.scope.zh }, images: { hero: "", do: "", dont: "" }, actions: { do: [], dont: [] } },
    publication: { releaseId: ctx.revision, kind: "v6_presentation_integration" },
    editorialProjection: { schemaVersion: "uapt-v6-editorial-projection-v1", canonicalRecordSha256: "", contentSha256: "", reviewState: "pending_independent_presentation_review", researchApprovalGranted: false, publicationApprovalGranted: false } };
}

export function alignTopicsToView(view: Json, school: Json, language: "en" | "zh") {
  for (const topic of [...school.topics, ...school.additionalTopics]) {
    topic.title = view.topicLabels[topic.key][language]; topic.statusLabel = view.topicLabels[topic.key + ":status"][language];
    topic.summary = view.topicSummaries[topic.key][language]; topic.scope = view.topicScopes[topic.key][language];
  }
}

/** Exact-content presentation and completeness receipts for the named (independent) reviewer. */
export function addReceipts(pages: Json, records: Json, slugs: string[], reviewer: string, reviewedAt: string) {
  for (const slug of slugs) for (const data of Object.values(pages.locales) as Json[]) {
    const view = data.views?.[slug]; if (!view) continue;
    const school = data.schools.find((s: Json) => s.slug === slug);
    if (view.editorialProjection) {
      const contentSha256 = editorialContentHash(view);
      view.editorialProjection = { ...view.editorialProjection, canonicalRecordSha256: school.fingerprint, contentSha256, reviewState: "accepted_presentation", acceptance: { contentSha256, reviewer, reviewedAt, scope: "presentation_only" } };
      view.presentationEvidenceAcceptance = { schemaVersion: "uapt-v6-presentation-evidence-acceptance-v1", canonicalRecordSha256: school.fingerprint, contentSha256, evidenceSha256: presentationEvidenceHash(view), reviewer, reviewedAt, scope: "presentation_only" };
    }
    if (!isDeepStrictEqual(view.tools.map((t: Json) => { const { relationship: _r, ...rest } = t; return rest; }), records.toolsBySlug[slug]))
      view.toolPresentationAcceptance = { schemaVersion: "uapt-v6-tool-presentation-acceptance-v1", canonicalToolsSha256: jsha(records.toolsBySlug[slug]), displaySha256: toolPresentationHash(view), reviewer, reviewedAt, scope: "presentation_only" };
    view.completenessReview = { schemaVersion: "uapt-v6-completeness-review-v1", contentSha256: v6CompletenessContentHash({ school, bundle: view }), reviewer, reviewedAt, scope: "presentation_only", policySemanticsApproved: false };
  }
}

export interface Selected { revision: string; records: Json; pages: Json; history: Json }
export interface CandidateResult { records: Json; pages: Json; history: Json; report: Json; touched: Record<string, string[]>; presentation: Record<string, PresentationDecision> }

/**
 * Apply the decisions to the selected V6 revision. Only the named schools
 * change; Claim IDs never disappear and held claims stay held.
 */
export function buildCandidate(selected: Selected, decisions: CorrectionDecisions, options: { publishedAt: string; projections: Record<string, Json>; summaryAt: (revision: string, slug: string) => Json | undefined }): CandidateResult {
  const records = clone(selected.records), pages = clone(selected.pages), history = clone(selected.history);
  const { revision } = decisions, at = options.publishedAt;
  if (selected.revision === revision || Object.values(records.recordRevisions as Record<string, Json>).some(pin => pin.universityRevisionId === revision)) fail(`Revision ${revision} already exists`);
  const slugs = Object.keys(decisions.schools);
  const report: Json = { schemaVersion: "uapt-content-correction-prepare-v1", revision, parentRevision: selected.revision, publishedAt: at, schools: {} };
  const touched: Record<string, string[]> = {}, presentation: Record<string, PresentationDecision> = {};
  records.revision = revision; records.publishedAt = at; records.parentRevisionId = selected.revision; records.changeSummary = decisions.changeSummary;
  pages.releaseId = revision; pages.publishedAt = at; pages.parentRevisionId = selected.revision; pages.changeSummary = decisions.changeSummary; pages.publicationKind = "scoped_record_correction";
  history.basisRevision = revision;
  for (const slug of slugs) {
    if (!pages.slugs.includes(slug)) fail(`Not a published V6 school: ${slug}`);
    const i = records.summaries.findIndex((s: Json) => s.entity.slug === slug);
    const before = records.summaries[i], summary = clone(before);
    const oldFingerprint = jsha(before), pin = records.recordRevisions[slug];
    if (pin.recordSha256 !== oldFingerprint) fail(`Parent fingerprint drift: ${slug}`);
    const { added, updated } = applyClaims(decisions, slug, summary, at);
    publicEntitySummarySchema.parse(summary);
    const afterIds = summary.claims.map((c: Json) => c.id);
    if (before.claims.some((c: Json) => !afterIds.includes(c.id))) fail(`A Claim ID disappeared: ${slug}`);
    if ((records.heldBySlug[slug] ?? []).some((h: Json) => afterIds.includes(h.id))) fail(`Held claim promoted: ${slug}`);
    records.summaries[i] = summary;
    const tools = records.toolsBySlug[slug] = clone(records.toolsBySlug[slug] ?? []);
    const renamed = applyTools(decisions, slug, tools);
    const fingerprint = jsha(summary);
    const previousRevisionId = resolvePreviousRevision(slug, [pin.universityRevisionId, selected.revision], oldFingerprint, options.summaryAt);
    records.recordRevisions[slug] = { ...pin, universityRevisionId: revision, previousRevisionId, recordSha256: fingerprint, publishedAt: at, ...(pin.schoolFingerprint ? { schoolFingerprint: fingerprint } : {}) };
    records.changesBySlug[slug] = { addedClaimIds: added, updatedClaimIds: updated, heldClaimIds: [] };
    if (records.analysisOverrides?.[slug]) records.analysisOverrides[slug] = { ...records.analysisOverrides[slug], recordSha256: fingerprint };
    // claim.topics is shorthand for presentation.addTopicClaims.
    const ps: PresentationDecision = clone(decisions.schools[slug].presentation ?? {});
    for (const claim of decisions.schools[slug].claims) for (const key of claim.topics ?? []) (ps.addTopicClaims ??= {})[key] = [...new Set([...(ps.addTopicClaims[key] ?? []), claim.id])];
    presentation[slug] = ps; touched[slug] = [...added, ...updated];
    const ctx: PageContext = { slug, revision, summary, tools, changed: new Set(touched[slug]), added, renamed, ps, projection: options.projections[slug] };
    const converted = ps.convertToView ? convertToView(ctx, selected.pages.locales.en.schools.find((s: Json) => s.slug === slug), selected.pages.locales.zh.schools.find((s: Json) => s.slug === slug), selected.pages.locales.en.views[slug]) : undefined;
    for (const [locale, data] of Object.entries(pages.locales) as [string, Json][]) {
      const language = locale === "zh" ? "zh" : "en";
      const school = data.schools.find((s: Json) => s.slug === slug);
      updateSchoolTopics(ctx, school, language);
      if (converted) { alignTopicsToView(converted, school, language); data.views[slug] = clone(converted); delete data.localEvidence[slug]; }
      if (data.views[slug]) updateView(ctx, data.views[slug], school, oldFingerprint);
      if (data.entities?.[slug] && ps.entitySummary) data.entities[slug] = { ...data.entities[slug], summary: ps.entitySummary[language] };
    }
    report.schools[slug] = { previousRevisionId, previousRecordSha256: oldFingerprint, recordSha256: fingerprint, addedClaimIds: added, correctedClaimIds: updated,
      claimCount: { before: before.claims.length, after: afterIds.length }, convertedToView: Boolean(ps.convertToView), toolChanges: decisions.schools[slug].tools?.length ?? 0 };
  }
  return { records, pages, history, report, touched, presentation };
}
