import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { Metadata } from "next";
import { getReadingTranslations, isVerifiedReadingBundle } from "./reading-translations";
import { READING_LOCALES, type ReadingLocale } from "./language-catalog";
import { DEFAULT_LOCALE, withLocalePrefix } from "./i18n";
import { getAbsoluteSiteUrl } from "./site-url";
import { universityIndexLocales, type UniversityLocaleIndexPolicy } from "./university-locale-index-policy";
import { getPolicyScenePilot } from "./policy-scene-pilot";
import type { PublicEntitySummary } from "@uapt/shared";
import { readingTranslation } from "./reading-translations";
import { getV6PageInput } from "./policy-v6-page-input";
import { getPolicyV6Data } from "./policy-v6";
import { isPublishedV6Slug } from "./policy-v6-published";
import { publishedV6Enabled } from "./policy-v6-published-gate";
import { ByteLru } from "./bounded-cache";
import { readingPackageSelection } from "./content-runtime";
import { isPolicyV6BaseTier, policyV6Tier } from "./policy-v6-tier";
import { schoolTargetLocales } from "./school-languages";
import { getCatalogUniversityBySlug } from "./catalog";

let cachedPolicy: { path: string; sha256: string; fileVersion: string; policy: UniversityLocaleIndexPolicy } | undefined;

async function loadPolicy(): Promise<UniversityLocaleIndexPolicy | undefined> {
  const policyPath = process.env.UAPT_UNIVERSITY_LOCALE_INDEX_POLICY;
  const expectedPolicySha = process.env.UAPT_UNIVERSITY_LOCALE_INDEX_POLICY_SHA256;
  if (!policyPath || !/^[a-f0-9]{64}$/.test(expectedPolicySha ?? "")) return undefined;
  const info = await stat(policyPath, { bigint: true });
  if (!info.isFile() || info.size > BigInt(4 * 1024 * 1024)) return undefined;
  const fileVersion = `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
  if (cachedPolicy?.path === policyPath && cachedPolicy.sha256 === expectedPolicySha && cachedPolicy.fileVersion === fileVersion) return cachedPolicy.policy;
  const raw = await readFile(policyPath);
  if (createHash("sha256").update(raw).digest("hex") !== expectedPolicySha) return undefined;
  const policy = JSON.parse(raw.toString("utf8")) as UniversityLocaleIndexPolicy;
  if (policy.schemaVersion !== "uapt-university-locale-index-policy-v1" || !/^[a-f0-9]{64}$/.test(policy.sourceSha256) || !policy.schools || !policy.globalCitationExceptions) return undefined;
  cachedPolicy = { path: policyPath, sha256: expectedPolicySha, fileVersion, policy };
  return policy;
}

/** One applicability + current-record + complete-package decision for metadata and sitemap. */
const excludedSceneFields = new Set(["slug", "artworkAlt", "artworkSrc", "artworkMobileSrc", "evidenceHref", "url", "language", "artworkContainsText", "artworkSquare", "artworkLandscape", "showGallerySummaries", "storyLayout", "studentFirst"]);
const v6DisplayKeys = new Set(["summary", "scope", "evidenceScope", "evidenceGap", "statusLabel", "title", "description", "howToObtain", "costToUser", "accessRequirements", "usageRestrictions", "en", "meaningEn", "text", "question", "answer", "label", "focus", "note", "notes", "conditions", "actions", "gaps", "do", "dont"]);
const v6ProtectedKeys = new Set(["evidence", "sources", "officialSources", "claims", "privateRecordContext", "editorialProjection", "analysisProjection", "completenessReview", "localChangeProposals", "claimDispositions", "workflowHolds", "basisRef", "toolDisplayCopy", "zh", "meaningZh", "summaryZh", "images", "publication", "presentationEvidenceAcceptance", "toolPresentationAcceptance"]);
export interface ReadingDisplayRequirement { source: string; field: string; fieldAliases?: string[] }
export interface V6ReadingDisplayInventory { requirements: ReadingDisplayRequirement[]; sourceScopeComplete: boolean }
function collectV6Display(value: unknown, root: string, output: ReadingDisplayRequirement[]) {
  const visit = (current: unknown, field: string, key = "") => {
    if (typeof current === "string") {
      if (current.trim() && v6DisplayKeys.has(key) && !/^https?:\/\//.test(current)) output.push({ source: current, field });
    } else if (Array.isArray(current)) current.forEach((item, index) => visit(item, `${field}/${index}`, key));
    else if (current && typeof current === "object") for (const [childKey, child] of Object.entries(current)) if (!v6ProtectedKeys.has(childKey)) visit(child, `${field}/${childKey}`, childKey);
  };
  visit(value, root);
}
export function localEvidenceDisplayRequirements(evidence: import("./policy-v6-local-evidence").LocalV6Evidence): ReadingDisplayRequirement[] {
  const output: ReadingDisplayRequirement[] = [];
  if (evidence.record.summary) output.push({ source: evidence.record.summary, field: "/public/summary" });
  for (const claim of evidence.record.claims) output.push({ source: claim.claimText, field: `/public/claims/${claim.id}/claimText` });
  collectV6Display(evidence.tools, "/tools", output);
  return output;
}

export async function v6DisplayRequirements(slug: string, summary?: PublicEntitySummary): Promise<V6ReadingDisplayInventory> {
  const publishedScope = isPublishedV6Slug(slug);
  if (!publishedScope && isPolicyV6BaseTier(slug)) {
    // Base tier shows record-derived topic prose; a reading locale is complete
    // only when that prose is accepted too. No private local input is read.
    const output: ReadingDisplayRequirement[] = [];
    collectV6Display((await getPolicyV6Data("en", slug)).schools, "/v6/schools", output);
    return { requirements: output.filter(requirement => requirement.source.trim()), sourceScopeComplete: true };
  }
  const input = getV6PageInput(slug, "en");
  if (!publishedScope && !input.bundle && !input.evidence) return { requirements: [], sourceScopeComplete: true };
  const data = await getPolicyV6Data("en", slug);
  const output: ReadingDisplayRequirement[] = [];
  if (input.bundle) collectV6Display(input.bundle, "/v6/view", output);
  const view = input.bundle;
  if (view) {
    for (const [id, scope] of Object.entries(view.claimScopes ?? {})) output.push({ source: scope, field: `/v6/claimScopes/${id}` });
    for (const disposition of view.claimDispositions ?? []) {
      output.push({ source: disposition.scope, field: `/v6/claimDispositions/${disposition.claimId}/scope` });
      output.push({ source: disposition.reason, field: `/v6/claimDispositions/${disposition.claimId}/reason` });
    }
    for (const topic of [...view.school.topics, ...view.school.additionalTopics]) for (const claim of topic.claims) output.push({ source: claim.text, field: `/v6/topics/${topic.key}/claims/${claim.id}/text` });
  }
  collectV6Display(data.schools, "/v6/schools", output);
  collectV6Display(data.studentActions, "/v6/studentActions", output);
  for (const claim of Object.values(data.studentActions?.claims ?? {})) {
    const alias = summary?.claims.find(row => row.id === claim.id && row.claimText === claim.text) ? [`/public/claims/${claim.id}/claimText`] : undefined;
    output.push({ source: claim.text, field: `/v6/studentActions/claims/${claim.id}/text`, ...(alias ? { fieldAliases: alias } : {}) });
    if (claim.scope) output.push({ source: claim.scope, field: `/v6/studentActions/claims/${claim.id}/scope`, ...(summary?.claims.some(row => row.id === claim.id && row.claimText === claim.scope) ? { fieldAliases: [`/public/claims/${claim.id}/claimText`] } : {}) });
    if (claim.deadline) output.push({ source: claim.deadline.en, field: `/v6/studentActions/claims/${claim.id}/deadline/en`, ...(summary?.claims.some(row => row.id === claim.id && row.claimText === claim.deadline!.en) ? { fieldAliases: [`/public/claims/${claim.id}/claimText`] } : {}) });
  }
  if (input.evidence) output.push(...localEvidenceDisplayRequirements(input.evidence));
  return { requirements: output.filter(requirement => requirement.source.trim()), sourceScopeComplete: publishedScope };
}
export function policySceneDisplaySources(slug: string, summary: PublicEntitySummary): ReadingDisplayRequirement[] {
  const scenes = [
    getPolicyScenePilot(slug, summary.claims, true, true, { isPreview: true }),
    getPolicyScenePilot(slug, summary.claims, false, true, { isPreview: true }),
    getPolicyScenePilot(slug, summary.claims, false, false, { isPreview: true })
  ].filter(Boolean);
  if (publishedV6Enabled() && isPublishedV6Slug(slug)) {
    const updates = new Map<string, ReadingDisplayRequirement>();
    for (const scene of scenes) {
      const source = scene?.sourceUpdate?.text;
      if (source?.trim()) updates.set(source, { source, field: "scene/sourceUpdate/text" });
    }
    return [...updates.values()];
  }
  const sources = new Map<string, ReadingDisplayRequirement>();
  const visit = (value: unknown, field = "") => {
    if (typeof value === "string") {
      const key = field.split("/").at(-1) ?? "";
      if (value.trim() && !excludedSceneFields.has(key) && !/^https?:\/\//.test(value)) sources.set(`${field}\0${value}`, { source: value, field: `scene${field}` });
    } else if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${field}/${index}`));
    else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) visit(item, `${field}/${key}`);
  };
  scenes.forEach(scene => visit(scene, ""));
  return [...sources.values()];
}

type ReadingBundle = import("./reading-translations").ReadingTranslationBundle;
// Weak keys tie a coverage result to the exact frozen, verified file objects.
// The file reader replaces these objects when any file identity changes; each
// pair retains at most two successful requirement inventories. Missing fields
// are always checked again rather than retained as a negative result.
const displayCoverageCache = new WeakMap<ReadingBundle, WeakMap<ReadingBundle, ByteLru<true>>>();

export function readingDisplayRequirementsComplete(requirements: readonly ReadingDisplayRequirement[], school: ReadingBundle, shared: ReadingBundle, sourceScopeComplete = true): boolean {
  if (!sourceScopeComplete) return false;
  const cacheable = isVerifiedReadingBundle(school) && isVerifiedReadingBundle(shared);
  const key = cacheable ? createHash("sha256").update(JSON.stringify(requirements)).digest("hex") : "";
  const schoolCache = cacheable ? displayCoverageCache.get(school) : undefined;
  const decisions = schoolCache?.get(shared);
  const cached = decisions?.get(key);
  if (cached !== undefined) return cached;
  const complete = requirements.every(requirement => {
    const { source, field } = requirement;
    const result = readingTranslation(source, [school, shared]);
    if (!result.translated) return false;
    const key = createHash("sha256").update(source).digest("hex");
    return [field, ...(requirement.fieldAliases ?? [])].some(alias => school.sourceFieldUses?.[key]?.includes(alias) === true || shared.sourceFieldUses?.[key]?.includes(alias) === true);
  });
  if (cacheable && complete) {
    const sharedCaches = schoolCache ?? new WeakMap<ReadingBundle, ByteLru<true>>();
    const retained = decisions ?? new ByteLru<true>(2, 256);
    retained.set(key, true, 65);
    if (!decisions) sharedCaches.set(shared, retained);
    if (!schoolCache) displayCoverageCache.set(school, sharedCaches);
  }
  return complete;
}

export async function universityReadingIndexLocales(slug: string, basis: { recordSha256: string; originalEvidenceSha256: string }, summary?: PublicEntitySummary, onlyLocale?: ReadingLocale): Promise<ReadingLocale[]> {
  if (!summary) return [DEFAULT_LOCALE];
  const pointer = readingPackageSelection().pointer;
  if (!pointer) return [DEFAULT_LOCALE];
  const policy = await loadPolicy();
  const registered = policy?.schools?.[slug];
  if (!policy || !registered || registered.recordSha256 !== basis.recordSha256) return [DEFAULT_LOCALE];
  // Multilingual (full V6) schools keep their reviewed locale registry. Every
  // other school is indexed only in English, Simplified Chinese and its country
  // or region language, each once accepted content is complete.
  const identity = policyV6Tier(slug) === "full" ? undefined : await getCatalogUniversityBySlug(slug);
  const school = identity ? { ...registered, locales: schoolTargetLocales(identity) } : registered;
  const requested = school.locales.filter(locale => locale !== DEFAULT_LOCALE && (!onlyLocale || locale === onlyLocale));
  if (requested.length === 0) return [DEFAULT_LOCALE];
  const sceneSources = policySceneDisplaySources(slug, summary);
  let v6Sources: V6ReadingDisplayInventory;
  try { v6Sources = await v6DisplayRequirements(slug, summary); }
  catch { return [DEFAULT_LOCALE]; }
  const requirements = [...sceneSources, ...v6Sources.requirements];
  const complete: ReadingLocale[] = [];
  for (const locale of requested) {
    const result = await getReadingTranslations(slug, locale, basis, pointer);
    if (result.state === "ready" && result.school.sourceSha256 === policy.sourceSha256 && result.shared.sourceSha256 === policy.sourceSha256 && readingDisplayRequirementsComplete(requirements, result.school, result.shared, v6Sources.sourceScopeComplete)) complete.push(locale);
  }
  return universityIndexLocales(slug, { ...policy, schools: { ...policy.schools, [slug]: school } }, {
    sharedLocales: READING_LOCALES.filter(locale => locale !== DEFAULT_LOCALE),
    schools: { [slug]: { recordSha256: basis.recordSha256, completeLocales: complete } }
  });
}

/** Index alternates are emitted only when the reviewed registry and exact package both pass. */
export async function universityReadingMetadata(slug: string, pathname: string, locale: ReadingLocale, basis: { recordSha256: string; originalEvidenceSha256: string }, summary?: PublicEntitySummary): Promise<Pick<Metadata, "alternates" | "robots">> {
  const canonical = getAbsoluteSiteUrl(withLocalePrefix(pathname, locale));
  const eligible: ReadingLocale[] = await universityReadingIndexLocales(slug, basis, summary).catch(() => [DEFAULT_LOCALE as ReadingLocale]);
  const development = process.env.NODE_ENV === "development";
  const robots: NonNullable<Metadata["robots"]> = { index: !development && (locale === DEFAULT_LOCALE || eligible.includes(locale)), follow: true };
  const languages = development || (locale !== DEFAULT_LOCALE && !eligible.includes(locale))
    ? undefined
    : Object.fromEntries(eligible.map(language => [language, getAbsoluteSiteUrl(withLocalePrefix(pathname, language))]));
  return { alternates: { canonical, ...(languages ? { languages: { ...languages, "x-default": getAbsoluteSiteUrl(pathname) } } : {}) }, robots };
}
