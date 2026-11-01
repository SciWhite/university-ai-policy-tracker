import { createHash } from "node:crypto";
import { access, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { READING_LOCALES, type ReadingLocale } from "../apps/web/lib/language-catalog";
import { validateReadingTranslationBundle, type ReadingTranslationBundle, type ReadingTranslationSelection } from "../apps/web/lib/reading-translations";

interface SourceUse { slug: string; field?: string; source?: string; sourceSha256?: string; claimIds?: string[]; substitutions?: Record<string, string> }
interface Source {
  schemaVersion: string;
  schools: { slug: string; recordSha256: string; originalEvidenceSha256: string; publicClaimIds: string[] }[];
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
interface AcceptedMatrix {
  schemaVersion: "uapt-repaired-translation-matrix-v1";
  sourceSha256: string;
  schools: number;
  sourceStrings: number;
  targetLocales: number;
  batches: number;
  fields: number;
  missingPairs: number;
  fieldValidation: "PASS";
  rows: { locale: ReadingLocale; batch: string; path: string; sha256: string; fields: number }[];
  semanticAcceptance: { wholeCorpusSemanticReview: false; randomConfirmationSize: number; confirmedErrorsBeforeCorrection: number; oneSided975UpperBound: number; confirmationRulePassed: true; nativeSpeakerApproval: false };
  publicationApproved: false;
}
interface SceneDeltaSource { schemaVersion: "uapt-runtime-scene-source-delta-v1"; parentSourceSha256: string; inventorySha256: string; units: { index: number; sourceSha256: string; source: string; uses: { slug: string; field: string }[] }[] }
interface SceneDeltaAcceptance {
  schemaVersion: "uapt-reviewed-scene-delta-acceptance-v1"; status: "accepted"; sourceSha256: string; parentSourceSha256: string; sourceStrings: number; targetLocales: number; targetPairs: number; fieldValidation: "PASS"; fullCorpusSemanticReview: false; nativeSpeakerApproval: false; publicationApproved: false;
  locales: Partial<Record<ReadingLocale, { path: string; sha256: string; fields: number }>>;
  semanticAcceptance: { mode: "sampling"; samplingPlanSha256: string; randomSampleSize: number; confirmedErrorsBeforeCorrection: number; oneSidedConfidenceLevel: number; upperBound: number; preRegisteredMaxErrors: number; rulePassed: boolean; highRiskReviewed: number; blindReviewed: number; expandedReviewed?: number; finalConfirmation?: { plan: { path: string; sha256: string }; checkedCount: number; confirmedErrorsBeforeCorrection: number; maxConfirmedErrors: number; oneSidedConfidenceLevel: number; upperBound: number; rulePassed: boolean; confidenceTargetPassed: boolean; acceptanceBasis: "user_approximate_two_percent_confidence_bound" }; allDiscoveredCorrectionsApplied: boolean; remainingIssues: number };
  reviewArtifacts: { random: { path: string; sha256: string }; highRisk: { path: string; sha256: string }; corrections: { path: string; sha256: string } };
}
export interface SceneDeltaCheckedPair { id: string; locale: ReadingLocale; index: number; sourceSha256: string; targetSha256: string; status: "approved" | "error" | "clarified" }
export interface SceneDeltaRandomReview { schemaVersion: "uapt-scene-delta-random-review-v1"; sourceSha256: string; samplingPlanSha256: string; checkedCount: number; confirmedErrorsBeforeCorrection: number; rulePassed: boolean; checked: SceneDeltaCheckedPair[]; finalConfirmation?: { plan: { path: string; sha256: string }; checkedCount: number; confirmedErrorsBeforeCorrection: number; maxConfirmedErrors: number; oneSidedConfidenceLevel: number; upperBound: number; rulePassed: boolean; confidenceTargetPassed: boolean; acceptanceBasis: "user_approximate_two_percent_confidence_bound"; checked: SceneDeltaCheckedPair[] } }
export interface SceneDeltaHighRiskReview { schemaVersion: "uapt-scene-delta-high-risk-review-v1"; sourceSha256: string; checkedCount: number; checked: (SceneDeltaCheckedPair & { blind: boolean })[]; boundedExpansion?: { plan: { path: string; sha256: string }; checkedCount: number; checked: SceneDeltaCheckedPair[] } }
interface SceneDeltaCorrections { schemaVersion: "uapt-scene-delta-corrections-v1"; sourceSha256: string; status: "complete"; remainingIssues: number; changes: { id?: string; locale: ReadingLocale; index: number; sourceSha256: string; originalTargetSha256: string; repairedTargetSha256: string; original: string; translation: string; reason: string; independentReview: "accepted"; kind: "semantic" | "source_ambiguity_clarification" }[]; finalOutputs: Partial<Record<ReadingLocale, { path: string; sha256: string }>>; independentVerification: { path: string; sha256: string } }
interface SceneDeltaInput { sourcePath: string; sourceSha256: string; acceptancePath: string; acceptanceSha256: string }
interface PreparedSceneDelta { source: SceneDeltaSource; acceptance: SceneDeltaAcceptance; sourceSha256: string; acceptanceSha256: string; localeArtifactSha256: Partial<Record<ReadingLocale, string>>; translations: Map<ReadingLocale, Map<string, { source: string; translation: string }>>; }
interface DisplayAddendumUnit { index: number; sourceSha256: string; source: string; uses: { slug: string; field: string }[]; basisObjectType?: string }
interface DisplayAddendumSource { schemaVersion: "uapt-published-display-addendum-source-v1"; parentSourceSha256: string; sceneSourceSha256: string; publishedGuideBasisSha256: string; units: DisplayAddendumUnit[]; targetLocales: ReadingLocale[]; publicationApproved: false; policyAndEvidenceMutation?: false }
interface DisplayAddendumAcceptance {
  schemaVersion: "uapt-reviewed-display-addendum-acceptance-v1"; status: "accepted"; sourceSha256: string; parentSourceSha256: string; sceneSourceSha256: string; publishedGuideBasisSha256: string; sourceStrings: 9; targetLocales: 32; targetPairs: 288; fieldValidation: "PASS"; nativeSpeakerApproval: false; wholeSiteFullSemanticReview: false; publicationApproved: false;
  semanticAcceptance: { mode: "full_machine_addendum_only"; checkedPairs: 288; confirmedErrorsBeforeCorrection: number; allDiscoveredCorrectionsApplied: true; remainingIssues: 0 };
  locales: Partial<Record<ReadingLocale, { path: string; sha256: string; fields: number }>>;
  reviewArtifacts: { semantic: { path: string; sha256: string }; corrections: { path: string; sha256: string } };
}
export interface IndependentCorrectionRow { id: string; locale: ReadingLocale; index: number; sourceSha256: string; originalTargetSha256: string; repairedTargetSha256: string; original: string; translation: string; reason: string; independentReview: "accepted"; kind?: "semantic" | "source_ambiguity_clarification" }
interface DisplayAddendumInput { sourcePath: string; sourceSha256: string; acceptancePath: string; acceptanceSha256: string }
interface PreparedDisplayAddendum { source: DisplayAddendumSource; acceptance: DisplayAddendumAcceptance; sourceSha256: string; acceptanceSha256: string; localeArtifactSha256: Partial<Record<ReadingLocale, string>>; translations: Map<ReadingLocale, Map<string, { source: string; translation: string }>> }
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Exact one-sided Clopper-Pearson upper bound for a binomial sample. */
export function clopperPearsonUpperBound(errors: number, sampleSize: number, confidenceLevel = 0.975): number {
  if (!Number.isInteger(errors) || !Number.isInteger(sampleSize) || sampleSize < 1 || errors < 0 || errors > sampleSize || !(confidenceLevel > 0 && confidenceLevel < 1)) throw Error("Invalid binomial confidence inputs");
  const alpha = 1 - confidenceLevel;
  const cdf = (probability: number) => {
    let term = Math.pow(1 - probability, sampleSize), sum = term;
    for (let k = 1; k <= errors; k++) {
      term *= ((sampleSize - k + 1) / k) * (probability / (1 - probability));
      sum += term;
    }
    return sum;
  };
  let low = 0, high = 1;
  for (let i = 0; i < 80; i++) {
    const middle = (low + high) / 2;
    if (cdf(middle) > alpha) low = middle; else high = middle;
  }
  return (low + high) / 2;
}
async function matrixInputPath(sourcePath: string, row: { locale: ReadingLocale; batch: string; path: string }) {
  const base = path.dirname(sourcePath);
  const candidates = [
    path.join(path.dirname(row.path), "input.json"),
    path.join(base, "candidates", row.locale, row.batch, "input.json"),
    path.join(base, "..", "new-agent", row.locale, row.batch, "input.json"),
    path.join(base, "..", "new-agent", "run-high-20261029", "jobs", row.locale, row.batch, "input.json"),
    path.join(base, "..", "new-agent", "run-high-20261029", "jobs", row.locale, row.batch, "source-input.json"),
    path.join(base, "..", "..", "translation-backlog-repair-20261031", "jobs", `${row.locale}__${row.batch}`, "input.json")
  ];
  for (const candidate of candidates) try { await access(candidate); return candidate; } catch { /* try the next provenance-preserving source map */ }
  throw Error(`Matrix source map unavailable: ${row.locale}/${row.batch}`);
}
function canonicalBatchMaps(source: Source, limit = 24_000): Record<string, Record<string, string>> {
  const batches: Record<string, Record<string, string>> = {};
  let ids: string[] = [], characters = 0, index = 0;
  const flush = () => {
    if (!ids.length) return;
    batches[`batch-${String(index++).padStart(4, "0")}`] = Object.fromEntries(ids.map((id, position) => [`u${position}`, id]));
    ids = []; characters = 0;
  };
  // Frozen source bytes preserve the original hash-sorted object insertion order;
  // Python's batch runner measures Unicode code points and caps each chunk at 24k.
  for (const id of Object.keys(source.units)) {
    const length = Array.from(source.units[id].source).length;
    if (ids.length && characters + length > limit) flush();
    ids.push(id); characters += length;
  }
  flush();
  return batches;
}
async function readPinnedChild(root: string, ref: { path: string; sha256: string }, maxBytes = 8 * 1024 * 1024): Promise<Buffer> {
  if (typeof ref.path !== "string" || path.isAbsolute(ref.path) || ref.path.split(/[\\/]/).includes("..") || !/^[a-f0-9]{64}$/.test(ref.sha256)) throw Error("Invalid scene-delta receipt reference");
  const target = await realpath(path.join(root, ref.path));
  if (!target.startsWith(root + path.sep)) throw Error("Scene-delta receipt artifact escaped its directory");
  const info = await stat(target);
  if (!info.isFile() || info.size > maxBytes) throw Error("Scene-delta receipt artifact exceeds limit");
  const raw = await readFile(target);
  if (digest(raw) !== ref.sha256) throw Error("Scene-delta receipt artifact hash mismatch");
  return raw;
}
function canonicalObject(value: Record<string, unknown>): string {
  const normalize = (item: unknown): unknown => Array.isArray(item) ? item.map(normalize) : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, normalize(child)])) : item;
  return JSON.stringify(normalize(value));
}
function sameIdSet(actual: unknown, expected: readonly string[]): boolean {
  return Array.isArray(actual) && actual.every((value): value is string => typeof value === "string") && new Set(actual).size === actual.length && [...actual].sort().join("\0") === [...expected].sort().join("\0");
}
function sameFinalOutputs(actual: unknown, expected: Record<string, { path: string; sha256: string }>): boolean {
  return Boolean(actual && typeof actual === "object" && !Array.isArray(actual) && canonicalObject(actual as Record<string, unknown>) === canonicalObject(expected as Record<string, unknown>));
}
function sameIndependentChange(actual: unknown, expected: IndependentCorrectionRow, includeKind: boolean): boolean {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  const row = actual as Record<string, unknown>;
  const keys = ["id", "locale", "index", "sourceSha256", "originalTargetSha256", "repairedTargetSha256", "original", "translation", "reason", "independentReview", ...(includeKind ? ["kind"] : [])];
  return keys.every(key => row[key] === expected[key as keyof IndependentCorrectionRow]);
}
export function verifyIndependentCorrectionArtifact(value: unknown, expected: {
  schemaVersion: string; sourceSha256: string; changes: IndependentCorrectionRow[];
  finalOutputs: Record<string, { path: string; sha256: string }>; scene: boolean;
}): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Independent correction verification artifact is invalid");
  const artifact = value as Record<string, unknown>;
  const changes = artifact.appliedChanges;
  const ids = expected.changes.map(change => change.id);
  const semanticIds = expected.changes.filter(change => change.kind === "semantic").map(change => change.id);
  const clarifiedIds = expected.changes.filter(change => change.kind === "source_ambiguity_clarification").map(change => change.id);
  if (artifact.schemaVersion !== expected.schemaVersion || artifact.sourceSha256 !== expected.sourceSha256 || artifact.publicationApproved !== false || !Array.isArray(artifact.issues) || artifact.issues.length !== 0 || !Array.isArray(changes) || changes.length !== expected.changes.length || !sameIdSet(artifact.checkedIds, ids) || !sameIdSet(artifact.approvedIds, expected.scene ? semanticIds : ids) || (expected.scene && !sameIdSet(artifact.clarificationAcceptedIds, clarifiedIds)) || !sameFinalOutputs(artifact.finalOutputs, expected.finalOutputs)) throw Error("Independent correction verification scope or counts do not match the accepted correction chain");
  const expectedById = new Map(expected.changes.map(change => [change.id, change]));
  const seen = new Set<string>();
  for (const row of changes) {
    if (!row || typeof row !== "object" || Array.isArray(row) || typeof (row as Record<string, unknown>).id !== "string") throw Error("Independent correction verification row is malformed");
    const id = (row as Record<string, unknown>).id as string, accepted = expectedById.get(id);
    if (!accepted || seen.has(id) || !sameIndependentChange(row, accepted, !expected.scene)) throw Error("Independent correction verification does not approve the exact repaired bytes");
    seen.add(id);
  }
  if (seen.size !== expected.changes.length) throw Error("Independent correction verification omits an accepted repair");
}
async function prepareSceneDelta(input: SceneDeltaInput, source: Source, parentSourceSha256: string): Promise<PreparedSceneDelta> {
  const [sourceRaw, acceptanceRaw] = await Promise.all([readFile(input.sourcePath), readFile(input.acceptancePath)]);
  if (digest(sourceRaw) !== input.sourceSha256 || digest(acceptanceRaw) !== input.acceptanceSha256) throw Error("Scene-delta accepted inputs changed");
  const delta = JSON.parse(sourceRaw.toString("utf8")) as SceneDeltaSource;
  const acceptance = JSON.parse(acceptanceRaw.toString("utf8")) as SceneDeltaAcceptance;
  const locales = READING_LOCALES.filter((locale): locale is Exclude<ReadingLocale, "en"> => locale !== "en");
  const localeSet = new Set<ReadingLocale>(locales);
  if (delta.schemaVersion !== "uapt-runtime-scene-source-delta-v1" || delta.parentSourceSha256 !== parentSourceSha256 || acceptance.schemaVersion !== "uapt-reviewed-scene-delta-acceptance-v1" || acceptance.status !== "accepted" || acceptance.sourceSha256 !== input.sourceSha256 || acceptance.parentSourceSha256 !== parentSourceSha256 || acceptance.sourceStrings !== 337 || acceptance.targetLocales !== 32 || acceptance.targetPairs !== 10_784 || acceptance.fieldValidation !== "PASS" || acceptance.fullCorpusSemanticReview !== false || acceptance.nativeSpeakerApproval !== false || acceptance.publicationApproved !== false) throw Error("Scene-delta acceptance basis or scope mismatch");
  if (!Array.isArray(delta.units) || delta.units.length !== acceptance.sourceStrings || delta.units.some((unit, index) => unit.index !== index || !/^[a-f0-9]{64}$/.test(unit.sourceSha256) || digest(unit.source) !== unit.sourceSha256 || !Array.isArray(unit.uses) || !unit.uses.length) || new Set(delta.units.map(unit => unit.sourceSha256)).size !== delta.units.length) throw Error("Invalid ordered scene-delta source units");
  const schoolSlugs = new Set(source.schools.map(school => school.slug));
  for (const unit of delta.units) for (const use of unit.uses) if (!schoolSlugs.has(use.slug) || typeof use.field !== "string" || !use.field.startsWith("scene/")) throw Error("Scene-delta source use points outside reviewed school display scope");
  const semantic = acceptance.semanticAcceptance;
  if (!semantic || semantic.mode !== "sampling" || semantic.randomSampleSize !== 600 || semantic.confirmedErrorsBeforeCorrection < 0 || semantic.oneSidedConfidenceLevel !== 0.975 || semantic.upperBound < 0 || semantic.upperBound > 1 || semantic.preRegisteredMaxErrors !== 5 || semantic.rulePassed !== (semantic.confirmedErrorsBeforeCorrection <= semantic.preRegisteredMaxErrors) || semantic.highRiskReviewed !== 160 || semantic.blindReviewed !== 64 || semantic.allDiscoveredCorrectionsApplied !== true || semantic.remainingIssues !== 0 || Math.abs(semantic.upperBound - clopperPearsonUpperBound(semantic.confirmedErrorsBeforeCorrection, semantic.randomSampleSize, semantic.oneSidedConfidenceLevel)) > 5e-12) throw Error("Scene-delta semantic acceptance summary mismatch");
  const receiptRoot = await realpath(path.dirname(input.acceptancePath));
  const planRaw = await readPinnedChild(receiptRoot, { path: "sampling-plan.json", sha256: semantic.samplingPlanSha256 });
  const plan = JSON.parse(planRaw.toString("utf8"));
  if (plan.schemaVersion !== "uapt-scene-delta-sampling-plan-v1" || plan.sourceSha256 !== input.sourceSha256 || plan.targetPairs !== acceptance.targetPairs || plan.randomSampleSize !== semantic.randomSampleSize || plan.maxConfirmedErrors !== semantic.preRegisteredMaxErrors || plan.confidenceLevel !== semantic.oneSidedConfidenceLevel || plan.targetUpperBound !== 0.02 || plan.publicationApproved !== false || typeof plan.randomSeed !== "string" || plan.blindReviewSize !== 64 || plan.blindPerLocale !== 2 || plan.highRiskReviewSize !== 96 || plan.highRiskPerLocale !== 3 || plan.higherModelReviewSize !== 160 || !Array.isArray(plan.randomSelectedIds) || !Array.isArray(plan.blindSelectedIds) || !Array.isArray(plan.highRiskSelectedIds)) throw Error("Scene-delta sample differs from its preregistered plan");
  const reviewRefs = acceptance.reviewArtifacts;
  if (!reviewRefs || Object.keys(reviewRefs).sort().join(",") !== "corrections,highRisk,random" || new Set(Object.values(reviewRefs).map(ref => `${ref.path}:${ref.sha256}`)).size !== 3) throw Error("Scene-delta review artifact set is incomplete or aliased");
  const [randomRaw, highRiskRaw, correctionsRaw] = await Promise.all([readPinnedChild(receiptRoot, reviewRefs.random), readPinnedChild(receiptRoot, reviewRefs.highRisk), readPinnedChild(receiptRoot, reviewRefs.corrections)]);
  const randomReview = JSON.parse(randomRaw.toString("utf8")) as SceneDeltaRandomReview;
  const highRiskReview = JSON.parse(highRiskRaw.toString("utf8")) as SceneDeltaHighRiskReview;
  const corrections = JSON.parse(correctionsRaw.toString("utf8")) as SceneDeltaCorrections;
  const schoolBySlug = new Map(source.schools.map(school => [school.slug, school]));
  const scopedClaimIds = [...new Set(delta.units.flatMap(unit => unit.uses.flatMap(use => schoolBySlug.get(use.slug)?.publicClaimIds ?? [])))].sort((a, b) => b.length - a.length);
  const scopedClaimPattern = scopedClaimIds.length ? new RegExp(scopedClaimIds.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g") : undefined;
  const deltaClaimIds = [...new Set(delta.units.flatMap(unit => scopedClaimPattern ? unit.source.match(scopedClaimPattern) ?? [] : []))];
  const localesByTranslation = new Map<ReadingLocale, Map<string, { source: string; translation: string }>>();
  const localeArtifactSha256: Partial<Record<ReadingLocale, string>> = {};
  if (Object.keys(acceptance.locales ?? {}).length !== locales.length) throw Error("Scene-delta acceptance locale inventory is incomplete");
  const deltaRoot = await realpath(path.dirname(input.acceptancePath));
  for (const locale of locales) {
    const item = acceptance.locales[locale];
    if (!item || item.fields !== delta.units.length || !/^[a-f0-9]{64}$/.test(item.sha256)) throw Error(`Scene-delta accepted locale missing: ${locale}`);
    const raw = await readPinnedChild(deltaRoot, item);
    localeArtifactSha256[locale] = item.sha256;
    const parsed = JSON.parse(raw.toString("utf8")) as { schemaVersion?: string; sourceSha256?: string; locale?: string; translations?: unknown; publicationApproved?: boolean };
    if (parsed.schemaVersion !== "uapt-scene-delta-translation-candidate-v1" || parsed.sourceSha256 !== input.sourceSha256 || parsed.locale !== locale || !Array.isArray(parsed.translations) || parsed.translations.length !== delta.units.length || parsed.translations.some(value => typeof value !== "string" || !value.trim())) throw Error(`Scene-delta translation inventory mismatch: ${locale}`);
    const translatedStrings = parsed.translations as string[];
    const strings = new Map(delta.units.map((unit, index) => [unit.sourceSha256, { source: unit.source, translation: translatedStrings[index] }]));
    const validationBundle: ReadingTranslationBundle = { schemaVersion: "uapt-reading-translations-v1", sourceSha256: input.sourceSha256, locale, slug: "scene-delta", recordSha256: input.sourceSha256, originalEvidenceSha256: input.sourceSha256, review: { status: "accepted", receiptSha256: input.acceptanceSha256 }, protectedClaimIds: deltaClaimIds, requiredSourceHashes: [...strings.keys()], strings: Object.fromEntries([...strings].map(([hash, value]) => [hash, { sourceSha256: hash, ...value }])) };
    validateReadingTranslationBundle(validationBundle, { sourceSha256: input.sourceSha256, locale, slug: "scene-delta" });
    localesByTranslation.set(locale, strings);
  }
  const correctionByPair = new Map<string, SceneDeltaCorrections["changes"][number]>();
  if (corrections.schemaVersion !== "uapt-scene-delta-corrections-v1" || corrections.sourceSha256 !== input.sourceSha256 || corrections.status !== "complete" || corrections.remainingIssues !== 0 || !Array.isArray(corrections.changes) || !corrections.finalOutputs) throw Error("Scene-delta correction record is incomplete");
  if (!corrections.independentVerification) throw Error("Scene-delta correction record lacks its independent verification reference");
  if (Object.keys(corrections.finalOutputs).length !== locales.length) throw Error("Scene-delta correction outputs are incomplete");
  for (const locale of locales) {
    const finalRef = corrections.finalOutputs[locale], acceptedRef = acceptance.locales[locale];
    if (!finalRef || !acceptedRef || finalRef.path !== acceptedRef.path || finalRef.sha256 !== acceptedRef.sha256) throw Error(`Scene-delta corrected output mismatch: ${locale}`);
  }
  for (const change of corrections.changes) {
    if (!localeSet.has(change.locale) || !Number.isInteger(change.index) || change.index < 0 || change.index >= delta.units.length || change.sourceSha256 !== delta.units[change.index].sourceSha256 || !/^[a-f0-9]{64}$/.test(change.originalTargetSha256) || !/^[a-f0-9]{64}$/.test(change.repairedTargetSha256) || digest(change.original) !== change.originalTargetSha256 || digest(change.translation) !== change.repairedTargetSha256 || !change.reason.trim() || change.independentReview !== "accepted" || !["semantic", "source_ambiguity_clarification"].includes(change.kind)) throw Error("Invalid scene-delta correction entry");
    const pairKey = `${change.locale}:${change.index}`;
    if (correctionByPair.has(pairKey)) throw Error("Duplicate scene-delta correction entry");
    const target = localesByTranslation.get(change.locale)!.get(change.sourceSha256)!.translation;
    if (digest(target) !== change.repairedTargetSha256) throw Error("Scene-delta correction is not reflected in its final locale output");
    correctionByPair.set(pairKey, change);
  }
  const independentRaw = await readPinnedChild(receiptRoot, corrections.independentVerification);
  const independent = JSON.parse(independentRaw.toString("utf8")) as Record<string, unknown>;
  const independentChanges: IndependentCorrectionRow[] = [...correctionByPair.entries()].map(([id, change]) => ({ id, locale: change.locale, index: change.index, sourceSha256: change.sourceSha256, originalTargetSha256: change.originalTargetSha256, repairedTargetSha256: change.repairedTargetSha256, original: change.original, translation: change.translation, reason: change.reason, independentReview: change.independentReview, kind: change.kind }));
  verifyIndependentCorrectionArtifact(independent, { schemaVersion: "uapt-scene-delta-confirmation-correction-verification-final-v1", sourceSha256: input.sourceSha256, changes: independentChanges, finalOutputs: corrections.finalOutputs as Record<string, { path: string; sha256: string }>, scene: true });
  const validateReview = <T extends { schemaVersion: string; sourceSha256: string; checkedCount: number; checked: SceneDeltaCheckedPair[] }>(review: T, schema: string, expectedCount: number, reviewKind: "random" | "highRisk") => {
    if (review.schemaVersion !== schema || review.sourceSha256 !== input.sourceSha256 || review.checkedCount !== expectedCount || !Array.isArray(review.checked) || review.checked.length !== expectedCount) throw Error(`Scene-delta ${reviewKind} review count or source mismatch`);
    const seen = new Set<string>();
    for (const item of review.checked) {
      if (!localeSet.has(item.locale) || !Number.isInteger(item.index) || item.index < 0 || item.index >= delta.units.length || item.id !== `${item.locale}:${item.index}` || item.sourceSha256 !== delta.units[item.index].sourceSha256 || !/^[a-f0-9]{64}$/.test(item.targetSha256) || !["approved", "error", "clarified"].includes(item.status) || seen.has(item.id)) throw Error(`Invalid scene-delta ${reviewKind} reviewed pair: ${JSON.stringify({ id: item.id, locale: item.locale, index: item.index, sourceMatches: delta.units[item.index]?.sourceSha256 === item.sourceSha256, status: item.status, duplicate: seen.has(item.id) })}`);
      seen.add(item.id);
      const current = localesByTranslation.get(item.locale)!.get(item.sourceSha256)!.translation;
      const currentHash = digest(current), correction = correctionByPair.get(item.id);
      if (item.status === "approved" ? item.targetSha256 !== currentHash : !correction || correction.originalTargetSha256 !== item.targetSha256 || correction.repairedTargetSha256 !== currentHash || (item.status === "error" ? correction.kind !== "semantic" : correction.kind !== "source_ambiguity_clarification")) throw Error(`Scene-delta ${reviewKind} target/correction chain mismatch`);
    }
    return review.checked;
  };
  const allPairs = locales.flatMap(locale => delta.units.map(unit => ({ locale, index: unit.index, sourceSha256: unit.sourceSha256, priority: digest(`${plan.randomSeed}\0${locale}\0${unit.sourceSha256}`) }))).sort((a, b) => a.priority.localeCompare(b.priority));
  const expectedSample = allPairs.slice(0, semantic.randomSampleSize).map(pair => `${pair.locale}:${pair.index}`);
  const randomRows = validateReview(randomReview, "uapt-scene-delta-random-review-v1", semantic.randomSampleSize, "random");
  if (randomReview.samplingPlanSha256 !== semantic.samplingPlanSha256 || randomReview.confirmedErrorsBeforeCorrection !== semantic.confirmedErrorsBeforeCorrection || randomReview.rulePassed !== semantic.rulePassed || randomRows.filter(item => item.status === "error").length !== semantic.confirmedErrorsBeforeCorrection || randomRows.map(item => item.id).join(",") !== expectedSample.join(",") || plan.randomSelectedIds.join(",") !== expectedSample.join(",")) throw Error("Scene-delta random review does not match the preregistered SRS or receipt");
  const blindIds = plan.blindSelectedIds as string[], highRiskIds = plan.highRiskSelectedIds as string[];
  if (semantic.highRiskReviewed !== 160 || semantic.blindReviewed !== 64 || blindIds.length !== 64 || highRiskIds.length !== 96 || new Set(blindIds).size !== 64 || new Set(highRiskIds).size !== 96 || blindIds.some(id => !expectedSample.includes(id)) || highRiskIds.some(id => expectedSample.includes(id))) throw Error("Scene-delta blind and high-risk selections do not match the preregistered plan");
  const perLocaleCount = (ids: string[], expected: number) => locales.every(locale => ids.filter(id => id.startsWith(`${locale}:`)).length === expected);
  if (!perLocaleCount(blindIds, 2) || !perLocaleCount(highRiskIds, 3)) throw Error("Scene-delta blind/high-risk locale allocation mismatch");
  const highRows = validateReview(highRiskReview, "uapt-scene-delta-high-risk-review-v1", semantic.highRiskReviewed, "highRisk") as (SceneDeltaCheckedPair & { blind: boolean })[];
  const expectedHighIds = [...blindIds, ...highRiskIds];
  if (new Set(expectedHighIds).size !== 160 || new Set(highRows.map(item => item.id)).size !== 160 || expectedHighIds.some(id => !highRows.some(row => row.id === id)) || highRows.some(row => row.blind !== blindIds.includes(row.id))) throw Error("Scene-delta high-risk review rows do not match blinded and supplemental selections");
  let expansionRows: SceneDeltaCheckedPair[] = [];
  const expansion = highRiskReview.boundedExpansion;
  if (expansion || semantic.expandedReviewed !== undefined) {
    if (!expansion || !Number.isInteger(semantic.expandedReviewed) || expansion.checkedCount !== semantic.expandedReviewed || expansion.checkedCount < 1 || expansion.checkedCount > 200 || expansion.checked.length !== expansion.checkedCount) throw Error("Scene-delta bounded expansion count is invalid");
    if (expansion.plan.path !== "review/expansion-plan.json") throw Error("Scene-delta bounded expansion plan path is invalid");
    const expansionPlanRaw = await readPinnedChild(receiptRoot, expansion.plan);
    const expansionPlan = JSON.parse(expansionPlanRaw.toString("utf8"));
    if (expansionPlan.schemaVersion !== "uapt-scene-delta-bounded-expansion-plan-v1" || expansionPlan.sourceSha256 !== input.sourceSha256 || expansionPlan.checkedCount !== expansion.checkedCount || expansionPlan.maxChecked !== 200 || expansionPlan.publicationApproved !== false || !Array.isArray(expansionPlan.selectedIds) || expansionPlan.selectedIds.length !== expansion.checkedCount || new Set(expansionPlan.selectedIds).size !== expansion.checkedCount) throw Error("Scene-delta bounded expansion plan is invalid");
    expansionRows = validateReview({ schemaVersion: "uapt-scene-delta-high-risk-review-v1", sourceSha256: input.sourceSha256, checkedCount: expansion.checkedCount, checked: expansion.checked }, "uapt-scene-delta-high-risk-review-v1", expansion.checkedCount, "highRisk");
    if (expansionRows.map(item => item.id).join(",") !== expansionPlan.selectedIds.join(",")) throw Error("Scene-delta expansion rows do not match its pinned plan");
  }
  const priorReviewedIds = new Set([...randomRows, ...highRows, ...expansionRows].map(item => item.id));
  let finalConfirmationRows: SceneDeltaCheckedPair[] = [];
  const finalConfirmation = randomReview.finalConfirmation;
  if (finalConfirmation || semantic.finalConfirmation) {
    if (!finalConfirmation || !semantic.finalConfirmation || finalConfirmation.checkedCount !== 1000 || finalConfirmation.checked.length !== finalConfirmation.checkedCount) throw Error("Scene-delta final confirmation artifact is incomplete");
    if (finalConfirmation.plan.path !== "review/final-confirmation-plan.json" || semantic.finalConfirmation.plan.path !== finalConfirmation.plan.path || semantic.finalConfirmation.plan.sha256 !== finalConfirmation.plan.sha256) throw Error("Scene-delta final confirmation is not bound to the frozen review plan");
    const finalPlanRaw = await readPinnedChild(receiptRoot, finalConfirmation.plan);
    const finalPlan = JSON.parse(finalPlanRaw.toString("utf8"));
    if (finalPlan.schemaVersion !== "uapt-scene-delta-final-confirmation-plan-v1" || finalPlan.sourceSha256 !== input.sourceSha256 || finalPlan.parentSamplingPlanSha256 !== semantic.samplingPlanSha256 || finalPlan.initialSampleSize !== 600 || finalPlan.initialConfirmedErrors !== semantic.confirmedErrorsBeforeCorrection || finalPlan.initialMaxErrors !== semantic.preRegisteredMaxErrors || finalPlan.initialRulePassed !== semantic.rulePassed || finalPlan.sampleSize !== finalConfirmation.checkedCount || finalPlan.maxConfirmedErrors !== 10 || finalPlan.confidenceLevel !== 0.975 || finalPlan.targetUpperBound !== 0.02 || finalPlan.publicationApproved !== false || finalPlan.maximumConfirmationRounds !== 1 || typeof finalPlan.seed !== "string" || finalPlan.unreviewedPopulation !== delta.units.length * locales.length - priorReviewedIds.size || !Array.isArray(finalPlan.excludedReviewedIds) || !Array.isArray(finalPlan.selectedIds)) throw Error("Scene-delta final confirmation plan is invalid");
    if (new Set(finalPlan.excludedReviewedIds).size !== finalPlan.excludedReviewedIds.length || [...priorReviewedIds].sort().join(",") !== [...finalPlan.excludedReviewedIds].sort().join(",") || finalPlan.selectedIds.length !== finalConfirmation.checkedCount || new Set(finalPlan.selectedIds).size !== finalConfirmation.checkedCount || finalPlan.selectedIds.some((id: string) => priorReviewedIds.has(id))) throw Error("Scene-delta final confirmation population overlaps prior review");
    const finalPriority = locales.flatMap(locale => delta.units.map(unit => ({ id: `${locale}:${unit.index}`, priority: digest(`${finalPlan.seed}\0${locale}\0${unit.sourceSha256}`) }))).filter(pair => !priorReviewedIds.has(pair.id)).sort((a, b) => a.priority.localeCompare(b.priority));
    const expectedFinalIds = finalPriority.slice(0, finalConfirmation.checkedCount).map(pair => pair.id);
    if (expectedFinalIds.join(",") !== finalPlan.selectedIds.join(",")) throw Error("Scene-delta final confirmation IDs are not deterministic");
    finalConfirmationRows = validateReview({ schemaVersion: "uapt-scene-delta-random-review-v1", sourceSha256: input.sourceSha256, samplingPlanSha256: finalConfirmation.plan.sha256, checkedCount: finalConfirmation.checkedCount, confirmedErrorsBeforeCorrection: finalConfirmation.confirmedErrorsBeforeCorrection, rulePassed: finalConfirmation.rulePassed, checked: finalConfirmation.checked }, "uapt-scene-delta-random-review-v1", finalConfirmation.checkedCount, "random");
    if (finalConfirmationRows.map(item => item.id).join(",") !== expectedFinalIds.join(",")) throw Error("Scene-delta final confirmation rows do not match frozen IDs");
    const finalErrors = finalConfirmationRows.filter(item => item.status === "error").length;
    const finalUpper = clopperPearsonUpperBound(finalErrors, finalConfirmation.checkedCount, 0.975);
    const finalRulePassed = finalErrors <= finalPlan.maxConfirmedErrors;
    const confidenceTargetPassed = finalUpper <= finalPlan.targetUpperBound;
    const finalSummary = semantic.finalConfirmation;
    if (finalConfirmation.confirmedErrorsBeforeCorrection !== finalErrors || finalConfirmation.maxConfirmedErrors !== finalPlan.maxConfirmedErrors || finalConfirmation.oneSidedConfidenceLevel !== 0.975 || Math.abs(finalConfirmation.upperBound - finalUpper) > 5e-12 || finalConfirmation.rulePassed !== finalRulePassed || finalConfirmation.confidenceTargetPassed !== confidenceTargetPassed || finalConfirmation.acceptanceBasis !== "user_approximate_two_percent_confidence_bound" || finalSummary.checkedCount !== finalConfirmation.checkedCount || finalSummary.confirmedErrorsBeforeCorrection !== finalErrors || finalSummary.maxConfirmedErrors !== finalPlan.maxConfirmedErrors || finalSummary.oneSidedConfidenceLevel !== 0.975 || Math.abs(finalSummary.upperBound - finalUpper) > 5e-12 || finalSummary.rulePassed !== finalRulePassed || finalSummary.confidenceTargetPassed !== confidenceTargetPassed || finalSummary.acceptanceBasis !== finalConfirmation.acceptanceBasis || !confidenceTargetPassed) throw Error("Scene-delta final confidence-bound acceptance does not match reviewed pairs");
    if (finalPlan.initialRulePassed !== false && !semantic.rulePassed) throw Error("Initial scene-delta sample failure was rewritten");
  }
  const correctionRequired = new Set([...randomRows, ...highRows, ...expansionRows, ...finalConfirmationRows].filter(item => item.status === "error" || item.status === "clarified").map(item => item.id));
  if ((!semantic.rulePassed || semantic.upperBound > 0.02) && (!finalConfirmation || !semantic.finalConfirmation?.confidenceTargetPassed)) throw Error("Scene-delta initial sample failed without an accepted fresh confidence-bound confirmation");
  if ([...correctionRequired].some(id => !correctionByPair.has(id)) || [...correctionByPair.keys()].some(id => !correctionRequired.has(id))) throw Error("Scene-delta correction chain does not account for every reviewed error");
  return { source: delta, acceptance, sourceSha256: input.sourceSha256, acceptanceSha256: input.acceptanceSha256, localeArtifactSha256, translations: localesByTranslation };
}
async function prepareDisplayAddendum(input: DisplayAddendumInput, source: Source, parentSourceSha256: string, sceneDelta: PreparedSceneDelta | undefined): Promise<PreparedDisplayAddendum> {
  if (!sceneDelta) throw Error("Published display addendum requires the pinned runtime scene lineage");
  const [sourceRaw, acceptanceRaw, runtimeRaw] = await Promise.all([
    readFile(input.sourcePath), readFile(input.acceptancePath), readFile(path.join(repositoryRoot, "data/policy-v6-student-actions.json"))
  ]);
  if (digest(sourceRaw) !== input.sourceSha256 || digest(acceptanceRaw) !== input.acceptanceSha256) throw Error("Published display addendum inputs changed");
  const addendum = JSON.parse(sourceRaw.toString("utf8")) as DisplayAddendumSource;
  const acceptance = JSON.parse(acceptanceRaw.toString("utf8")) as DisplayAddendumAcceptance;
  const runtime = JSON.parse(runtimeRaw.toString("utf8")) as { schools?: Record<string, { recordSha256?: string; claims?: Record<string, Record<string, unknown>> }> };
  const localeList = READING_LOCALES.filter((locale): locale is Exclude<ReadingLocale, "en"> => locale !== "en");
  const localeSet = new Set<ReadingLocale>(localeList);
  const expectedLocaleList = [...localeList];
  const school = source.schools.find(item => item.slug === "massachusetts-institute-of-technology");
  const runtimeSchool = runtime.schools?.["massachusetts-institute-of-technology"];
  const expectedFields = new Set([
    "/v6/studentActions/claims/mit-fact-01/deadline/en", "/v6/studentActions/claims/mit-fact-01/scope", "/v6/studentActions/claims/mit-fact-01/text",
    "/v6/studentActions/claims/mit-fact-02/scope", "/v6/studentActions/claims/mit-fact-02/text",
    "/v6/studentActions/claims/mit-fact-05/scope", "/v6/studentActions/claims/mit-fact-05/text",
    "/v6/studentActions/claims/mit-fact-11/scope", "/v6/studentActions/claims/mit-fact-11/text"
  ]);
  if (addendum.schemaVersion !== "uapt-published-display-addendum-source-v1" || addendum.parentSourceSha256 !== parentSourceSha256 || addendum.sceneSourceSha256 !== sceneDelta.sourceSha256 || addendum.publishedGuideBasisSha256 !== school?.recordSha256 || addendum.publishedGuideBasisSha256 !== runtimeSchool?.recordSha256 || addendum.publicationApproved !== false || addendum.policyAndEvidenceMutation !== false || JSON.stringify(addendum.targetLocales) !== JSON.stringify(expectedLocaleList) || !Array.isArray(addendum.units) || addendum.units.length !== 9) throw Error("Published display addendum source lineage or scope mismatch");
  if (acceptance.schemaVersion !== "uapt-reviewed-display-addendum-acceptance-v1" || acceptance.status !== "accepted" || acceptance.sourceSha256 !== input.sourceSha256 || acceptance.parentSourceSha256 !== parentSourceSha256 || acceptance.sceneSourceSha256 !== sceneDelta.sourceSha256 || acceptance.publishedGuideBasisSha256 !== addendum.publishedGuideBasisSha256 || acceptance.sourceStrings !== 9 || acceptance.targetLocales !== 32 || acceptance.targetPairs !== 288 || acceptance.fieldValidation !== "PASS" || acceptance.nativeSpeakerApproval !== false || acceptance.wholeSiteFullSemanticReview !== false || acceptance.publicationApproved !== false || acceptance.semanticAcceptance?.mode !== "full_machine_addendum_only" || acceptance.semanticAcceptance.checkedPairs !== 288 || acceptance.semanticAcceptance.confirmedErrorsBeforeCorrection < 0 || acceptance.semanticAcceptance.allDiscoveredCorrectionsApplied !== true || acceptance.semanticAcceptance.remainingIssues !== 0) throw Error("Published display addendum acceptance scope mismatch");
  const seenFields = new Set<string>(), sourceHashes = new Set<string>();
  for (const [index, unit] of addendum.units.entries()) {
    if (unit.index !== index || unit.basisObjectType !== "published_supplement" || !/^[a-f0-9]{64}$/.test(unit.sourceSha256) || digest(unit.source) !== unit.sourceSha256 || !Array.isArray(unit.uses) || unit.uses.length !== 1 || unit.uses[0].slug !== "massachusetts-institute-of-technology" || !expectedFields.has(unit.uses[0].field) || seenFields.has(unit.uses[0].field) || sourceHashes.has(unit.sourceSha256)) throw Error("Published display addendum contains an invalid field identity");
    const match = unit.uses[0].field.match(/^\/v6\/studentActions\/claims\/(mit-fact-(?:01|02|05|11))\/(text|scope|deadline\/en)$/);
    const value = match && runtimeSchool?.claims?.[match[1]]?.[match[2] === "deadline/en" ? "deadline" : match[2]];
    const exactRuntimeValue = match?.[2] === "deadline/en" && value && typeof value === "object" ? (value as { en?: unknown }).en : value;
    if (!match || typeof exactRuntimeValue !== "string" || exactRuntimeValue !== unit.source) throw Error("Published display addendum no longer matches the current published V6 field");
    if (match[2] === "deadline/en" && !expectedFields.has(unit.uses[0].field)) throw Error("Unexpected deadline field in published display addendum");
    seenFields.add(unit.uses[0].field); sourceHashes.add(unit.sourceSha256);
  }
  if (seenFields.size !== expectedFields.size) throw Error("Published display addendum does not cover its exact nine visible fields");
  const receiptRoot = await realpath(path.dirname(input.acceptancePath));
  const refs = acceptance.reviewArtifacts;
  if (!refs || Object.keys(refs).sort().join(",") !== "corrections,semantic" || new Set(Object.values(refs).map(ref => `${ref.path}:${ref.sha256}`)).size !== 2) throw Error("Published display addendum review references are incomplete");
  const [semanticRaw, correctionsRaw] = await Promise.all([readPinnedChild(receiptRoot, refs.semantic), readPinnedChild(receiptRoot, refs.corrections)]);
  const semantic = JSON.parse(semanticRaw.toString("utf8")) as { schemaVersion?: string; sourceSha256?: string; checkedCount?: number; checked?: SceneDeltaCheckedPair[] };
  const corrections = JSON.parse(correctionsRaw.toString("utf8")) as { schemaVersion?: string; sourceSha256?: string; status?: string; remainingIssues?: number; changes?: { locale: ReadingLocale; index: number; sourceSha256: string; originalTargetSha256: string; repairedTargetSha256: string; original: string; translation: string; reason: string; independentReview: "accepted"; kind: "semantic" | "source_ambiguity_clarification" }[]; finalOutputs?: Partial<Record<ReadingLocale, { path: string; sha256: string }>>; independentVerification?: { path: string; sha256: string } };
  if (semantic.schemaVersion !== "uapt-display-addendum-semantic-review-v1" || semantic.sourceSha256 !== input.sourceSha256 || semantic.checkedCount !== 288 || !Array.isArray(semantic.checked) || semantic.checked.length !== 288 || corrections.schemaVersion !== "uapt-display-addendum-corrections-v1" || corrections.sourceSha256 !== input.sourceSha256 || corrections.status !== "complete" || corrections.remainingIssues !== 0 || !Array.isArray(corrections.changes) || !corrections.finalOutputs) throw Error("Published display addendum semantic/correction artifacts are incomplete");
  const correctionById = new Map<string, NonNullable<typeof corrections.changes>[number]>();
  for (const change of corrections.changes) {
    if (!localeSet.has(change.locale) || !Number.isInteger(change.index) || change.index < 0 || change.index >= 9 || change.sourceSha256 !== addendum.units[change.index].sourceSha256 || digest(change.original) !== change.originalTargetSha256 || digest(change.translation) !== change.repairedTargetSha256 || !change.reason.trim() || change.independentReview !== "accepted" || !["semantic", "source_ambiguity_clarification"].includes(change.kind)) throw Error("Published display addendum correction chain is invalid");
    const id = `${change.locale}:${change.index}`;
    if (correctionById.has(id)) throw Error("Duplicate published display addendum correction");
    correctionById.set(id, change);
  }
  if (!corrections.independentVerification) throw Error("Published display addendum lacks its independent correction verification reference");
  const independentRaw = await readPinnedChild(receiptRoot, corrections.independentVerification);
  const independent = JSON.parse(independentRaw.toString("utf8")) as Record<string, unknown>;
  const independentChanges: IndependentCorrectionRow[] = [...correctionById.entries()].map(([id, change]) => ({ id, locale: change.locale, index: change.index, sourceSha256: change.sourceSha256, originalTargetSha256: change.originalTargetSha256, repairedTargetSha256: change.repairedTargetSha256, original: change.original, translation: change.translation, reason: change.reason, independentReview: change.independentReview, kind: change.kind }));
  verifyIndependentCorrectionArtifact(independent, { schemaVersion: "uapt-display-addendum-correction-verification-v1", sourceSha256: input.sourceSha256, changes: independentChanges, finalOutputs: corrections.finalOutputs as Record<string, { path: string; sha256: string }>, scene: false });
  const localeArtifactSha256: Partial<Record<ReadingLocale, string>> = {};
  const translations = new Map<ReadingLocale, Map<string, { source: string; translation: string }>>();
  if (Object.keys(acceptance.locales ?? {}).length !== 32 || Object.keys(corrections.finalOutputs).length !== 32) throw Error("Published display addendum locale inventory is incomplete");
  for (const locale of localeList) {
    const ref = acceptance.locales[locale], finalRef = corrections.finalOutputs[locale];
    if (!ref || ref.fields !== 9 || !/^[a-f0-9]{64}$/.test(ref.sha256) || !finalRef || ref.path !== finalRef.path || ref.sha256 !== finalRef.sha256) throw Error(`Published display addendum final output reference mismatch: ${locale}`);
    const raw = await readPinnedChild(receiptRoot, ref);
    localeArtifactSha256[locale] = ref.sha256;
    const parsed = JSON.parse(raw.toString("utf8")) as { schemaVersion?: string; sourceSha256?: string; locale?: string; translations?: unknown; publicationApproved?: boolean };
    if (parsed.schemaVersion !== "uapt-display-addendum-translation-candidate-v1" || parsed.sourceSha256 !== input.sourceSha256 || parsed.locale !== locale || parsed.publicationApproved !== false || !Array.isArray(parsed.translations) || parsed.translations.length !== 9 || parsed.translations.some(text => typeof text !== "string" || !text.trim())) throw Error(`Published display addendum translation inventory mismatch: ${locale}`);
    translations.set(locale, new Map(addendum.units.map((unit, index) => [unit.sourceSha256, { source: unit.source, translation: (parsed.translations as string[])[index] }])));
  }
  const checkedIds = new Set<string>();
  for (const row of semantic.checked) {
    if (!localeSet.has(row.locale) || !Number.isInteger(row.index) || row.index < 0 || row.index >= 9) throw Error("Published display addendum semantic review has an unknown locale/index");
    const unit = addendum.units[row.index], id = `${row.locale}:${row.index}`;
    if (row.id !== id || row.sourceSha256 !== unit.sourceSha256 || !/^[a-f0-9]{64}$/.test(row.targetSha256) || !["approved", "error", "clarified"].includes(row.status) || checkedIds.has(id)) throw Error("Published display addendum semantic review does not bind exact source pairs");
    const finalTarget = translations.get(row.locale)!.get(unit.sourceSha256)!.translation, finalHash = digest(finalTarget), correction = correctionById.get(id);
    if (row.status === "approved" ? row.targetSha256 !== finalHash || correction : !correction || correction.originalTargetSha256 !== row.targetSha256 || correction.repairedTargetSha256 !== finalHash || (row.status === "error" ? correction.kind !== "semantic" : correction.kind !== "source_ambiguity_clarification")) throw Error("Published display addendum semantic result does not match its final correction chain");
    checkedIds.add(id);
  }
  if (checkedIds.size !== 288 || correctionById.size !== [...semantic.checked].filter(row => row.status === "error" || row.status === "clarified").length || acceptance.semanticAcceptance.confirmedErrorsBeforeCorrection !== semantic.checked.filter(row => row.status === "error").length) throw Error("Published display addendum has missing semantic rows or unreviewed corrections");
  return { source: addendum, acceptance, sourceSha256: input.sourceSha256, acceptanceSha256: input.acceptanceSha256, localeArtifactSha256, translations };
}
function separateUrlSuffix(source: string, target: string): string {
  const sourceUrls = [...source.matchAll(/https?:\/\/[^\s<>"']+/g)].map(match => match[0]);
  return target.replace(/https?:\/\/[^\s<>"']+/g, token => {
    const exact = sourceUrls.find(url => token.startsWith(url) && token.length > url.length);
    if (!exact) return token;
    const suffix = token.slice(exact.length);
    // Some accepted translations attach script-specific inflection directly
    // to an otherwise exact URL. Split only that exact URL boundary.
    return /^[-\p{L}\p{N}\p{P}]/u.test(suffix) ? `${exact} ${suffix}` : token;
  });
}

/** Packages reviewed delivery only. No generator access, source edits or publication. */
export async function packReadingTranslations(sourcePath: string, sourceSha256: string, deliveryPath: string, output: string) {
  const raw = await readFile(sourcePath);
  if (digest(raw) !== sourceSha256) throw Error("Frozen translation source changed");
  const source = JSON.parse(raw.toString("utf8")) as Source;
  const delivery = JSON.parse(await readFile(deliveryPath, "utf8")) as Delivery;
  if (source.schemaVersion !== "uapt-multilingual-source-v1" || !source.schools?.length || !source.units || new Set(source.schools.map(s => s.slug)).size !== source.schools.length) throw Error("Invalid source inventory");
  if (source.schools.some(school => !Array.isArray(school.publicClaimIds) || school.publicClaimIds.some(id => typeof id !== "string" || !id || id.length > 300))) throw Error("Invalid frozen Claim inventory");
  const claimIds = [...new Set(source.schools.flatMap(school => school.publicClaimIds))].sort((a, b) => b.length - a.length);
  const claimIdPattern = claimIds.length ? new RegExp(claimIds.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g") : undefined;
  const claimIdsBySource = new Map<string, string[]>();
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
      for (const school of [{ slug: "_shared", recordSha256: sourceSha256, originalEvidenceSha256: sourceSha256 }, ...source.schools]) bySlug.set(school.slug, { schemaVersion: "uapt-reading-translations-v1", sourceSha256, locale, slug: school.slug, recordSha256: school.recordSha256, originalEvidenceSha256: school.originalEvidenceSha256, review: { status: "accepted", receiptSha256: accepted.receipt.sha256 }, protectedClaimIds: [], requiredSourceHashes: [], strings: {} });
      for (const [id, unit] of Object.entries(source.units)) for (const use of unit.uses) {
        const bundle = bySlug.get(use.slug);
        if (!bundle) throw Error("Translation points outside source school set");
        const original = use.source ?? unit.source;
        const sourceId = digest(original);
        let sourceClaimIds = claimIdsBySource.get(sourceId);
        if (!sourceClaimIds) { sourceClaimIds = claimIdPattern ? [...new Set(original.match(claimIdPattern) ?? [])] : []; claimIdsBySource.set(sourceId, sourceClaimIds); }
        bundle.protectedClaimIds.push(...sourceClaimIds);
        if (use.sourceSha256 && use.sourceSha256 !== sourceId) throw Error("Display source substitution changed");
        const substitute = (text: string) => text.replace(/\{([^{}]+)\}/g, (token, key: string) => use.substitutions?.[key] ?? token);
        if (use.source && substitute(unit.source) !== original) throw Error("Source template no longer reproduces its display");
        const translated = substitute(accepted.strings[id]);
        const existing = bundle.strings[sourceId];
        if (existing && existing.translation !== translated) throw Error("Conflicting exact-source translation");
        bundle.strings[sourceId] = { source: original, sourceSha256: sourceId, translation: translated };
      }
      for (const [slug, bundle] of bySlug) {
        bundle.protectedClaimIds = [...new Set(bundle.protectedClaimIds)].sort();
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

/** Packages the hash-pinned final matrix with an honest sampling-acceptance receipt. */
export async function packAcceptedMatrixCandidate(sourcePath: string, sourceSha256: string, matrixPath: string, matrixSha256: string, acceptancePath: string, acceptanceSha256: string, output: string, sceneDeltaInput?: SceneDeltaInput, displayAddendumInput?: DisplayAddendumInput) {
  const [sourceRaw, matrixRaw, acceptanceRaw] = await Promise.all([readFile(sourcePath), readFile(matrixPath), readFile(acceptancePath)]);
  if (digest(sourceRaw) !== sourceSha256 || digest(matrixRaw) !== matrixSha256 || digest(acceptanceRaw) !== acceptanceSha256) throw Error("Accepted translation inputs changed");
  const source = JSON.parse(sourceRaw.toString("utf8")) as Source;
  const matrix = JSON.parse(matrixRaw.toString("utf8")) as AcceptedMatrix;
  const acceptance = JSON.parse(acceptanceRaw.toString("utf8"));
  if (source.schemaVersion !== "uapt-multilingual-source-v1" || sourceSha256 !== matrix.sourceSha256 || matrix.schemaVersion !== "uapt-repaired-translation-matrix-v1" || matrix.fieldValidation !== "PASS" || matrix.missingPairs !== 0 || matrix.publicationApproved !== false || acceptance.sourceSha256 !== sourceSha256 || acceptance.finalMatrixSha256 !== matrixSha256 || acceptance.publicationApproved !== false || acceptance.wholeCorpusFullMachineSemanticReview !== false || acceptance.status !== "COMPLETE_CANDIDATE_COVERAGE_AND_SAMPLING_ACCEPTED") throw Error("Translation candidate acceptance basis mismatch");
  if (source.schools.length !== acceptance.schools || Object.keys(source.units).length !== acceptance.sourceStrings || matrix.rows.length !== matrix.batches || acceptance.targetLocales !== matrix.targetLocales || matrix.fields !== acceptance.targetPairs || !matrix.semanticAcceptance.confirmationRulePassed || matrix.semanticAcceptance.wholeCorpusSemanticReview || matrix.semanticAcceptance.nativeSpeakerApproval) throw Error("Accepted matrix counts or scope differ");
  const sourceBySlug = new Map(source.schools.map(school => [school.slug, school]));
  const localeRows = new Map<ReadingLocale, typeof matrix.rows>();
  for (const row of matrix.rows) {
    if (!READING_LOCALES.includes(row.locale) || row.locale === "en" || !/^[a-f0-9]{64}$/.test(row.sha256) || !path.isAbsolute(row.path)) throw Error("Invalid matrix row identity");
    localeRows.set(row.locale, [...(localeRows.get(row.locale) ?? []), row]);
  }
  const targetLocales = READING_LOCALES.filter(locale => locale !== "en");
  if (targetLocales.some(locale => !localeRows.has(locale)) || localeRows.size !== targetLocales.length) throw Error("Incomplete target locale set");
  const translationsByLocale = new Map<ReadingLocale, Map<string, string>>();
  const expectedBatchMaps = canonicalBatchMaps(source);
  if (Object.keys(expectedBatchMaps).length * targetLocales.length !== matrix.rows.length) throw Error("Deterministic frozen source partition differs from accepted batch inventory");
  let checkedFields = 0;
  for (const locale of targetLocales) {
    const translations = new Map<string, string>();
    for (const row of localeRows.get(locale)!) {
      const candidateRaw = await readFile(row.path);
      if (digest(candidateRaw) !== row.sha256) throw Error(`Matrix candidate hash mismatch: ${locale}/${row.batch}`);
      const candidateValue = JSON.parse(candidateRaw.toString("utf8")) as Record<string, unknown>;
      const candidate = typeof candidateValue.final === "string" ? JSON.parse(candidateValue.final) as Record<string, string> : candidateValue as Record<string, string>;
      const expectedIds = expectedBatchMaps[row.batch];
      if (!expectedIds) throw Error(`Unknown deterministic source partition: ${locale}/${row.batch}`);
      // Any available historical source map is checked against the map rebuilt
      // from the frozen source; output keys alone cannot define their own source.
      try {
        const inputPath = await matrixInputPath(sourcePath, row);
        const inputValue = JSON.parse(await readFile(inputPath, "utf8")) as { locale?: string; sourceSha256?: string; sourceIds?: Record<string, string>; strings?: Record<string, string> };
        const expectedStrings = Object.fromEntries(Object.entries(expectedIds).map(([key, id]) => [key, source.units[id].source]));
        if (inputValue.locale !== locale || inputValue.sourceSha256 !== sourceSha256 || JSON.stringify(inputValue.sourceIds) !== JSON.stringify(expectedIds) || JSON.stringify(inputValue.strings) !== JSON.stringify(expectedStrings)) throw Error(`Frozen source-map assignment mismatch: ${locale}/${row.batch}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Frozen source-map assignment mismatch")) throw error;
        // Some final candidates are correction-only artifacts with no sibling
        // input file. Their exact assignment is still rebuilt and checked here.
      }
      const keys = Object.keys(expectedIds);
      if (keys.length !== row.fields || Object.keys(candidate).length !== row.fields || keys.some(key => !Object.hasOwn(candidate, key))) throw Error(`Matrix field count mismatch: ${locale}/${row.batch}`);
      for (const key of keys) {
        const sourceId = expectedIds[key], unit = source.units[sourceId], translated = candidate[key];
        if (!unit || digest(unit.source) !== sourceId || typeof translated !== "string" || !translated.trim() || translations.has(sourceId)) throw Error(`Invalid or duplicate matrix field: ${locale}/${key}`);
        translations.set(sourceId, translated);
        checkedFields++;
      }
    }
    if (translations.size !== Object.keys(source.units).length) throw Error(`Incomplete translated source units: ${locale}`);
    translationsByLocale.set(locale, translations);
  }
  if (checkedFields !== matrix.fields) throw Error("Total matrix field count mismatch");
  const sceneDelta = sceneDeltaInput ? await prepareSceneDelta(sceneDeltaInput, source, sourceSha256) : undefined;
  const displayAddendum = displayAddendumInput ? await prepareDisplayAddendum(displayAddendumInput, source, sourceSha256, sceneDelta) : undefined;
  const claimIds = [...new Set(source.schools.flatMap(school => school.publicClaimIds))].sort((a, b) => b.length - a.length);
  const claimPattern = claimIds.length ? new RegExp(claimIds.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g") : undefined;
  const statusEnumExceptions: NonNullable<NonNullable<ReadingTranslationSelection["samplingAcceptance"]>["statusEnumExceptions"]> = [];
  const urlBoundaryRepairs: NonNullable<NonNullable<ReadingTranslationSelection["samplingAcceptance"]>["urlBoundaryRepairs"]> = [];
  const selection: ReadingTranslationSelection = {
    schemaVersion: "uapt-reading-selection-v1", revision: "reading-" + matrixSha256.slice(0, 20) + (sceneDelta ? "-scene-" + sceneDelta.acceptanceSha256.slice(0, 8) : "") + (displayAddendum ? "-mit-" + displayAddendum.acceptanceSha256.slice(0, 8) : ""), sourceSha256,
    publicationApproved: false, candidateOnly: true,
    samplingAcceptance: { schemaVersion: "uapt-translation-sampling-acceptance-v1", sourceSha256, matrixSha256, acceptanceSha256, targetPairs: acceptance.targetPairs, randomConfirmationSize: acceptance.finalConfirmation.sampleSize, confirmedErrorsBeforeCorrection: acceptance.finalConfirmation.confirmedErrorsBeforeCorrection, oneSidedUpperBound: acceptance.finalConfirmation.upperBound, fullCorpusSemanticReview: false, nativeSpeakerApproval: false, statusEnumExceptions, urlBoundaryRepairs },
    ...(sceneDelta || displayAddendum ? { supplemental: {
      ...(sceneDelta ? { sceneDelta: {
        schemaVersion: "uapt-reading-scene-delta-package-v1" as const, sourceSha256: sceneDelta.sourceSha256, parentSourceSha256: sourceSha256, acceptanceSha256: sceneDelta.acceptanceSha256,
        sourceStrings: sceneDelta.source.units.length, targetLocales: sceneDelta.translations.size, targetPairs: sceneDelta.source.units.length * sceneDelta.translations.size,
        sourceHashes: sceneDelta.source.units.map(unit => unit.sourceSha256),
        locales: Object.fromEntries([...sceneDelta.translations.keys()].map(locale => [locale, { sourceArtifactSha256: sceneDelta.localeArtifactSha256[locale]!, sourceStrings: sceneDelta.source.units.length, targetPairs: sceneDelta.source.units.length }]))
      } } : {}),
      ...(displayAddendum ? { displayAddendum: {
        schemaVersion: "uapt-reading-display-addendum-package-v1" as const, sourceSha256: displayAddendum.sourceSha256, parentSourceSha256: sourceSha256, parentSceneSourceSha256: sceneDelta!.sourceSha256, acceptanceSha256: displayAddendum.acceptanceSha256,
        sourceStrings: displayAddendum.source.units.length, targetLocales: displayAddendum.translations.size, targetPairs: displayAddendum.source.units.length * displayAddendum.translations.size,
        sourceHashes: displayAddendum.source.units.map(unit => unit.sourceSha256),
        usesBySlug: Object.fromEntries([...new Set(displayAddendum.source.units.flatMap(unit => unit.uses.map(use => use.slug)))].map(slug => [slug, Object.fromEntries(displayAddendum.source.units.flatMap(unit => unit.uses.filter(use => use.slug === slug).map(use => [unit.sourceSha256, [use.field]])))])),
        locales: Object.fromEntries([...displayAddendum.translations.keys()].map(locale => [locale, { sourceArtifactSha256: displayAddendum.localeArtifactSha256[locale]!, sourceStrings: displayAddendum.source.units.length, targetPairs: displayAddendum.source.units.length }]))
      } } : {})
    } } : {}),
    shared: {}, schools: {}
  };
  const prepared: { file: string; text: string; slug: string; locale: ReadingLocale; sha256: string }[] = [];
  for (const locale of targetLocales) {
    const translated = translationsByLocale.get(locale)!;
    const bundles = new Map<string, ReadingTranslationBundle>();
    for (const school of [{ slug: "_shared", recordSha256: sourceSha256, originalEvidenceSha256: sourceSha256, publicClaimIds: [] as string[] }, ...source.schools]) {
      bundles.set(school.slug, { schemaVersion: "uapt-reading-translations-v1", sourceSha256, locale, slug: school.slug, recordSha256: school.recordSha256, originalEvidenceSha256: school.originalEvidenceSha256, review: { status: "accepted", receiptSha256: acceptanceSha256 }, protectedClaimIds: [], requiredSourceHashes: [], strings: {} });
    }
    for (const unit of Object.values(source.units)) for (const use of unit.uses) {
      const bundle = bundles.get(use.slug), school = sourceBySlug.get(use.slug);
      if (!bundle) throw Error("Translation points outside source school set");
      const original = use.source ?? unit.source, sourceId = digest(original);
      if (use.sourceSha256 && use.sourceSha256 !== sourceId) throw Error("Source display substitution changed");
      const claimList = use.claimIds ?? school?.publicClaimIds ?? [];
      const detected = claimPattern ? [...new Set(original.match(claimPattern) ?? [])] : [];
      bundle.protectedClaimIds.push(...detected, ...claimList.filter(id => original.includes(id)));
      const substitute = (text: string) => text.replace(/\{([^{}]+)\}/g, (token, key: string) => use.substitutions?.[key] ?? token);
      if (use.source && substitute(unit.source) !== original) throw Error("Source template no longer reproduces frozen display");
      const acceptedText = substitute(translated.get(unit.sourceSha256)!);
      const result = separateUrlSuffix(original, acceptedText);
      if (result !== acceptedText) urlBoundaryRepairs.push({ locale, sourceSha256: sourceId, originalTargetSha256: digest(acceptedText), repairedTargetSha256: digest(result) });
      const markerCounts = (text: string) => {
        const tokens = [...new Set([...text.matchAll(/\b[a-z]+(?:_[a-z]+)+\b|\b(?:PARTIAL|UNVERIFIED)\b/g)].map(match => match[0]))];
        return new Map(tokens.map(token => [token, text.split(token).length - 1]));
      };
      const sourceMarkers = markerCounts(original), targetMarkers = markerCounts(result);
      for (const [marker, count] of targetMarkers) {
        const extra = count - (sourceMarkers.get(marker) ?? 0);
        const phrases: Record<string, string> = { conditionally_allowed: "conditionally allowed", institutionally_licensed_or_procured: "institutionally licensed or procured", officially_endorsed: "officially endorsed", not_specified: "not specified", not_mentioned: "not mentioned", PARTIAL: "partial" };
        if (extra <= 0) continue;
        if (!phrases[marker] || !original.toLowerCase().includes(phrases[marker])) throw Error(`Unreviewed added marker: ${locale}/${sourceId}:${marker}`);
        for (let index = 0; index < extra; index++) statusEnumExceptions.push({ locale, sourceSha256: sourceId, targetSha256: digest(result), marker });
      }
      const prior = bundle.strings[sourceId];
      if (prior && prior.translation !== result) throw Error("Conflicting exact-source translation");
      bundle.strings[sourceId] = { source: original, sourceSha256: sourceId, translation: result };
      if (use.field) {
        bundle.sourceFieldUses ??= {};
        bundle.sourceFieldUses[sourceId] ??= [];
        bundle.sourceFieldUses[sourceId]!.push(use.field);
      }
    }
    if (sceneDelta) {
      const extra = sceneDelta.translations.get(locale);
      if (!extra) throw Error(`Scene-delta translations missing: ${locale}`);
      const sceneUnitsByHash = new Map(sceneDelta.source.units.map(unit => [unit.sourceSha256, unit]));
      for (const [sourceId, pair] of extra) {
        if (Object.hasOwn(source.units, sourceId)) throw Error(`Scene-delta source duplicates frozen base unit: ${sourceId}`);
        const unit = sceneUnitsByHash.get(sourceId);
        if (!unit) throw Error("Scene-delta translation points outside pinned source units");
        for (const use of unit.uses) {
          const bundle = bundles.get(use.slug);
          if (!bundle) throw Error("Scene-delta translation points outside source school set");
          const prior = bundle.strings[sourceId];
          if (prior && (prior.source !== pair.source || prior.translation !== pair.translation)) throw Error("Conflicting scene-delta display translation");
          if (!prior) bundle.strings[sourceId] = { source: pair.source, sourceSha256: sourceId, translation: pair.translation };
          bundle.sourceFieldUses ??= {};
          bundle.sourceFieldUses[sourceId] ??= [];
          bundle.sourceFieldUses[sourceId]!.push(use.field);
          bundle.supplementalSceneDelta ??= { sourceSha256: sceneDelta.sourceSha256, acceptanceSha256: sceneDelta.acceptanceSha256, sourceHashes: [] };
          bundle.supplementalSceneDelta.fieldUses ??= {};
          bundle.supplementalSceneDelta.fieldUses[sourceId] ??= [];
          bundle.supplementalSceneDelta.fieldUses[sourceId]!.push(use.field);
          if (bundle.supplementalSceneDelta.sourceSha256 !== sceneDelta.sourceSha256 || bundle.supplementalSceneDelta.acceptanceSha256 !== sceneDelta.acceptanceSha256) throw Error("Conflicting supplemental scene-delta receipt");
          bundle.supplementalSceneDelta.sourceHashes.push(sourceId);
          const ids = claimPattern ? [...new Set(pair.source.match(claimPattern) ?? [])] : [];
          bundle.protectedClaimIds.push(...ids);
        }
      }
    }
    if (displayAddendum) {
      const extra = displayAddendum.translations.get(locale);
      if (!extra) throw Error(`Published display addendum translations missing: ${locale}`);
      const unitsByHash = new Map(displayAddendum.source.units.map(unit => [unit.sourceSha256, unit]));
      for (const [sourceId, pair] of extra) {
        if (Object.hasOwn(source.units, sourceId) || sceneDelta?.source.units.some(unit => unit.sourceSha256 === sourceId)) throw Error(`Published display addendum source overlaps existing translation lineage: ${sourceId}`);
        const unit = unitsByHash.get(sourceId);
        if (!unit) throw Error("Published display addendum points outside pinned units");
        for (const use of unit.uses) {
          const bundle = bundles.get(use.slug);
          if (!bundle) throw Error("Published display addendum points outside source school set");
          const prior = bundle.strings[sourceId];
          if (prior && (prior.source !== pair.source || prior.translation !== pair.translation)) throw Error("Conflicting published display addendum translation");
          if (!prior) bundle.strings[sourceId] = { source: pair.source, sourceSha256: sourceId, translation: pair.translation };
          bundle.sourceFieldUses ??= {};
          bundle.sourceFieldUses[sourceId] ??= [];
          bundle.sourceFieldUses[sourceId]!.push(use.field);
          bundle.supplementalDisplayAddendum ??= { sourceSha256: displayAddendum.sourceSha256, acceptanceSha256: displayAddendum.acceptanceSha256, sourceHashes: [], fieldUses: {} };
          bundle.supplementalDisplayAddendum.fieldUses![sourceId] ??= [];
          bundle.supplementalDisplayAddendum.fieldUses![sourceId]!.push(use.field);
          if (bundle.supplementalDisplayAddendum.sourceSha256 !== displayAddendum.sourceSha256 || bundle.supplementalDisplayAddendum.acceptanceSha256 !== displayAddendum.acceptanceSha256) throw Error("Conflicting published display addendum receipt");
          bundle.supplementalDisplayAddendum.sourceHashes.push(sourceId);
        }
      }
    }
    for (const [slug, bundle] of bundles) {
      bundle.protectedClaimIds = [...new Set(bundle.protectedClaimIds)].sort();
      bundle.requiredSourceHashes = Object.keys(bundle.strings).sort();
      if (bundle.sourceFieldUses) for (const key of Object.keys(bundle.sourceFieldUses)) bundle.sourceFieldUses[key] = [...new Set(bundle.sourceFieldUses[key]!)].sort();
      if (bundle.supplementalSceneDelta) bundle.supplementalSceneDelta.sourceHashes = [...new Set(bundle.supplementalSceneDelta.sourceHashes)].sort();
      if (bundle.supplementalSceneDelta?.fieldUses) for (const key of Object.keys(bundle.supplementalSceneDelta.fieldUses)) bundle.supplementalSceneDelta.fieldUses[key] = [...new Set(bundle.supplementalSceneDelta.fieldUses[key]!)].sort();
      if (bundle.supplementalDisplayAddendum) bundle.supplementalDisplayAddendum.sourceHashes = [...new Set(bundle.supplementalDisplayAddendum.sourceHashes)].sort();
      if (bundle.supplementalDisplayAddendum?.fieldUses) for (const key of Object.keys(bundle.supplementalDisplayAddendum.fieldUses)) bundle.supplementalDisplayAddendum.fieldUses[key] = [...new Set(bundle.supplementalDisplayAddendum.fieldUses[key]!)].sort();
      try { validateReadingTranslationBundle(bundle, { sourceSha256, locale, slug }, { statusEnumExceptions, matchAcceptedBrandVocabulary: true }); }
      catch (error) { throw Error(`${locale}/${slug}: ${error instanceof Error ? error.message : "bundle validation failed"}`); }
      const text = JSON.stringify(bundle) + "\n", file = `${locale}/${slug}.json`;
      prepared.push({ file, text, slug, locale, sha256: digest(text) });
    }
  }
  selection.samplingAcceptance!.packageAdjustmentSha256 = digest(JSON.stringify({ statusEnumExceptions, urlBoundaryRepairs }));
  if (await import("node:fs/promises").then(fs => fs.stat(output).then(() => true, () => false))) throw Error("Candidate output already exists");
  await mkdir(output, { recursive: false });
  for (const locale of targetLocales) await mkdir(path.join(output, locale));
  for (const item of prepared) {
    await writeFile(path.join(output, item.file), item.text, { flag: "wx" });
    const ref = { path: item.file, sha256: item.sha256 };
    if (item.slug === "_shared") selection.shared[item.locale] = ref;
    else (selection.schools[item.slug] ??= {})[item.locale] = ref;
  }
  const manifest = JSON.stringify(selection, null, 2) + "\n";
  await writeFile(path.join(output, "selection.json"), manifest, { flag: "wx" });
  await writeFile(path.join(output, "candidate.json"), JSON.stringify({ path: "selection.json", sha256: digest(manifest) }, null, 2) + "\n", { flag: "wx" });
  return { revision: selection.revision, schools: source.schools.length, readingLocales: READING_LOCALES.length, translatedLocales: targetLocales.length, sourceStrings: Object.keys(source.units).length, targetPairs: checkedFields, supplementalSourceStrings: sceneDelta?.source.units.length ?? 0, supplementalTargetPairs: sceneDelta?.source.units.length ? sceneDelta.source.units.length * (sceneDelta.translations.size) : 0, displayAddendumSourceStrings: displayAddendum?.source.units.length ?? 0, displayAddendumTargetPairs: displayAddendum?.source.units.length ? displayAddendum.source.units.length * displayAddendum.translations.size : 0, bundles: prepared.length, publicationApproved: false, candidateOnly: true, matrixSha256, acceptanceSha256, ...(sceneDelta ? { supplementalSourceSha256: sceneDelta.sourceSha256, supplementalAcceptanceSha256: sceneDelta.acceptanceSha256 } : {}), ...(displayAddendum ? { displayAddendumSourceSha256: displayAddendum.sourceSha256, displayAddendumAcceptanceSha256: displayAddendum.acceptanceSha256 } : {}) };
}

/** Build a single-reviewed-pair overlay without rewriting the frozen candidate or copying its unchanged bundles. */
export async function packReviewedFaCorrectionOverlay(input: {
  packageRoot: string; basePointerPath: string; expectedBaseSelectionSha256: string;
  publishedRegistryPath: string; publishedRegistrySha256: string;
  authorizationPath: string; authorizationSha256: string; independentReviewPath: string; independentReviewSha256: string;
  evidenceOutput: string; versionTag?: "v1" | "v2";
}) {
  const root = await realpath(input.packageRoot);
  const [pointerBytes, authorizationBytes, reviewBytes, publishedRegistryBytes] = await Promise.all([
    readFile(input.basePointerPath), readFile(input.authorizationPath), readFile(input.independentReviewPath), readFile(input.publishedRegistryPath)
  ]);
  if (!/^[a-f0-9]{64}$/.test(input.expectedBaseSelectionSha256) || !/^[a-f0-9]{64}$/.test(input.authorizationSha256) || !/^[a-f0-9]{64}$/.test(input.independentReviewSha256) ||
      !/^[a-f0-9]{64}$/.test(input.publishedRegistrySha256) || digest(authorizationBytes) !== input.authorizationSha256 || digest(reviewBytes) !== input.independentReviewSha256 || digest(publishedRegistryBytes) !== input.publishedRegistrySha256) throw Error("Fa correction provenance hash mismatch");
  const authorization = JSON.parse(authorizationBytes.toString("utf8")) as { schemaVersion?: string; status?: string; deploymentAuthorized?: boolean; authorizationDate?: string; scope?: string };
  const review = JSON.parse(reviewBytes.toString("utf8")) as { schemaVersion?: string; status?: string; publicationApproved?: boolean; correctionReview?: Record<string, unknown> };
  if (authorization.schemaVersion !== "uapt-unified-release-authorization-v1" || authorization.status !== "authorized" || authorization.deploymentAuthorized !== true || authorization.authorizationDate !== "2026-11-01" ||
    review.schemaVersion !== "uapt-independent-unified-release-review-v1" || review.status !== "correction_string_accepted_package_review_pending" || review.publicationApproved !== false || review.correctionReview?.id !== "mit-fa-coursework-assessment-scope" ||
      review.correctionReview?.sourceSha256 !== "0121eef99e07691f4445a369d0ee4b31311803e55f43f23525563a6914844166" ||
      review.correctionReview?.oldTargetSha256 !== "82f5cd6b5c4769d2253edf7cac4519015b6d630e866df71cea080c953255f4ad" ||
      review.correctionReview?.newTargetSha256 !== "1fc1e742c2b674a3cfe7922d998774808430ff6c35b3d013173f39b6fdfdc439" ||
      review.correctionReview?.candidateSelectionSha256 !== input.expectedBaseSelectionSha256 || review.correctionReview?.activated !== false ||
      review.correctionReview?.acceptedNewTargetText !== "خط‌مشی‌های خاص هر درس مجوز ارزیابی را تعیین می‌کنند. راهنمای دانشکده مجوز یا ممنوعیت کلی برای تکالیف درسی تعیین نمی‌کند.") throw Error("Fa correction review or authorization scope mismatch");
  const publishedRegistry = JSON.parse(publishedRegistryBytes.toString("utf8")) as { slugs?: unknown; sha256?: unknown };
  if (!Array.isArray(publishedRegistry.slugs) || publishedRegistry.slugs.length !== 132 || new Set(publishedRegistry.slugs).size !== 132 || publishedRegistry.sha256 !== "c255f48a2af3a12f87fee60bfe168ca768cc3504889a5d9f278264c23db31e3c") throw Error("Current published V6 registry scope changed");
  const basePointer = JSON.parse(pointerBytes.toString("utf8")) as { path?: string; sha256?: string };
  if (basePointer.sha256 !== input.expectedBaseSelectionSha256) throw Error("Frozen base selection pointer changed");
  const baseSelectionBytes = await readPinnedChild(root, { path: basePointer.path ?? "", sha256: basePointer.sha256 });
  const selection = JSON.parse(baseSelectionBytes.toString("utf8")) as ReadingTranslationSelection;
  if (selection.schemaVersion !== "uapt-reading-selection-v1" || selection.publicationApproved !== false || selection.candidateOnly !== true || selection.sampledPublicationAcceptance ||
      selection.supplemental?.faCorrection || selection.sourceSha256 !== "1421468eed9a13e5c77cb4321436d594a138b446412a87fd7b3f12908c88d2ba") throw Error("Frozen base selection is not an eligible candidate parent");
  const publishedSlugs = publishedRegistry.slugs as string[];
  if (publishedSlugs.some(slug => !selection.schools[slug]) || !publishedSlugs.includes("massachusetts-institute-of-technology")) throw Error("Published V6 scope is not covered by the frozen translation candidate");
  selection.schools = Object.fromEntries(publishedSlugs.map(slug => [slug, selection.schools[slug]]));
  const school = "massachusetts-institute-of-technology" as const;
  const locale = "fa" as const;
  const sourceSha256 = "0121eef99e07691f4445a369d0ee4b31311803e55f43f23525563a6914844166";
  const oldTargetSha256 = "82f5cd6b5c4769d2253edf7cac4519015b6d630e866df71cea080c953255f4ad";
  const newTranslation = "خط‌مشی‌های خاص هر درس مجوز ارزیابی را تعیین می‌کنند. راهنمای دانشکده مجوز یا ممنوعیت کلی برای تکالیف درسی تعیین نمی‌کند.";
  const targetSha256 = digest(newTranslation);
  const fieldUses = ["/v6/schools/0/topics/0/summary", "/v6/studentActions/topics/coursework/en"];
  if (targetSha256 !== "1fc1e742c2b674a3cfe7922d998774808430ff6c35b3d013173f39b6fdfdc439") throw Error("Fa correction target differs from the independent review");
  const bundleRef = selection.schools[school]?.[locale];
  if (!bundleRef) throw Error("Frozen Fa MIT bundle missing");
  const originalBundleBytes = await readPinnedChild(root, bundleRef);
  const bundle = JSON.parse(originalBundleBytes.toString("utf8")) as ReadingTranslationBundle;
  const oldUnit = bundle.strings[sourceSha256];
  if (bundle.locale !== locale || bundle.slug !== school || !oldUnit || oldUnit.source !== "Course-specific policies determine assessment permission. The faculty guidance does not establish a universal coursework permission or prohibition." || digest(oldUnit.translation) !== oldTargetSha256 ||
      JSON.stringify(bundle.sourceFieldUses?.[sourceSha256]) !== JSON.stringify(fieldUses)) throw Error("Frozen Fa translation basis or field uses changed");
  bundle.strings[sourceSha256] = { ...oldUnit, translation: newTranslation };
  const candidateExceptions = selection.samplingAcceptance?.statusEnumExceptions ?? [];
  validateReadingTranslationBundle(bundle, { sourceSha256: selection.sourceSha256, locale, slug: school }, { statusEnumExceptions: candidateExceptions, matchAcceptedBrandVocabulary: true });
  const bundleBytes = Buffer.from(JSON.stringify(bundle) + "\n");
  const bundleSha256 = digest(bundleBytes);
  const correctionReceipt = {
    schemaVersion: "uapt-reviewed-fa-display-correction-v1" as const, status: "reviewed" as const, publicationApproved: false as const,
    parentSelectionSha256: input.expectedBaseSelectionSha256, sourceSha256, originalTargetSha256: oldTargetSha256, targetSha256,
    slug: school, locale, fieldUses, authorizationSha256: input.authorizationSha256, independentReviewSha256: input.independentReviewSha256,
    semanticScope: "one source-bound display translation; first sentence preserved and second limited to coursework",
    semanticReviewScope: "independent string-level review only; no full-corpus semantic or native-speaker approval"
  };
  const correctionBytes = Buffer.from(JSON.stringify(correctionReceipt, null, 2) + "\n");
  const correctionSha256 = digest(correctionBytes);
  const newSelection = structuredClone(selection);
  newSelection.revision += "-fa-coursework-" + correctionSha256.slice(0, 8);
  newSelection.schools[school]![locale] = { path: "fa-correction-v1/fa/massachusetts-institute-of-technology.json", sha256: bundleSha256 };
  newSelection.supplemental ??= {};
  newSelection.supplemental.faCorrection = {
    schemaVersion: "uapt-reading-fa-display-correction-v1", acceptanceSha256: correctionSha256, sourceSha256, originalTargetSha256: oldTargetSha256,
    targetSha256, parentSelectionSha256: input.expectedBaseSelectionSha256, slug: school, locale, fieldUses,
    receipt: { path: "fa-correction-v1/correction-receipt.json", sha256: correctionSha256 }
  };
  const versionTag = input.versionTag ?? "v1";
  if (versionTag === "v2") {
    newSelection.revision += "-v2";
    newSelection.sampledPublicationAcceptance = {
      schemaVersion: "uapt-reviewed-sampled-translation-publication-v1",
      status: "pending_root_approval",
      sourceSha256: newSelection.sourceSha256,
      matrixSha256: newSelection.samplingAcceptance!.matrixSha256,
      acceptanceSha256: newSelection.samplingAcceptance!.acceptanceSha256,
      packageAdjustmentSha256: newSelection.samplingAcceptance!.packageAdjustmentSha256!,
      targetPairs: newSelection.samplingAcceptance!.targetPairs,
      sceneDeltaAcceptanceSha256: newSelection.supplemental.sceneDelta!.acceptanceSha256,
      displayAddendumAcceptanceSha256: newSelection.supplemental.displayAddendum!.acceptanceSha256,
      faCorrectionAcceptanceSha256: correctionSha256,
      publicationApproved: false
    };
  }
  const selectionBytes = Buffer.from(JSON.stringify(newSelection, null, 2) + "\n");
  const selectionSha256 = digest(selectionBytes);
  const selectionFileName = `selection-fa-coursework-correction-${versionTag}.json`;
  const pointerFileName = `candidate-fa-coursework-correction-${versionTag}.json`;
  const pointerBytesOut = Buffer.from(JSON.stringify({ path: selectionFileName, sha256: selectionSha256 }, null, 2) + "\n");
  const outputDir = path.resolve(input.evidenceOutput);
  const packageOverlay = path.join(root, "fa-correction-v1");
  const writeNewOrSame = async (file: string, bytes: Buffer) => {
    try { await writeFile(file, bytes, { flag: "wx" }); }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST") || digest(await readFile(file)) !== digest(bytes)) throw error;
    }
  };
  await mkdir(outputDir, { recursive: true });
  await mkdir(packageOverlay, { recursive: true });
  await mkdir(path.join(packageOverlay, "fa"), { recursive: true });
  await writeNewOrSame(path.join(packageOverlay, "fa/massachusetts-institute-of-technology.json"), bundleBytes);
  await writeNewOrSame(path.join(packageOverlay, "correction-receipt.json"), correctionBytes);
  await writeNewOrSame(path.join(root, selectionFileName), selectionBytes);
  await writeNewOrSame(path.join(root, pointerFileName), pointerBytesOut);
  await writeNewOrSame(path.join(outputDir, "fa-correction-receipt.json"), correctionBytes);
  const authorizationOutput = path.join(outputDir, "release-authorization.json");
  await writeNewOrSame(authorizationOutput, authorizationBytes);
  await writeNewOrSame(path.join(outputDir, "fa-correction-independent-review.json"), reviewBytes);
  const packageReceipt = {
    schemaVersion: "uapt-unified-v6-fa-correction-candidate-v1", status: "candidate_pending_root_publication_approval",
    authorizationSha256: input.authorizationSha256, independentReviewSha256: input.independentReviewSha256,
    frozenBase: { selectionSha256: input.expectedBaseSelectionSha256, selectionPath: basePointer.path, unchanged: true },
    correction: { locale, slug: school, sourceSha256, originalTargetSha256: oldTargetSha256, targetSha256, fieldUses, oldBundleSha256: bundleRef.sha256, newBundleSha256: bundleSha256, correctionReceiptSha256: correctionSha256 },
    lineage: { sourceSha256: selection.sourceSha256, matrixSha256: selection.samplingAcceptance?.matrixSha256, acceptanceSha256: selection.samplingAcceptance?.acceptanceSha256, sceneDeltaAcceptanceSha256: selection.supplemental?.sceneDelta?.acceptanceSha256, displayAddendumAcceptanceSha256: selection.supplemental?.displayAddendum?.acceptanceSha256 },
    selection: { path: selectionFileName, sha256: selectionSha256, pointerPath: pointerFileName, pointerSha256: digest(pointerBytesOut), publicationApproved: false, candidateOnly: true, sampledPublicationAcceptanceStatus: newSelection.sampledPublicationAcceptance?.status ?? "not_present" },
    coverage: { targetLocales: 32, schoolSlugs: Object.keys(selection.schools).length, publishedRegistryPointerSha256: input.publishedRegistrySha256, publishedRegistryArtifactSha256: publishedRegistry.sha256, inherited132FieldCoverageSha256: "30e31edd917f09afb6796be0c8c7355c333d8b14b60f906f5153cbd012f2629e", addedSemanticCorrections: 1, fullCorpusSemanticReview: false, nativeSpeakerApproval: false },
    approvalBoundary: "Root must create and pin the final approved sampledPublicationAcceptance only after independent package review; this candidate does not grant production loader approval."
  };
  const packageReceiptBytes = Buffer.from(JSON.stringify(packageReceipt, null, 2) + "\n");
  await writeNewOrSame(path.join(outputDir, `package-receipt-${versionTag}.json`), packageReceiptBytes);
  return { packageReceipt, packageReceiptSha256: digest(packageReceiptBytes), bundleSha256, selectionSha256, pointerSha256: digest(pointerBytesOut), correctionSha256, packageOverlay: path.relative(repositoryRoot, packageOverlay), evidenceOutput: path.relative(repositoryRoot, outputDir) };
}
if (process.argv[1]?.endsWith("pack-reading-translations.ts")) {
  const args = process.argv.slice(2);
  if (args.length === 13 && args[0] === "--accepted-matrix" && args[8] === "--scene-delta") packAcceptedMatrixCandidate(args[1], args[2], args[3], args[4], args[5], args[6], args[7], { sourcePath: args[9], sourceSha256: args[10], acceptancePath: args[11], acceptanceSha256: args[12] }).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error instanceof Error ? error.message : "Packaging failed"); process.exitCode = 1; });
  else if (args.length === 8 && args[0] === "--accepted-matrix") packAcceptedMatrixCandidate(args[1], args[2], args[3], args[4], args[5], args[6], args[7]).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error instanceof Error ? error.message : "Packaging failed"); process.exitCode = 1; });
  else if (args.length !== 4) { console.error("Usage: tsx scripts/pack-reading-translations.ts <frozen-source.json> <source-sha256> <reviewed-delivery.json> <new-output-directory> OR --accepted-matrix <source.json> <source-sha256> <matrix.json> <matrix-sha256> <acceptance.json> <acceptance-sha256> <output-dir> [--scene-delta <source.json> <source-sha256> <acceptance.json> <acceptance-sha256>]"); process.exitCode = 1; }
  else packReadingTranslations(args[0], args[1], args[2], args[3]).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error instanceof Error ? error.message : "Packaging failed"); process.exitCode = 1; });
}
