import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { isReadingLocale, type ReadingLocale } from "./language-catalog";
import type { PublicEntitySummary } from "@uapt/shared";
import { BoundedAsyncCache, ByteLru } from "./bounded-cache";
import { readingPackageSelection } from "./content-runtime";

export interface ReadingTranslation {
  source: string;
  sourceSha256: string;
  translation: string;
}
export interface ReadingTranslationBundle {
  schemaVersion: "uapt-reading-translations-v1";
  sourceSha256: string;
  locale: ReadingLocale;
  slug: string;
  recordSha256: string;
  originalEvidenceSha256: string;
  review: { status: "accepted"; receiptSha256: string };
  protectedClaimIds: string[];
  requiredSourceHashes: string[];
  strings: Record<string, ReadingTranslation>;
  sourceFieldUses?: Record<string, string[]>;
  supplementalSceneDelta?: { sourceSha256: string; acceptanceSha256: string; sourceHashes: string[]; fieldUses?: Record<string, string[]> };
  supplementalDisplayAddendum?: { sourceSha256: string; acceptanceSha256: string; sourceHashes: string[]; fieldUses?: Record<string, string[]> };
  supplementalFaCorrection?: { acceptanceSha256: string; sourceSha256: string; originalTargetSha256: string; targetSha256: string; fieldUses: string[] };
}
export interface ReadingTranslationSelection {
  schemaVersion: "uapt-reading-selection-v1";
  revision: string;
  sourceSha256: string;
  publicationApproved: boolean;
  candidateOnly?: true;
  samplingAcceptance?: {
    schemaVersion: "uapt-translation-sampling-acceptance-v1";
    sourceSha256: string;
    matrixSha256: string;
    acceptanceSha256: string;
    targetPairs: number;
    randomConfirmationSize: number;
    confirmedErrorsBeforeCorrection: number;
    oneSidedUpperBound: number;
    fullCorpusSemanticReview: false;
    nativeSpeakerApproval: false;
    statusEnumExceptions?: Array<{ locale: ReadingLocale; sourceSha256: string; targetSha256: string; marker: string }>;
    urlBoundaryRepairs?: Array<{ locale: ReadingLocale; sourceSha256: string; originalTargetSha256: string; repairedTargetSha256: string }>;
    packageAdjustmentSha256?: string;
  };
  sampledPublicationAcceptance?: {
    schemaVersion: "uapt-reviewed-sampled-translation-publication-v1";
    status: "approved" | "pending_root_approval";
    sourceSha256: string;
    matrixSha256: string;
    acceptanceSha256: string;
    packageAdjustmentSha256: string;
    targetPairs: number;
    sceneDeltaAcceptanceSha256?: string;
    displayAddendumAcceptanceSha256?: string;
    faCorrectionAcceptanceSha256?: string;
    publicationApproved: boolean;
  };
  supplemental?: { sceneDelta?: {
    schemaVersion: "uapt-reading-scene-delta-package-v1";
    sourceSha256: string;
    parentSourceSha256: string;
    acceptanceSha256: string;
    sourceStrings: number;
    targetLocales: number;
    targetPairs: number;
    sourceHashes: string[];
    locales: Partial<Record<ReadingLocale, { sourceArtifactSha256: string; sourceStrings: number; targetPairs: number }>>;
  }; displayAddendum?: {
    schemaVersion: "uapt-reading-display-addendum-package-v1";
    sourceSha256: string;
    parentSourceSha256: string;
    parentSceneSourceSha256: string;
    acceptanceSha256: string;
    sourceStrings: number;
    targetLocales: number;
    targetPairs: number;
    sourceHashes: string[];
    usesBySlug: Record<string, Record<string, string[]>>;
    locales: Partial<Record<ReadingLocale, { sourceArtifactSha256: string; sourceStrings: number; targetPairs: number }>>;
  }; faCorrection?: {
    schemaVersion: "uapt-reading-fa-display-correction-v1";
    acceptanceSha256: string;
    sourceSha256: string;
    originalTargetSha256: string;
    targetSha256: string;
    parentSelectionSha256: string;
    slug: "massachusetts-institute-of-technology";
    locale: "fa";
    fieldUses: string[];
    receipt: { path: string; sha256: string };
  }; recordDeltas?: ReadingRecordDelta[] };
  shared: Partial<Record<ReadingLocale, { path: string; sha256: string }>>;
  schools: Record<string, Partial<Record<ReadingLocale, { path: string; sha256: string }>>>;
}
/**
 * Record delta (content corrections): translations bind per source string, not
 * per whole record. A school whose record changed keeps its accepted bundle
 * byte for byte; the delta adds only the new or changed strings (and new field
 * uses of unchanged strings) and moves the bundle's record basis from `parent`
 * to `record`. Deltas chain in selection order. Every delta string and field
 * use must be in an independent review receipt whose hash the release pins
 * (`translations.recordDeltaAcceptanceSha256s`); the corpus sampled approval
 * keeps covering only the unchanged strings.
 */
export interface ReadingRecordBasis { recordSha256: string; originalEvidenceSha256: string }
export interface ReadingRecordDelta {
  schemaVersion: "uapt-reading-record-delta-v1";
  revision: string;
  parentSelectionSha256: string;
  receipt: { path: string; sha256: string };
  schools: Record<string, { parent: ReadingRecordBasis; record: ReadingRecordBasis; locales: Partial<Record<ReadingLocale, { path: string; sha256: string }>> }>;
}
export interface ReadingTranslationDelta {
  schemaVersion: "uapt-reading-translation-delta-v1";
  revision: string;
  corpusSourceSha256: string;
  locale: ReadingLocale;
  slug: string;
  parent: ReadingRecordBasis;
  record: ReadingRecordBasis;
  protectedClaimIds: string[];
  strings: Record<string, ReadingTranslation>;
  /** Fields each string is shown in: every delta string, plus new uses of strings already in the bundle. */
  sourceFieldUses: Record<string, string[]>;
}
export interface ReadingDeltaReviewPair {
  slug: string;
  locale: ReadingLocale;
  sourceSha256: string;
  targetSha256: string;
  fieldUses: string[];
  origin: "new_translation" | "reused_accepted_translation" | "field_use_addition";
  verdict: "accepted";
}
export interface ReadingDeltaReviewReceipt {
  schemaVersion: "uapt-reading-delta-review-v1";
  status: "accepted";
  revision: string;
  parentSelectionSha256: string;
  corpusSourceSha256: string;
  translator: { id: string; method: string };
  reviewer: { id: string; method: string };
  reviewedAt: string;
  /** Every delta pair was reviewed; this is not a sample. */
  coverage: "every_delta_pair";
  nativeSpeakerApproval: false;
  publicationApproved: false;
  pairs: ReadingDeltaReviewPair[];
}
export type ReadingTranslationResult =
  | { state: "ready"; revision: string; shared: ReadingTranslationBundle; school: ReadingTranslationBundle }
  | { state: "not_configured" | "unavailable" | "unapproved" | "stale_record" | "invalid_package" };
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const safeSlug = (value: string) => /^(?:_shared|[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(value);
// Packages are immutable and hash-bound. Recheck their filesystem identity on
// every read, but retain parsed bytes and expensive content validation within a
// fixed serialized-byte budget. Changed files, pointers or approval pins cannot
// reuse an earlier decision.
const verifiedJsonCache = new BoundedAsyncCache<unknown>(32, 24 * 1024 * 1024, 2, 64);
const selectedManifestCache = new ByteLru<ReadingTranslationSelection>(2, 4 * 1024 * 1024);
const bundleValidationCache = new WeakMap<ReadingTranslationBundle, ByteLru<true>>();
let artifactReads = 0;
let bundleValidations = 0;

export function readingTranslationCacheStats() {
  return { artifacts: verifiedJsonCache.stats(), selectedManifests: selectedManifestCache.stats(), artifactReads, bundleValidations };
}

/** Only the immutable file objects that passed this reader's complete checks. */
export function isVerifiedReadingBundle(bundle: ReadingTranslationBundle): boolean {
  return bundleValidationCache.has(bundle) && Object.isFrozen(bundle);
}

function fileVersionKey(target: string, expectedSha: string, info: { dev: bigint; ino: bigint; size: bigint; mtimeNs: bigint; ctimeNs: bigint }, limit: number): string {
  return JSON.stringify([target, expectedSha, info.dev.toString(), info.ino.toString(), info.size.toString(), info.mtimeNs.toString(), info.ctimeNs.toString(), limit]);
}

function freezeJson<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}
const faCorrectionFields = ["/v6/schools/0/topics/0/summary", "/v6/studentActions/topics/coursework/en"] as const;
interface FaCorrectionReceipt {
  schemaVersion: "uapt-reviewed-fa-display-correction-v1";
  status: "reviewed";
  parentSelectionSha256: string;
  sourceSha256: string;
  originalTargetSha256: string;
  targetSha256: string;
  slug: "massachusetts-institute-of-technology";
  locale: "fa";
  fieldUses: string[];
  authorizationSha256: string;
  independentReviewSha256: string;
  publicationApproved: false;
}
function isLocallyPinnedCandidate(selection: ReadingTranslationSelection, selectionSha256: string): boolean {
  const acceptance = selection.samplingAcceptance;
  const expectedAcceptance = process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256;
  const expectedSelection = process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256;
  return process.env.NODE_ENV === "development" && selection.publicationApproved === false && selection.candidateOnly === true &&
    /^[a-f0-9]{64}$/.test(expectedSelection ?? "") && selectionSha256 === expectedSelection &&
    acceptance?.schemaVersion === "uapt-translation-sampling-acceptance-v1" &&
    /^[a-f0-9]{64}$/.test(acceptance.acceptanceSha256) && /^[a-f0-9]{64}$/.test(acceptance.matrixSha256) &&
    acceptance.acceptanceSha256 === expectedAcceptance && acceptance.sourceSha256 === selection.sourceSha256 &&
    /^[a-f0-9]{64}$/.test(acceptance.packageAdjustmentSha256 ?? "") &&
    acceptance.packageAdjustmentSha256 === digest(JSON.stringify({ statusEnumExceptions: acceptance.statusEnumExceptions ?? [], urlBoundaryRepairs: acceptance.urlBoundaryRepairs ?? [] })) &&
    acceptance.fullCorpusSemanticReview === false && acceptance.nativeSpeakerApproval === false &&
    (!selection.supplemental?.faCorrection || selection.supplemental.faCorrection.acceptanceSha256 === process.env.UAPT_LOCAL_FA_CORRECTION_ACCEPTANCE_SHA256);
}
function hasApprovedSampledPublication(selection: ReadingTranslationSelection, selectionSha256: string): boolean {
  const sampling = selection.samplingAcceptance, approval = selection.sampledPublicationAcceptance;
  const displayAddendum = selection.supplemental?.displayAddendum;
  const faCorrection = selection.supplemental?.faCorrection;
  const actualAdjustmentSha256 = sampling ? digest(JSON.stringify({ statusEnumExceptions: sampling.statusEnumExceptions ?? [], urlBoundaryRepairs: sampling.urlBoundaryRepairs ?? [] })) : "";
  return selection.publicationApproved === true && selection.candidateOnly !== true &&
    approval?.schemaVersion === "uapt-reviewed-sampled-translation-publication-v1" && approval.status === "approved" && approval.publicationApproved === true &&
    !!sampling && sampling.schemaVersion === "uapt-translation-sampling-acceptance-v1" && sampling.fullCorpusSemanticReview === false && sampling.nativeSpeakerApproval === false &&
    approval.sourceSha256 === selection.sourceSha256 && sampling.sourceSha256 === selection.sourceSha256 &&
    sha(approval.matrixSha256) && approval.matrixSha256 === sampling.matrixSha256 &&
    sha(approval.acceptanceSha256) && approval.acceptanceSha256 === sampling.acceptanceSha256 && approval.acceptanceSha256 === readingPackageSelection().acceptanceSha256 &&
    sha(selectionSha256) && selectionSha256 === readingPackageSelection().selectionSha256 &&
    sha(approval.packageAdjustmentSha256) && approval.packageAdjustmentSha256 === sampling.packageAdjustmentSha256 && approval.packageAdjustmentSha256 === actualAdjustmentSha256 &&
    approval.targetPairs === sampling.targetPairs && approval.targetPairs > 0 &&
    (!displayAddendum || approval.displayAddendumAcceptanceSha256 === displayAddendum.acceptanceSha256) &&
    (!faCorrection || (sha(approval.faCorrectionAcceptanceSha256) && approval.faCorrectionAcceptanceSha256 === faCorrection.acceptanceSha256));
}
function selectedSchoolRecordSha(slug: string): string | undefined {
  const pointer = readingPackageSelection().pointer;
  if (!pointer) return undefined;
  try {
    const pointerPath = realpathSync(pointer), root = realpathSync(path.dirname(pointerPath));
    if (!pointerPath.startsWith(root + path.sep)) return undefined;
    const pointerRef = JSON.parse(readFileSync(pointerPath, "utf8")) as { path?: unknown; sha256?: unknown };
    if (typeof pointerRef.path !== "string" || path.isAbsolute(pointerRef.path) || pointerRef.path.split(/[\\/]/).includes("..") || !sha(pointerRef.sha256)) return undefined;
    const selectionPath = realpathSync(path.join(root, pointerRef.path));
    if (!selectionPath.startsWith(root + path.sep)) return undefined;
    const selectionInfo = statSync(selectionPath, { bigint: true });
    if (!selectionInfo.isFile() || selectionInfo.size > BigInt(8 * 1024 * 1024)) return undefined;
    const key = fileVersionKey(selectionPath, pointerRef.sha256, selectionInfo, 8 * 1024 * 1024);
    let selection = selectedManifestCache.get(key);
    if (!selection) {
      const selectionBytes = readFileSync(selectionPath);
      if (selectionBytes.byteLength > 8 * 1024 * 1024 || digest(selectionBytes) !== pointerRef.sha256) return undefined;
      selection = freezeJson(JSON.parse(selectionBytes.toString("utf8")) as ReadingTranslationSelection);
      selectedManifestCache.set(key, selection, selectionBytes.byteLength);
    }
    const selectionSha256 = pointerRef.sha256;
    const trusted = isLocallyPinnedCandidate(selection, selectionSha256) || hasApprovedSampledPublication(selection, selectionSha256);
    if (!trusted || !selection.schools?.[slug]) return undefined;
    const localeRef = Object.entries(selection.schools[slug]!).find(([locale, ref]) => locale !== "en" && !!ref)?.[1];
    if (!localeRef || !sha(localeRef.sha256) || path.isAbsolute(localeRef.path) || localeRef.path.split(/[\\/]/).includes("..")) return undefined;
    const bundlePath = realpathSync(path.join(root, localeRef.path));
    if (!bundlePath.startsWith(root + path.sep)) return undefined;
    const bundleBytes = readFileSync(bundlePath);
    if (digest(bundleBytes) !== localeRef.sha256) return undefined;
    const bundle = JSON.parse(bundleBytes.toString("utf8")) as ReadingTranslationBundle;
    if (bundle.schemaVersion !== "uapt-reading-translations-v1" || bundle.sourceSha256 !== selection.sourceSha256 || bundle.slug !== slug || !sha(bundle.recordSha256)) return undefined;
    // Record deltas move the school's basis forward without rewriting its bundle.
    return recordDeltaChain(selection, slug, { recordSha256: bundle.recordSha256, originalEvidenceSha256: bundle.originalEvidenceSha256 }).basis.recordSha256;
  } catch { return undefined; }
}
const protectedTokens = (text: string) => [...new Set([...text.matchAll(/https?:\/\/[^\s<>"']+|\{[^{}]+\}|\b[a-f0-9]{64}\b|\b[a-z]+(?:_[a-z]+)+\b|\b(?:PARTIAL|UNVERIFIED)\b|\b\d{4}-\d{2}-\d{2}(?:T[0-9:.]+Z)?\b/g)].map(match => match[0]))].sort();
const occurrences = (text: string, token: string) => text.split(token).length - 1;
function literalNumbers(text: string, claimIds: readonly string[], matchAcceptedBrandVocabulary = false): Map<string, number> {
  const fixedBrandTokens = [...text.matchAll(/\b(?:ChatGPT(?: Edu)?|Microsoft 365 Copilot|Copilot|UTOL|UTokyo|HGSE)\b/g)].map(match => match[0]);
  const dateTokens = [...text.matchAll(/\b\d{4}-\d{2}-\d{2}(?:T[0-9:.]+Z)?\b/g)].map(match => match[0]);
  const ignored = [...protectedTokens(text), ...claimIds, ...(matchAcceptedBrandVocabulary ? fixedBrandTokens : []), ...(matchAcceptedBrandVocabulary ? dateTokens : [])];
  for (const token of ignored.sort((a, b) => b.length - a.length)) text = text.split(token).join(" ");
  const counts = new Map<string, number>();
  // Match the accepted whole-numeric-span rule: numbers remain protected when
  // target-language word spacing joins them to an ASCII product/category name.
  for (const [number] of text.matchAll(/(?<!\d)\d+(?:[.,:/-]\d+)*(?!\d)/g)) counts.set(number, (counts.get(number) ?? 0) + 1);
  return counts;
}

/** Display-only translations; original evidence and canonical records remain separate. */
export function validateReadingTranslationBundle(value: ReadingTranslationBundle, expected: { sourceSha256: string; locale: ReadingLocale; slug: string }, options: { statusEnumExceptions?: readonly { locale: ReadingLocale; sourceSha256: string; targetSha256: string; marker: string }[]; matchAcceptedBrandVocabulary?: boolean } = {}): ReadingTranslationBundle {
  if (value.schemaVersion !== "uapt-reading-translations-v1" || value.sourceSha256 !== expected.sourceSha256 || !sha(value.sourceSha256) || value.locale !== expected.locale || value.slug !== expected.slug || !safeSlug(value.slug) || !sha(value.recordSha256) || !sha(value.originalEvidenceSha256) || value.review?.status !== "accepted" || !sha(value.review.receiptSha256)) throw Error("Invalid translation identity or review");
  if (!Array.isArray(value.protectedClaimIds) || new Set(value.protectedClaimIds).size !== value.protectedClaimIds.length || value.protectedClaimIds.some(id => typeof id !== "string" || !id || id.length > 300)) throw Error("Invalid protected Claim inventory");
  if (value.sourceFieldUses && Object.entries(value.sourceFieldUses).some(([key, fields]) => !sha(key) || !Object.hasOwn(value.strings, key) || !Array.isArray(fields) || !fields.length || new Set(fields).size !== fields.length || fields.some(field => typeof field !== "string" || !field.trim() || field.length > 1000 || field.includes("\0")))) throw Error("Invalid source display field binding");
  if (!Array.isArray(value.requiredSourceHashes) || new Set(value.requiredSourceHashes).size !== value.requiredSourceHashes.length || !value.requiredSourceHashes.length || !value.strings || typeof value.strings !== "object" || Array.isArray(value.strings)) throw Error("Invalid translation coverage");
  if (value.supplementalSceneDelta && (!sha(value.supplementalSceneDelta.sourceSha256) || !sha(value.supplementalSceneDelta.acceptanceSha256) || !Array.isArray(value.supplementalSceneDelta.sourceHashes) || new Set(value.supplementalSceneDelta.sourceHashes).size !== value.supplementalSceneDelta.sourceHashes.length || value.supplementalSceneDelta.sourceHashes.some(key => !sha(key) || !Object.hasOwn(value.strings, key)) || !value.supplementalSceneDelta.fieldUses || Object.keys(value.supplementalSceneDelta.fieldUses).some(key => !value.supplementalSceneDelta!.sourceHashes.includes(key) || !Array.isArray(value.supplementalSceneDelta!.fieldUses![key]) || !value.supplementalSceneDelta!.fieldUses![key].length || new Set(value.supplementalSceneDelta!.fieldUses![key]).size !== value.supplementalSceneDelta!.fieldUses![key].length || value.supplementalSceneDelta!.fieldUses![key].some(field => typeof field !== "string" || !field.startsWith("scene/"))))) throw Error("Invalid supplemental translation identity");
  if (value.supplementalDisplayAddendum && (!sha(value.supplementalDisplayAddendum.sourceSha256) || !sha(value.supplementalDisplayAddendum.acceptanceSha256) || !Array.isArray(value.supplementalDisplayAddendum.sourceHashes) || new Set(value.supplementalDisplayAddendum.sourceHashes).size !== value.supplementalDisplayAddendum.sourceHashes.length || value.supplementalDisplayAddendum.sourceHashes.some(key => !sha(key) || !Object.hasOwn(value.strings, key)) || !value.supplementalDisplayAddendum.fieldUses || Object.keys(value.supplementalDisplayAddendum.fieldUses).some(key => !value.supplementalDisplayAddendum!.sourceHashes.includes(key) || !Array.isArray(value.supplementalDisplayAddendum!.fieldUses![key]) || !value.supplementalDisplayAddendum!.fieldUses![key].length || new Set(value.supplementalDisplayAddendum!.fieldUses![key]).size !== value.supplementalDisplayAddendum!.fieldUses![key].length || value.supplementalDisplayAddendum!.fieldUses![key].some(field => typeof field !== "string" || !field.startsWith("/v6/studentActions/claims/"))))) throw Error("Invalid supplemental display addendum identity");
  const keys = Object.keys(value.strings);
  if (keys.length !== value.requiredSourceHashes.length || value.requiredSourceHashes.some(key => !sha(key) || !Object.hasOwn(value.strings, key))) throw Error("Incomplete display translations");
  validateTranslationUnits(value.strings, value.protectedClaimIds, expected.locale, options);
  return value;
}

/** Per-string checks shared by full bundles and record deltas: exact source hash, protected tokens, Claim IDs and numbers. */
function validateTranslationUnits(strings: Record<string, ReadingTranslation>, protectedClaimIds: readonly string[], locale: ReadingLocale, options: Parameters<typeof validateReadingTranslationBundle>[2] = {}): void {
  for (const [key, unit] of Object.entries(strings)) {
    if (!unit || key !== unit.sourceSha256 || typeof unit.source !== "string" || digest(unit.source) !== key || typeof unit.translation !== "string" || !unit.translation.trim() || /[\u202a-\u202e\u2066-\u2069]/u.test(unit.translation)) throw Error("Invalid translation source or text");
    const sourceTokens = protectedTokens(unit.source), targetTokens = protectedTokens(unit.translation);
    const sourceCounts = new Map(sourceTokens.map(token => [token, occurrences(unit.source, token)]));
    const targetCounts = new Map(targetTokens.map(token => [token, occurrences(unit.translation, token)]));
    for (const token of sourceTokens) if (targetCounts.get(token) !== sourceCounts.get(token)) throw Error(`Translation changed protected tokens: ${key}`);
    const translationHash = digest(unit.translation);
    for (const token of targetTokens) {
      const extra = (targetCounts.get(token) ?? 0) - (sourceCounts.get(token) ?? 0);
      for (let occurrence = 0; occurrence < extra; occurrence++) {
        if (!isStatusEnum(token) || !unit.source.toLowerCase().includes(statusSourcePhrase(token)) ||
            !options.statusEnumExceptions?.some(item => item.locale === locale && item.sourceSha256 === key && item.targetSha256 === translationHash && item.marker === token)) {
          throw Error(`Translation added protected marker: ${key}:${token}`);
        }
      }
    }
    for (const id of protectedClaimIds) if (occurrences(unit.source, id) !== occurrences(unit.translation, id)) throw Error("Translation changed protected Claim ID");
    const sourceNumbers = literalNumbers(unit.source, protectedClaimIds, options.matchAcceptedBrandVocabulary), targetNumbers = literalNumbers(unit.translation, protectedClaimIds, options.matchAcceptedBrandVocabulary);
    // Preserve each existing literal and its count, as the generator does. A
    // reviewed word-to-digit rendering (three -> 3) may add a target numeral;
    // its meaning is covered by the accepted, hash-bound semantic receipt.
    for (const [number, count] of sourceNumbers) if (targetNumbers.get(number) !== count) throw Error(`Translation changed numeric facts: ${key}:${number}`);
  }
}

const statusEnumPhrases: Record<string, string> = {
  conditionally_allowed: "conditionally allowed",
  institutionally_licensed_or_procured: "institutionally licensed or procured",
  officially_endorsed: "officially endorsed",
  not_specified: "not specified",
  not_mentioned: "not mentioned",
  PARTIAL: "partial"
};
function isStatusEnum(token: string): boolean { return Object.hasOwn(statusEnumPhrases, token); }
function statusSourcePhrase(token: string): string { return statusEnumPhrases[token] ?? ""; }

async function verifiedJson<T>(root: string, ref: { path: string; sha256: string }, limit: number): Promise<T> {
  if (!ref || !sha(ref.sha256) || typeof ref.path !== "string" || path.isAbsolute(ref.path) || ref.path.split(/[\\/]/).includes("..")) throw Error("Invalid translation reference");
  const target = await realpath(path.join(root, ref.path));
  if (!target.startsWith(root + path.sep)) throw Error("Translation reference escapes package");
  const info = await stat(target, { bigint: true });
  if (!info.isFile() || info.size > BigInt(limit)) throw Error("Translation artifact exceeds limit");
  const key = fileVersionKey(target, ref.sha256, info, limit);
  return verifiedJsonCache.get(key, async () => {
    const raw = await readFile(target);
    artifactReads++;
    if (raw.byteLength > limit || digest(raw) !== ref.sha256) throw Error("Translation bytes changed");
    return freezeJson(JSON.parse(raw.toString("utf8"))) as T;
  }) as Promise<T>;
}

function validateCachedBundle(
  bundle: ReadingTranslationBundle,
  expected: Parameters<typeof validateReadingTranslationBundle>[1],
  options: Parameters<typeof validateReadingTranslationBundle>[2],
  selectionSha256: string
): void {
  const key = JSON.stringify([selectionSha256, expected.sourceSha256, expected.locale, expected.slug, options?.matchAcceptedBrandVocabulary === true]);
  const cached = bundleValidationCache.get(bundle);
  if (cached?.get(key)) return;
  validateReadingTranslationBundle(bundle, expected, options);
  bundleValidations++;
  const validations = cached ?? new ByteLru<true>(4, 1024);
  validations.set(key, true, Buffer.byteLength(key) + 1);
  if (!cached) bundleValidationCache.set(bundle, validations);
}

async function verifiedFaCorrection(root: string, selection: ReadingTranslationSelection, sampledPreview: boolean, approvedSampledPublication: boolean): Promise<FaCorrectionReceipt | undefined> {
  const correction = selection.supplemental?.faCorrection;
  if (!correction) return undefined;
  if (correction.schemaVersion !== "uapt-reading-fa-display-correction-v1" || correction.slug !== "massachusetts-institute-of-technology" || correction.locale !== "fa" ||
      !sha(correction.acceptanceSha256) || !sha(correction.sourceSha256) || !sha(correction.originalTargetSha256) || !sha(correction.targetSha256) || !sha(correction.parentSelectionSha256) ||
      correction.receipt?.sha256 !== correction.acceptanceSha256 ||
      !Array.isArray(correction.fieldUses) || correction.fieldUses.length !== faCorrectionFields.length || correction.fieldUses.join("\0") !== faCorrectionFields.join("\0") ||
      (sampledPreview && (process.env.UAPT_LOCAL_FA_CORRECTION_ACCEPTANCE_SHA256 !== correction.acceptanceSha256 || !sha(process.env.UAPT_LOCAL_FA_CORRECTION_ACCEPTANCE_SHA256)) ) ||
      (approvedSampledPublication && selection.sampledPublicationAcceptance?.faCorrectionAcceptanceSha256 !== correction.acceptanceSha256) ||
      (!sampledPreview && !approvedSampledPublication)) throw Error("Fa correction package binding is invalid");
  const receipt = await verifiedJson<FaCorrectionReceipt>(root, correction.receipt, 64 * 1024);
  if (receipt.schemaVersion !== "uapt-reviewed-fa-display-correction-v1" || receipt.status !== "reviewed" || receipt.publicationApproved !== false ||
      receipt.slug !== correction.slug || receipt.locale !== correction.locale || receipt.parentSelectionSha256 !== correction.parentSelectionSha256 ||
      receipt.sourceSha256 !== correction.sourceSha256 || receipt.originalTargetSha256 !== correction.originalTargetSha256 || receipt.targetSha256 !== correction.targetSha256 ||
      receipt.fieldUses.join("\0") !== correction.fieldUses.join("\0") || !sha(receipt.authorizationSha256) || !sha(receipt.independentReviewSha256)) throw Error("Fa correction review receipt mismatch");
  return receipt;
}

/** Deltas that apply, in selection order, starting from a bundle's own record basis. */
export function recordDeltaChain(selection: Pick<ReadingTranslationSelection, "supplemental">, slug: string, start: ReadingRecordBasis): { chain: Array<{ delta: ReadingRecordDelta; entry: ReadingRecordDelta["schools"][string] }>; basis: ReadingRecordBasis } {
  const chain: Array<{ delta: ReadingRecordDelta; entry: ReadingRecordDelta["schools"][string] }> = [];
  let basis = start;
  for (const delta of selection.supplemental?.recordDeltas ?? []) {
    const entry = delta?.schools?.[slug];
    if (!entry?.parent || !entry.record || entry.parent.recordSha256 !== basis.recordSha256 || entry.parent.originalEvidenceSha256 !== basis.originalEvidenceSha256) continue;
    chain.push({ delta, entry });
    basis = entry.record;
  }
  return { chain, basis };
}

export type ReadingDeltaProblem = { state: "unapproved" | "invalid_package"; reason: string };
const fieldList = (fields: unknown): fields is string[] => Array.isArray(fields) && fields.length > 0 && new Set(fields).size === fields.length && fields.every(field => typeof field === "string" && !!field.trim() && field.length <= 1000 && !field.includes("\0"));

/**
 * Machine check of one school/locale delta against the strings accepted so far:
 * identity, independent full review of every delta pair, and the per-string
 * token/number rules. Returns the first problem, or undefined when accepted.
 */
export function checkReadingTranslationDelta(input: {
  accepted: { strings: Readonly<Record<string, ReadingTranslation>>; sourceFieldUses?: Readonly<Record<string, readonly string[]>> };
  delta: ReadingTranslationDelta;
  recordDelta: ReadingRecordDelta;
  receipt: ReadingDeltaReviewReceipt;
  corpusSourceSha256: string;
  slug: string;
  locale: ReadingLocale;
}, options: Parameters<typeof validateReadingTranslationBundle>[2] = {}): ReadingDeltaProblem | undefined {
  const { accepted, delta, recordDelta, receipt, slug, locale } = input;
  const invalid = (reason: string): ReadingDeltaProblem => ({ state: "invalid_package", reason });
  const unapproved = (reason: string): ReadingDeltaProblem => ({ state: "unapproved", reason });
  const entry = recordDelta?.schools?.[slug];
  if (recordDelta?.schemaVersion !== "uapt-reading-record-delta-v1" || typeof recordDelta.revision !== "string" || !recordDelta.revision || !sha(recordDelta.parentSelectionSha256) || !sha(recordDelta.receipt?.sha256) || !entry) return invalid("record delta identity");
  if (receipt?.schemaVersion !== "uapt-reading-delta-review-v1" || receipt.status !== "accepted" || receipt.revision !== recordDelta.revision || receipt.parentSelectionSha256 !== recordDelta.parentSelectionSha256 || receipt.corpusSourceSha256 !== input.corpusSourceSha256) return unapproved("review receipt does not bind this delta");
  if (receipt.coverage !== "every_delta_pair" || receipt.nativeSpeakerApproval !== false || receipt.publicationApproved !== false || !Number.isFinite(Date.parse(receipt.reviewedAt))) return unapproved("review receipt scope");
  if (!receipt.translator?.id?.trim() || !receipt.reviewer?.id?.trim() || !receipt.reviewer.method?.trim() || receipt.translator.id.trim() === receipt.reviewer.id.trim()) return unapproved("review is not independent of translation");
  if (delta?.schemaVersion !== "uapt-reading-translation-delta-v1" || delta.revision !== recordDelta.revision || delta.corpusSourceSha256 !== input.corpusSourceSha256 || delta.slug !== slug || delta.locale !== locale) return invalid("delta bundle identity");
  for (const side of ["parent", "record"] as const) if (!sha(delta[side]?.recordSha256) || !sha(delta[side]?.originalEvidenceSha256) || delta[side].recordSha256 !== entry[side]?.recordSha256 || delta[side].originalEvidenceSha256 !== entry[side]?.originalEvidenceSha256) return invalid("delta record basis");
  if (!Array.isArray(delta.protectedClaimIds) || new Set(delta.protectedClaimIds).size !== delta.protectedClaimIds.length || delta.protectedClaimIds.some(id => typeof id !== "string" || !id || id.length > 300)) return invalid("protected Claim inventory");
  if (!delta.strings || typeof delta.strings !== "object" || Array.isArray(delta.strings) || !delta.sourceFieldUses || typeof delta.sourceFieldUses !== "object") return invalid("delta strings");
  for (const key of Object.keys(delta.strings)) if (!Object.hasOwn(delta.sourceFieldUses, key)) return invalid(`delta string without display fields: ${key}`);
  for (const [key, fields] of Object.entries(delta.sourceFieldUses)) {
    if (!sha(key) || !fieldList(fields)) return invalid(`display fields: ${key}`);
    if (!Object.hasOwn(delta.strings, key) && !Object.hasOwn(accepted.strings, key)) return invalid(`field use for an unknown string: ${key}`);
  }
  try { validateTranslationUnits(delta.strings, delta.protectedClaimIds, locale, options); }
  catch (error) { return invalid(error instanceof Error ? error.message : "translation unit"); }
  if (!Array.isArray(receipt.pairs)) return unapproved("review pairs");
  const pairs = new Map<string, ReadingDeltaReviewPair>();
  for (const pair of receipt.pairs) {
    if (pair?.slug !== slug || pair.locale !== locale) continue;
    if (pairs.has(pair.sourceSha256)) return unapproved(`duplicate review pair: ${pair.sourceSha256}`);
    pairs.set(pair.sourceSha256, pair);
  }
  const items = Object.keys(delta.sourceFieldUses);
  for (const key of items) {
    const pair = pairs.get(key);
    const unit = delta.strings[key] ?? accepted.strings[key];
    const origin = Object.hasOwn(delta.strings, key) ? ["new_translation", "reused_accepted_translation"] : ["field_use_addition"];
    if (!pair || pair.verdict !== "accepted" || !origin.includes(pair.origin)) return unapproved(`delta pair not independently accepted: ${key}`);
    if (pair.targetSha256 !== digest(unit.translation)) return unapproved(`reviewed target differs: ${key}`);
    const fields = delta.sourceFieldUses[key];
    if (!fieldList(pair.fieldUses) || pair.fieldUses.length !== fields.length || fields.some(field => !pair.fieldUses.includes(field))) return unapproved(`reviewed display fields differ: ${key}`);
  }
  if (pairs.size !== items.length) return unapproved("review receipt lists pairs outside this delta");
  return undefined;
}

// Composed views (accepted bundle + its delta chain) keep a stable identity per
// base bundle, so coverage caches keyed by bundle objects stay valid.
const composedBundleCache = new WeakMap<ReadingTranslationBundle, ByteLru<ReadingTranslationBundle>>();
let recordDeltaCompositions = 0;
export function readingRecordDeltaStats() { return { compositions: recordDeltaCompositions }; }

async function composeRecordDeltas(root: string, selection: ReadingTranslationSelection, selectionSha256: string, slug: string, locale: ReadingLocale, base: ReadingTranslationBundle, basis: ReadingRecordBasis, options: Parameters<typeof validateReadingTranslationBundle>[2]): Promise<ReadingTranslationBundle | "stale_record" | "unapproved" | "invalid_package"> {
  // Stop at the first delta that reaches the requested record (a later one may already be in the package).
  const full = recordDeltaChain(selection, slug, { recordSha256: base.recordSha256, originalEvidenceSha256: base.originalEvidenceSha256 }).chain;
  const end = full.findIndex(({ entry }) => entry.record.recordSha256 === basis.recordSha256 && entry.record.originalEvidenceSha256 === basis.originalEvidenceSha256);
  if (end < 0) return "stale_record";
  const chain = full.slice(0, end + 1);
  // The release (or the environment fallback) pins every delta review it accepts.
  const pins = readingPackageSelection().recordDeltaAcceptanceSha256s;
  if (chain.some(({ delta }) => !sha(delta.receipt?.sha256) || !pins.includes(delta.receipt.sha256))) return "unapproved";
  const refs = chain.map(({ entry }) => entry.locales?.[locale]);
  if (refs.some(ref => !ref)) return "stale_record";
  const key = JSON.stringify([selectionSha256, slug, locale, options?.matchAcceptedBrandVocabulary === true, ...chain.map(({ delta }, i) => [delta.receipt.sha256, refs[i]!.sha256])]);
  const cached = composedBundleCache.get(base)?.get(key);
  if (cached) return cached;
  const strings: Record<string, ReadingTranslation> = { ...base.strings };
  const uses: Record<string, string[]> = Object.fromEntries(Object.entries(base.sourceFieldUses ?? {}).map(([hash, fields]) => [hash, [...fields]]));
  const protectedClaimIds = new Set(base.protectedClaimIds);
  for (let i = 0; i < chain.length; i++) {
    const { delta } = chain[i];
    const [receipt, bundle] = await Promise.all([
      verifiedJson<ReadingDeltaReviewReceipt>(root, delta.receipt, 8 * 1024 * 1024),
      verifiedJson<ReadingTranslationDelta>(root, refs[i]!, 4 * 1024 * 1024)
    ]);
    const problem = checkReadingTranslationDelta({ accepted: { strings, sourceFieldUses: uses }, delta: bundle, recordDelta: delta, receipt, corpusSourceSha256: selection.sourceSha256, slug, locale }, options);
    if (problem) return problem.state;
    Object.assign(strings, bundle.strings);
    for (const [hash, fields] of Object.entries(bundle.sourceFieldUses)) uses[hash] = [...new Set([...(uses[hash] ?? []), ...fields])];
    for (const id of bundle.protectedClaimIds) protectedClaimIds.add(id);
  }
  const composed = freezeJson<ReadingTranslationBundle>({
    ...base,
    recordSha256: basis.recordSha256,
    originalEvidenceSha256: basis.originalEvidenceSha256,
    review: { status: "accepted", receiptSha256: chain.at(-1)!.delta.receipt.sha256 },
    protectedClaimIds: [...protectedClaimIds],
    requiredSourceHashes: Object.keys(strings),
    strings,
    sourceFieldUses: uses
  });
  recordDeltaCompositions++;
  bundleValidationCache.set(composed, new ByteLru<true>(4, 1024));
  const retained = composedBundleCache.get(base) ?? new ByteLru<ReadingTranslationBundle>(4, 64 * 1024);
  retained.set(key, composed, Buffer.byteLength(key) + 1024);
  composedBundleCache.set(base, retained);
  return composed;
}

/** Reads a selected immutable public display package; never reads generator queues or candidate outputs. */
export async function getReadingTranslations(slug: string, locale: ReadingLocale, basis: { recordSha256: string; originalEvidenceSha256: string }, pointer = readingPackageSelection().pointer): Promise<ReadingTranslationResult> {
  if (!pointer) return { state: "not_configured" };
  if (!safeSlug(slug) || !isReadingLocale(locale)) return { state: "invalid_package" };
  try {
    const root = await realpath(path.dirname(pointer));
    const pointerPath = await realpath(pointer);
    if (!pointerPath.startsWith(root + path.sep)) return { state: "invalid_package" };
    const ref = JSON.parse(await readFile(pointerPath, "utf8")) as { path: string; sha256: string };
    const selection = await verifiedJson<ReadingTranslationSelection>(root, ref, 8 * 1024 * 1024);
    if (selection.schemaVersion !== "uapt-reading-selection-v1" || !sha(selection.sourceSha256) || !selection.revision || !selection.shared || !selection.schools) return { state: "invalid_package" };
    const sampledPreview = isLocallyPinnedCandidate(selection, ref.sha256);
    const approvedSampledPublication = hasApprovedSampledPublication(selection, ref.sha256);
    const sampledContract = sampledPreview || approvedSampledPublication;
    if (selection.sampledPublicationAcceptance && !approvedSampledPublication && !sampledPreview) return { state: "unapproved" };
    if ((selection.publicationApproved !== true || selection.candidateOnly) && !sampledPreview) return { state: "unapproved" };
    const faCorrection = await verifiedFaCorrection(root, selection, sampledPreview, approvedSampledPublication);
    const sharedRef = selection.shared[locale], schoolRef = selection.schools[slug]?.[locale];
    if (!sharedRef || !schoolRef) return { state: "unavailable" };
    const [shared, school] = await Promise.all([verifiedJson<ReadingTranslationBundle>(root, sharedRef, 4 * 1024 * 1024), verifiedJson<ReadingTranslationBundle>(root, schoolRef, 4 * 1024 * 1024)]);
    const exceptions = sampledContract ? selection.samplingAcceptance?.statusEnumExceptions ?? [] : [];
    const sceneDelta = selection.supplemental?.sceneDelta;
    if (sceneDelta) {
      const expectedDeltaAcceptance = process.env.UAPT_LOCAL_SCENE_DELTA_ACCEPTANCE_SHA256;
      const sceneAcceptancePinned = sampledPreview
        ? sceneDelta.acceptanceSha256 === expectedDeltaAcceptance && sha(expectedDeltaAcceptance)
        : approvedSampledPublication && selection.sampledPublicationAcceptance?.sceneDeltaAcceptanceSha256 === sceneDelta.acceptanceSha256;
      if (!sampledContract || !sceneAcceptancePinned || sceneDelta.schemaVersion !== "uapt-reading-scene-delta-package-v1" || sceneDelta.parentSourceSha256 !== selection.sourceSha256 || !sha(sceneDelta.sourceSha256) || !sha(sceneDelta.acceptanceSha256) || sceneDelta.sourceStrings !== 337 || sceneDelta.targetLocales !== 32 || sceneDelta.targetPairs !== 10_784 || !Array.isArray(sceneDelta.sourceHashes) || sceneDelta.sourceHashes.length !== sceneDelta.sourceStrings || new Set(sceneDelta.sourceHashes).size !== sceneDelta.sourceStrings || sceneDelta.sourceHashes.some(hash => !sha(hash))) return { state: "unapproved" };
      const localeArtifact = sceneDelta.locales[locale];
      if (!localeArtifact || !sha(localeArtifact.sourceArtifactSha256) || localeArtifact.sourceStrings !== sceneDelta.sourceStrings || localeArtifact.targetPairs !== sceneDelta.sourceStrings) return { state: "unavailable" };
    }
    const displayAddendum = selection.supplemental?.displayAddendum;
    if (displayAddendum) {
      const expectedAddendumAcceptance = process.env.UAPT_LOCAL_DISPLAY_ADDENDUM_ACCEPTANCE_SHA256;
      const addendumPinned = sampledPreview
        ? displayAddendum.acceptanceSha256 === expectedAddendumAcceptance && sha(expectedAddendumAcceptance)
        : approvedSampledPublication && selection.sampledPublicationAcceptance?.displayAddendumAcceptanceSha256 === displayAddendum.acceptanceSha256;
      const localeArtifact = displayAddendum.locales[locale];
      if (!sampledContract || !sceneDelta || displayAddendum.parentSceneSourceSha256 !== sceneDelta.sourceSha256 || !addendumPinned || displayAddendum.schemaVersion !== "uapt-reading-display-addendum-package-v1" || displayAddendum.parentSourceSha256 !== selection.sourceSha256 || displayAddendum.sourceStrings !== 9 || displayAddendum.targetLocales !== 32 || displayAddendum.targetPairs !== 288 || !sha(displayAddendum.sourceSha256) || !sha(displayAddendum.parentSceneSourceSha256) || !sha(displayAddendum.acceptanceSha256) || !Array.isArray(displayAddendum.sourceHashes) || displayAddendum.sourceHashes.length !== 9 || new Set(displayAddendum.sourceHashes).size !== 9 || displayAddendum.sourceHashes.some(hash => !sha(hash)) || !displayAddendum.usesBySlug || Object.keys(displayAddendum.usesBySlug).length !== 1 || !displayAddendum.usesBySlug["massachusetts-institute-of-technology"] || Object.keys(displayAddendum.usesBySlug["massachusetts-institute-of-technology"]).length !== 9 || Object.entries(displayAddendum.usesBySlug["massachusetts-institute-of-technology"]).some(([hash, fields]) => !displayAddendum.sourceHashes.includes(hash) || !Array.isArray(fields) || fields.length !== 1 || !fields[0].startsWith("/v6/studentActions/claims/mit-fact-")) || !localeArtifact || !sha(localeArtifact.sourceArtifactSha256) || localeArtifact.sourceStrings !== 9 || localeArtifact.targetPairs !== 9) return { state: "unapproved" };
    }
    const validationOptions = { statusEnumExceptions: exceptions, matchAcceptedBrandVocabulary: sampledContract };
    validateCachedBundle(shared, { sourceSha256: selection.sourceSha256, locale, slug: "_shared" }, validationOptions, ref.sha256);
    validateCachedBundle(school, { sourceSha256: selection.sourceSha256, locale, slug }, validationOptions, ref.sha256);
    if (faCorrection && slug === faCorrection.slug && locale === faCorrection.locale) {
      const unit = school.strings[faCorrection.sourceSha256];
      const actualFields = school.sourceFieldUses?.[faCorrection.sourceSha256] ?? [];
      if (!unit || unit.sourceSha256 !== faCorrection.sourceSha256 || digest(unit.translation) !== faCorrection.targetSha256 ||
          actualFields.length !== faCorrection.fieldUses.length || faCorrection.fieldUses.some(field => !actualFields.includes(field))) return { state: "invalid_package" };
    }
    if (sceneDelta) for (const bundle of [shared, school]) {
      const supplement = bundle.supplementalSceneDelta;
      if (!supplement) continue;
      if (supplement.sourceSha256 !== sceneDelta.sourceSha256 || supplement.acceptanceSha256 !== sceneDelta.acceptanceSha256 || supplement.sourceHashes.some(hash => !sceneDelta.sourceHashes.includes(hash))) return { state: "invalid_package" };
    }
    if (displayAddendum) {
      const expectedUses = displayAddendum.usesBySlug[slug] ?? {};
      const expectedHashes = Object.keys(expectedUses).sort();
      const supplement = school.supplementalDisplayAddendum;
      if (expectedHashes.length && (!supplement || supplement.sourceSha256 !== displayAddendum.sourceSha256 || supplement.acceptanceSha256 !== displayAddendum.acceptanceSha256 || [...supplement.sourceHashes].sort().join(",") !== expectedHashes.join(",") || JSON.stringify(Object.fromEntries(Object.entries(supplement.fieldUses ?? {}).sort(([a], [b]) => a.localeCompare(b)))) !== JSON.stringify(Object.fromEntries(Object.entries(expectedUses).sort(([a], [b]) => a.localeCompare(b)))))) return { state: "invalid_package" };
      if (!expectedHashes.length && supplement) return { state: "invalid_package" };
    }
    if (school.recordSha256 === basis.recordSha256 && school.originalEvidenceSha256 === basis.originalEvidenceSha256) return { state: "ready", revision: selection.revision, shared, school };
    // A changed record is readable only through reviewed, pinned record deltas.
    const composed = await composeRecordDeltas(root, selection, ref.sha256, slug, locale, school, basis, validationOptions);
    return typeof composed === "string" ? { state: composed } : { state: "ready", revision: selection.revision, shared, school: composed };
  } catch { return { state: "invalid_package" }; }
}

/** Load only exact allowlisted shared UI strings for the server-rendered shell. */
export async function getReadingSharedUiText(locale: ReadingLocale, sources: readonly string[], pointer = readingPackageSelection().pointer): Promise<Record<string, string>> {
  if (!pointer || !isReadingLocale(locale)) return {};
  try {
    const root = await realpath(path.dirname(pointer));
    const pointerPath = await realpath(pointer);
    if (!pointerPath.startsWith(root + path.sep)) return {};
    const ref = JSON.parse(await readFile(pointerPath, "utf8")) as { path: string; sha256: string };
    const selection = await verifiedJson<ReadingTranslationSelection>(root, ref, 8 * 1024 * 1024);
    if (selection.schemaVersion !== "uapt-reading-selection-v1" || !sha(selection.sourceSha256) || !selection.revision || !selection.shared) return {};
    const sampledPreview = isLocallyPinnedCandidate(selection, ref.sha256);
    const approvedSampledPublication = hasApprovedSampledPublication(selection, ref.sha256);
    const sampledContract = sampledPreview || approvedSampledPublication;
    if (selection.sampledPublicationAcceptance && !approvedSampledPublication && !sampledPreview) return {};
    if ((selection.publicationApproved !== true || selection.candidateOnly) && !sampledPreview) return {};
    try { await verifiedFaCorrection(root, selection, sampledPreview, approvedSampledPublication); } catch { return {}; }
    const sceneDelta = selection.supplemental?.sceneDelta;
    const displayAddendum = selection.supplemental?.displayAddendum;
    const sceneAcceptancePinned = !sceneDelta || (sampledPreview
      ? sceneDelta.acceptanceSha256 === process.env.UAPT_LOCAL_SCENE_DELTA_ACCEPTANCE_SHA256 && sha(process.env.UAPT_LOCAL_SCENE_DELTA_ACCEPTANCE_SHA256)
      : approvedSampledPublication && selection.sampledPublicationAcceptance?.sceneDeltaAcceptanceSha256 === sceneDelta.acceptanceSha256);
    if (sceneDelta && (!sampledContract || !sceneAcceptancePinned || sceneDelta.schemaVersion !== "uapt-reading-scene-delta-package-v1" || sceneDelta.parentSourceSha256 !== selection.sourceSha256 || !sha(sceneDelta.acceptanceSha256) || !sha(sceneDelta.sourceSha256))) return {};
    const displayAddendumPinned = !displayAddendum || (sampledPreview
      ? displayAddendum.acceptanceSha256 === process.env.UAPT_LOCAL_DISPLAY_ADDENDUM_ACCEPTANCE_SHA256 && sha(process.env.UAPT_LOCAL_DISPLAY_ADDENDUM_ACCEPTANCE_SHA256)
      : approvedSampledPublication && selection.sampledPublicationAcceptance?.displayAddendumAcceptanceSha256 === displayAddendum.acceptanceSha256);
    if (displayAddendum && (!sampledContract || !sceneDelta || displayAddendum.parentSceneSourceSha256 !== sceneDelta.sourceSha256 || !displayAddendumPinned || displayAddendum.schemaVersion !== "uapt-reading-display-addendum-package-v1" || displayAddendum.parentSourceSha256 !== selection.sourceSha256 || displayAddendum.sourceStrings !== 9 || displayAddendum.targetLocales !== 32 || displayAddendum.targetPairs !== 288 || !sha(displayAddendum.sourceSha256) || !sha(displayAddendum.acceptanceSha256))) return {};
    const sharedRef = selection.shared[locale];
    if (!sharedRef) return {};
    const shared = await verifiedJson<ReadingTranslationBundle>(root, sharedRef, 4 * 1024 * 1024);
    const exceptions = sampledContract ? selection.samplingAcceptance?.statusEnumExceptions ?? [] : [];
    validateCachedBundle(shared, { sourceSha256: selection.sourceSha256, locale, slug: "_shared" }, { statusEnumExceptions: exceptions, matchAcceptedBrandVocabulary: sampledContract }, ref.sha256);
    return acceptedReadingUiText(sources, [shared]);
  } catch { return {}; }
}

/** Exact source hashes allow faithful reuse. Missing text is never counted as translated. */
export function readingTranslation(text: string, bundles: readonly ReadingTranslationBundle[]): { text: string; translated: boolean } {
  const key = digest(text);
  for (const bundle of bundles) {
    const unit = bundle.strings[key];
    if (unit && unit.source === text) return { text: unit.translation, translated: true };
  }
  return { text, translated: false };
}

/** Build a bounded UI-label overlay from an explicit source-string allowlist. */
export function acceptedReadingUiText(sources: readonly string[], bundles: readonly ReadingTranslationBundle[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (const source of new Set(sources)) {
    const result = readingTranslation(source, bundles);
    if (result.translated) output[source] = result.text;
  }
  return output;
}

/** Replace only strings matched exactly in the accepted shared UI subset. */
/** Build a page's display record after its original record has passed normal acceptance.
 * This returned view must never replace the canonical API/MCP record or snapshot input. */
export function readingSummaryView(summary: PublicEntitySummary, translations: Extract<ReadingTranslationResult, { state: "ready" }>): PublicEntitySummary {
  const { recordSha256: basis, originalEvidenceSha256: evidence } = readingSummaryBasis(summary);
  if (basis !== translations.school.recordSha256 || evidence !== translations.school.originalEvidenceSha256) throw Error("Display record basis changed");
  const bundles = [translations.school, translations.shared];
  const required = (source: string) => {
    const value = readingTranslation(source, bundles);
    if (!value.translated) throw Error("Display translation missing");
    return value.text;
  };
  return { ...summary, summary: required(summary.summary), claims: summary.claims.map(claim => ({ ...claim, claimText: required(claim.claimText) })) };
}

export function readingSummaryBasis(summary: PublicEntitySummary): { recordSha256: string; originalEvidenceSha256: string } {
  const rawRecordSha256 = digest(JSON.stringify(summary));
  const selectedRecordSha256 = typeof summary.entity?.slug === "string" ? selectedSchoolRecordSha(summary.entity.slug) : undefined;
  let recordSha256 = rawRecordSha256;
  // A selected, hash-pinned sampled package may have been exported with the
  // exact localhost representation. Prefer the current raw record; normalize
  // only the five known origin fields when that exact selected school bundle
  // proves its record hash is the normalized representation. Legacy packages
  // and unpinned candidates always use the raw record hash.
  if (selectedRecordSha256 && selectedRecordSha256 !== rawRecordSha256) {
    const localOrigin = "http://localhost:3000", qaOrigin = "https://eduaipolicy.org", slug = summary.entity.slug;
    if (process.env.NEXT_PUBLIC_SITE_URL === qaOrigin && summary.canonicalUrl === `${qaOrigin}/universities/${slug}` && summary.publicPageUrl === `${qaOrigin}/universities/${slug}` && summary.apiUrl === `${qaOrigin}/api/public/v1/universities/${slug}.json` && summary.entity.canonicalUrl === `${qaOrigin}/universities/${slug}` && summary.suggestedCitation.endsWith(`${qaOrigin}/universities/${slug}`)) {
      const normalized = { ...summary, canonicalUrl: `${localOrigin}/universities/${slug}`, publicPageUrl: `${localOrigin}/universities/${slug}`, apiUrl: `${localOrigin}/api/public/v1/universities/${slug}.json`, entity: { ...summary.entity, canonicalUrl: `${localOrigin}/universities/${slug}` }, suggestedCitation: summary.suggestedCitation.slice(0, -`${qaOrigin}/universities/${slug}`.length) + `${localOrigin}/universities/${slug}` };
      const normalizedRecordSha256 = digest(JSON.stringify(normalized));
      if (selectedRecordSha256 === normalizedRecordSha256) recordSha256 = normalizedRecordSha256;
    }
  }
  return { recordSha256, originalEvidenceSha256: digest(JSON.stringify(summary.claims.map(claim => ({ id: claim.id, evidence: claim.evidence })))) };
}

/** Use a published V6 summary only when its complete serialized bytes match the verified revision pin. */
export function verifiedV6ReadingBasis(summary: PublicEntitySummary, expectedRecordSha256: string): { recordSha256: string; originalEvidenceSha256: string } | undefined {
  if (!sha(expectedRecordSha256) || digest(JSON.stringify(summary)) !== expectedRecordSha256) return undefined;
  const basis = readingSummaryBasis(summary);
  return basis.recordSha256 === expectedRecordSha256 ? basis : undefined;
}

const PRESERVED_KEYS = /^(?:id|claimId|sourceUrl|url|href|canonicalUrl|apiUrl|name|citationTitle|evidence|sources|officialSources|originalEvidence|originalRecord|originalTableRow|hmsTools|sourceLanguage|sourceSnapshotHash|snapshotHash|recordSha256|originalEvidenceSha256|fingerprint|checkedAt|lastCheckedAt|date|publishedAt|createdAt|updatedAt|status|confidence|reviewState)$/i;

/** Translate exact exported display strings in shared V6/legacy presentation inputs only. */
export function readingDisplayView<T>(value: T, translations: Extract<ReadingTranslationResult, { state: "ready" }>, locale: ReadingLocale): T {
  const bundles = [translations.school, translations.shared];
  const visit = (current: unknown, key = ""): unknown => {
    if (PRESERVED_KEYS.test(key)) return current;
    if (typeof current === "string") return readingTranslation(current, bundles).text;
    if (Array.isArray(current)) return current.map(item => visit(item));
    if (current && typeof current === "object") {
      const output = Object.fromEntries(Object.entries(current).map(([child, item]) => [child, visit(item, child)]));
      const record = current as Record<string, unknown>;
      if (typeof record.summary === "string" && typeof record.summaryLanguage === "string" && readingTranslation(record.summary, bundles).translated) output.summaryLanguage = locale;
      // Existing V6 records may carry a legacy zh projection alongside the
      // frozen English source. Refill that selected projection from the
      // accepted requested-locale unit, rather than displaying stale zh copy.
      if (typeof record.en === "string" && typeof record.zh === "string") {
        const localized = readingTranslation(record.en, bundles);
        if (localized.translated && locale.startsWith("zh")) output.zh = localized.text;
      }
      return output;
    }
    return current;
  };
  return visit(value) as T;
}

export function readingMetadata(pathname: string, locale: ReadingLocale, eligibleLocales: readonly ReadingLocale[], siteUrl: string, complete: boolean) {
  const localized = (language: ReadingLocale) => new URL(`${language === "en" ? "" : "/" + language}${pathname}`, siteUrl).href;
  const eligible = complete && eligibleLocales.includes(locale);
  return {
    alternates: { canonical: localized(locale), languages: eligible ? { ...Object.fromEntries(eligibleLocales.map(language => [language, localized(language)])), "x-default": localized("en") } : {} },
    robots: { index: locale === "en" || eligible, follow: true }
  };
}
