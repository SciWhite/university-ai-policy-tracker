import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Metadata } from "next";
import { getReadingTranslations } from "./reading-translations";
import { READING_LOCALES, type ReadingLocale } from "./language-catalog";
import { DEFAULT_LOCALE, withLocalePrefix } from "./i18n";
import { getAbsoluteSiteUrl } from "./site-url";
import { universityIndexLocales, type UniversityLocaleIndexPolicy } from "./university-locale-index-policy";
import { getPolicyScenePilot } from "./policy-scene-pilot";
import type { PublicEntitySummary } from "@uapt/shared";
import { readingTranslation } from "./reading-translations";
import { getV6PageInput } from "./policy-v6-page-input";
import { getPolicyV6Data } from "./policy-v6";
import { publishedV6Slugs } from "./policy-v6-published";
import { publishedV6Enabled } from "./policy-v6-published-gate";

let cachedPolicy: { path: string; sha256: string; policy: UniversityLocaleIndexPolicy } | undefined;

async function loadPolicy(): Promise<UniversityLocaleIndexPolicy | undefined> {
  const policyPath = process.env.UAPT_UNIVERSITY_LOCALE_INDEX_POLICY;
  const expectedPolicySha = process.env.UAPT_UNIVERSITY_LOCALE_INDEX_POLICY_SHA256;
  if (!policyPath || !/^[a-f0-9]{64}$/.test(expectedPolicySha ?? "")) return undefined;
  if (cachedPolicy?.path === policyPath && cachedPolicy.sha256 === expectedPolicySha) return cachedPolicy.policy;
  const raw = await readFile(policyPath);
  if (createHash("sha256").update(raw).digest("hex") !== expectedPolicySha) return undefined;
  const policy = JSON.parse(raw.toString("utf8")) as UniversityLocaleIndexPolicy;
  if (policy.schemaVersion !== "uapt-university-locale-index-policy-v1" || !/^[a-f0-9]{64}$/.test(policy.sourceSha256) || !policy.schools || !policy.globalCitationExceptions) return undefined;
  cachedPolicy = { path: policyPath, sha256: expectedPolicySha, policy };
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
  const publishedScope = publishedV6Slugs.includes(slug);
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
  if (publishedV6Enabled() && publishedV6Slugs.includes(slug)) {
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

export function readingDisplayRequirementsComplete(requirements: readonly ReadingDisplayRequirement[], school: import("./reading-translations").ReadingTranslationBundle, shared: import("./reading-translations").ReadingTranslationBundle, sourceScopeComplete = true): boolean {
  return sourceScopeComplete && requirements.every(requirement => {
    const { source, field } = requirement;
    const result = readingTranslation(source, [school, shared]);
    if (!result.translated) return false;
    const key = createHash("sha256").update(source).digest("hex");
    return [field, ...(requirement.fieldAliases ?? [])].some(alias => school.sourceFieldUses?.[key]?.includes(alias) === true || shared.sourceFieldUses?.[key]?.includes(alias) === true);
  });
}

export async function universityReadingIndexLocales(slug: string, basis: { recordSha256: string; originalEvidenceSha256: string }, summary?: PublicEntitySummary): Promise<ReadingLocale[]> {
  const sceneSources = summary ? policySceneDisplaySources(slug, summary) : [];
  let v6Sources: V6ReadingDisplayInventory;
  try { v6Sources = await v6DisplayRequirements(slug, summary); }
  catch { return [DEFAULT_LOCALE]; }
  if (!summary) return [DEFAULT_LOCALE];
  const policy = await loadPolicy();
  const school = policy?.schools?.[slug];
  if (!policy || !school || school.recordSha256 !== basis.recordSha256) return [DEFAULT_LOCALE];
  const pointer = process.env.UAPT_READING_PACKAGE_POINTER;
  if (!pointer) return [DEFAULT_LOCALE];
  const complete: ReadingLocale[] = [];
  for (const locale of school.locales) {
    if (locale === DEFAULT_LOCALE) continue;
    const result = await getReadingTranslations(slug, locale, basis, pointer);
    if (result.state === "ready" && result.school.sourceSha256 === policy.sourceSha256 && result.shared.sourceSha256 === policy.sourceSha256 && readingDisplayRequirementsComplete([...sceneSources, ...v6Sources.requirements], result.school, result.shared, v6Sources.sourceScopeComplete)) complete.push(locale);
  }
  return universityIndexLocales(slug, policy, {
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
