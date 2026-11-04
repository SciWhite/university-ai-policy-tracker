import { bindPolicyV6ReadingEvidence } from "@/lib/policy-v6-reading-evidence";
import { policyV6ClientData } from "@/lib/policy-v6-client-data";
import {PolicyV6Changes} from "@/components/policy-v6-changes";
import {UniversityHomepageMark} from '@/components/university-homepage-mark';
import {PolicyV6HeldRecords} from "@/components/policy-v6-held-records";
import {PolicyV6RecordLinks} from "@/components/policy-v6-record-links";
import {readV6RecordCorrections} from "@/lib/v6-effective-records";
import { UniversityMark } from "@/components/university-mark";
import { PolicyV6HeaderLocation } from "@/components/policy-v6-header-location";
import { getPolicyV6UniversityTitle } from "@/lib/policy-v6-university-title";
import {getV6PageInput} from "@/lib/policy-v6-page-input";
import {universityPolicySeo, universityPolicyStructuredData} from "@/lib/university-policy-seo";
import {publishedV6Enabled, publishedV6Slugs} from "@/lib/policy-v6-published-gate";
import { PolicyV6BundlePage } from "@/components/policy-v6-bundle-page";
import { PolicyV6Sources } from "@/components/policy-v6-sources";
import { PolicyV6ClaimGroups } from "@/components/policy-v6-claim-groups";
import { PolicyV6LocalPage } from '@/components/policy-v6-local-page';
import { policyV6AgentReviewLabel } from '@/lib/policy-v6-review';
import { getPolicyV6IllustratedScene } from '@/lib/policy-v6-illustrated-scene';
import { PolicyV6RecordTopics } from '@/components/policy-v6-record-topics';
import { Fragment, type ReactNode } from 'react';
import { PolicyV6Provider, PolicyV6Actions, PolicyV6Intro, PolicyV6BeforeTools, PolicyV6ChecklistFaq, PolicyV6Faq } from '@/components/policy-v6';
import { getPolicyV6Data, isPolicyV6Preview, type PolicyV6Data } from '@/lib/policy-v6';
import { buildPolicyAnalysisProfile } from "@/lib/policy-analysis";
import { isCandidateRepairPreview } from "@/lib/public-record-repairs";
import { translatePolicyReferenceUi } from "@/lib/policy-reference-ui";
import { isStudentOnlyPolicyPage } from "@/lib/policy-page-audience";
import { isPublishedPolicyReferencePage, isPublishedUniversityAiToolsModule, isPolicyReferencePreview, preparePolicyReferenceScene } from "@/lib/policy-reference-preview";
import { PolicySupplements, policySupplementsAcceptedUiSources } from "@/components/policy-supplements";
import { UniversityAiTools } from "@/components/university-ai-tools";
import { EnforcementTaskEntrances, EnforcementV4Refresh, enforcementV4RefreshSlugs } from "@/components/enforcement-v4-refresh";
import { localizeV5Scene } from "@/lib/enforcement-v5-scene-zh";
import { getUniversityToolRecords } from "@/lib/university-tools";
import { approvedPolicySupplementSlugs } from "@/lib/policy-supplements";
import { EthEnforcementPreview, isEthEnforcementPreview } from "@/components/eth-enforcement-preview";
import { PolicyReferenceLayout, PolicyReferenceHero, PolicyReferenceReview } from "@/components/policy-reference-layout";
import { PolicyReferenceInteractions } from "@/components/policy-reference-interactions";
import { hasCurrentIndexRecoveryBasis } from "@/lib/index-recovery-basis";
import { getIndexRecoveryLastModified } from "@/lib/index-recovery-dates";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getCatalogUniversities,
  getCatalogUniversityBySlug,
  getPublicJsonUrl,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { ClaimEvidenceCard } from "@/components/claim-evidence-card";
import { EntityHeader } from "@/components/entity-header";
import { PolicySceneHero } from "@/components/policy-scene-hero";
import { PolicySceneStory } from "@/components/policy-scene-story";
import { PolicyQuickGuide, PolicySceneGallery } from "@/components/policy-quick-guide";
import { PolicyRecordHashReveal } from "@/components/policy-record-hash-reveal";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { StudentPolicySnapshot, isStrongStudentSnapshot, normalizeStudentSnapshotRole } from "@/components/student-policy-snapshot";
import { DocumentLink as Link } from "@/components/document-link";
import { RelatedUniversities } from "@/components/related-universities";
import { UniversityClaimGroups } from "@/components/university-claim-groups";
import { normalizeLocale, normalizeReadingLocale, withLocalePrefix } from "@/lib/i18n";
import { getCanonicalSlugForAlias } from "@/lib/entity-aliases";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import {
  buildIndexRecoveryDescription,
  buildIndexRecoveryTitle,
  getIndexRecoveryPilotLocaleRestriction,
  indexRecoveryPilotContent,
  isIndexRecoveryPilotSlug
} from "@/lib/index-recovery-pilot";
import { getLoadedPolicySnapshotBySlug } from "@/lib/policy-snapshots";
import { getPolicyScenePilot } from "@/lib/policy-scene-pilot";
import { selectRelatedUniversities } from "@/lib/related-universities";
import { getStagedPublicSummaries } from "@/lib/staged-public-data";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { formatSnapshotHash } from "@/lib/snapshot-hash";
import { getSiteOgImageUrl } from "@/components/site-opengraph";
import {
  groupReviewedClaimsByClaimType,
  groupReviewedClaimsBySnapshotDimensions
} from "@/lib/university-claims-organization";
import { acceptedReadingUiText, getReadingTranslations, readingDisplayView, readingSummaryView, readingTranslation } from "@/lib/reading-translations";
import { readingDisplayRequirementsComplete, universityReadingMetadata, v6DisplayRequirements } from "@/lib/university-reading-metadata";
import { universityReadingBasis } from "@/lib/university-reading-basis";
import { policyV6Copy } from "@/lib/policy-v6-copy";
import { policyV6RecordCopy } from "@/lib/policy-v6-record-copy";
import { policyV6ReaderCopy } from "@/lib/policy-v6-reader-copy";
import { policyV6DensityCopy } from "@/lib/policy-v6-density-copy";
import { policyV6InteractionCopy } from "@/lib/policy-v6-interaction-copy";
import { v6ChangesCopy } from "@/lib/v6-changes-copy";
import { universityToolsUi } from "@/lib/university-tools-ui";
import { v5Ui } from "@/lib/enforcement-v5-ui";
import { policyV6StaticUiText } from "@/lib/policy-v6-static-ui";
import { readDevelopmentPreviewQuery } from "@/lib/development-preview-query";

type PublicUniversitySummary = NonNullable<Awaited<ReturnType<typeof getPublicUniversitySummaryBySlug>>>;

function acceptedV6UiText(translations: Extract<Awaited<ReturnType<typeof getReadingTranslations>>, { state: "ready" }>, readingLocale: ReturnType<typeof normalizeReadingLocale>, maxClaimCount = 20) {
  const collectStrings = (value: unknown, output: Set<string>) => {
    if (typeof value === "string") { if (value.trim()) output.add(value); return; }
    if (Array.isArray(value)) { value.forEach(item => collectStrings(item, output)); return; }
    if (value && typeof value === "object") Object.values(value).forEach(item => collectStrings(item, output));
  };
  const sourceSet = new Set<string>();
  [policyV6Copy("en"), policyV6RecordCopy("en"), policyV6DensityCopy("en"), policyV6ReaderCopy("en"), policyV6InteractionCopy("en"), v6ChangesCopy("en"), universityToolsUi("en"), v5Ui("en")].forEach(value => collectStrings(value, sourceSet));
  const sources = [
    ...policySupplementsAcceptedUiSources,
    ...Object.values(policyV6Copy("en")), ...Object.values(policyV6RecordCopy("en")),
    ...Object.values(policyV6DensityCopy("en")),
    ...Object.values(policyV6ReaderCopy("en")).filter((value): value is string => typeof value === "string"),
    "Reviewed record", "Source record", "Related university AI policy records", "Reviewed claims", "Official sources", "Official source", "University directory", "University official source", "External government reference", "Official evidence", "Academic Integrity", "Teaching", "Privacy", "Security Review", "Research", "Procurement", "Other", "Last checked", "Access conditions", "Institutional access / licence", "Conditions apply", "Recorded as allowed in the source scope", "View claims", "View all sources", "AI tools & access",
    "Record information, JSON & citation", "Reviewed claim", "Reviewed claims", "Explore",
    "On this page", "At a glance", "Student guide", "Academic integrity", "Coursework", "Exams", "Disclosure", "Data safety", "Approved tools", "More policy information", "About this record", "Scope and transition details", "Site interpretation; official evidence remains in its original language.", "Policy guidance below is in English; official evidence remains in its original language.", "No reviewed student policy snapshot has been published yet.", "Source check and dated evidence", "Check the rule for your school and assignment.", "AI-assisted review", "Review method",
    "Follow your school and course AI rule.", "Harvard guidance points you to your school and course.",
    "Search universities", "Independent · Open access · Not an official university page",
    "AI use guide", "AI use questioned?", "Advice and precautions", "Use in ChatGPT", "Do", "Don't",
    "Evidence ↗", "Close and return", "Student guide", "Academic integrity",
    "AI use questioned?", "Investigation & response", "Possible outcomes", "Review & appeal",
    "The current evidence does not include a verified specific procedure or deadline. Check the applicable university rules.",
    "Site advice", "Source guidance", "Requirement in this scope", "Print or save PDF",
    "Copy detail link", "Link copied", "Outdated or incorrect? Report an issue", "Scope",
    "Guidance is currently in English; original evidence retains its source language.",
    "Official university source", "Reviewed", "Last checked", "Original evidence", "Evidence", "Evidence locator", "Policy change history", "Hash and captured version",
    "{0} official URLs; {1} source attributions and their captured versions retained.",
    "{0} sources · Jump to a source", "Referenced by {0} claim records", "reviewed claims"
  ].filter((value): value is string => typeof value === "string");
  sources.push(...sourceSet);
  const reader = policyV6ReaderCopy("en");
  for (let count = 1; count <= Math.max(1, maxClaimCount); count++) sources.push(reader.sources(count), reader.bindings(count), `${count} reviewed claim${count === 1 ? "" : "s"}`);
  return { ...acceptedReadingUiText(sources, [translations.school, translations.shared]), ...policyV6StaticUiText(readingLocale) };
}

function isStudentGuideTranslated(data: PolicyV6Data | undefined, translations: Extract<Awaited<ReturnType<typeof getReadingTranslations>>, { state: "ready" }> | undefined, readingLocale: ReturnType<typeof normalizeReadingLocale>): boolean {
  if (!data?.studentActions || !translations) return false;
  if (readingLocale === "en" || readingLocale === "zh") return true;
  const guide = data.studentActions;
  const bundles = [translations.school, translations.shared];
  const sources = [guide.scope.en, ...guide.do.map(action => action.en), ...guide.dont.map(action => action.en)];
  const usedClaims = new Set([...guide.do, ...guide.dont].flatMap(action => action.claimIds));
  Object.values(guide.procedures).flat().forEach(id => usedClaims.add(id));
  for (const id of usedClaims) {
    const claim = guide.claims[id];
    if (!claim) return false;
    sources.push(claim.text);
    if (claim.scope) sources.push(claim.scope);
    if (claim.deadline?.en) sources.push(claim.deadline.en);
  }
  return sources.every(source => readingTranslation(source, bundles).translated);
}

function acceptedSceneView<T extends { eyebrow?: string; title?: string; guidance?: string; evidenceLabel?: string; scopeDetail?: string; snapshotNotice?: string; sourceUpdate?: { text: string; href: string }; quickGuide?: { scopeNote: string; do: { checks: { text: string }[] }; dont: { checks: { text: string }[] } }; storyCards?: { title: string; summary: string }[] }>(scene: T | undefined, translations: Extract<Awaited<ReturnType<typeof getReadingTranslations>>, { state: "ready" }>): T | undefined {
  if (!scene) return scene;
  const bundles = [translations.school, translations.shared], t = (value: string) => readingTranslation(value, bundles).text;
  return { ...scene,
    ...(scene.eyebrow ? { eyebrow: t(scene.eyebrow) } : {}), ...(scene.title ? { title: t(scene.title) } : {}),
    ...(scene.guidance ? { guidance: t(scene.guidance) } : {}), ...(scene.evidenceLabel ? { evidenceLabel: t(scene.evidenceLabel) } : {}),
    ...(scene.scopeDetail ? { scopeDetail: t(scene.scopeDetail) } : {}), ...(scene.snapshotNotice ? { snapshotNotice: t(scene.snapshotNotice) } : {}),
    ...(scene.sourceUpdate ? { sourceUpdate: { ...scene.sourceUpdate, text: t(scene.sourceUpdate.text) } } : {}),
    ...(scene.quickGuide ? { quickGuide: { ...scene.quickGuide, scopeNote: t(scene.quickGuide.scopeNote), do: { ...scene.quickGuide.do, checks: scene.quickGuide.do.checks.map(check => ({ ...check, text: t(check.text) })) }, dont: { ...scene.quickGuide.dont, checks: scene.quickGuide.dont.checks.map(check => ({ ...check, text: t(check.text) })) } } } : {}),
    ...(scene.storyCards ? { storyCards: scene.storyCards.map(card => ({ ...card, title: t(card.title), summary: t(card.summary) })) } : {})
  };
}

interface UniversityPageProps {
  params: Promise<{
    locale?: string;
    slug: string;
  }>;
  searchParams?: Promise<{
    for?: string | string[];
    layout?: string | string[];
  }>;
}

// Production never reads searchParams here, so any slug is rendered on its
// first request and then served from the ISR cache.
export const dynamicParams = true;
export const revalidate = 3600;

export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

export async function generateMetadata({ params, searchParams }: UniversityPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const readingLocale = normalizeReadingLocale(localeParam);
  await redirectAliasSlug(slug, localeParam);
  const layout = (await readDevelopmentPreviewQuery(searchParams))?.layout;
  if (isEthEnforcementPreview(slug, layout) && !isPolicyV6Preview(slug, layout)) {
    const title = "ETH Zurich AI policy evidence | University AI Policy Tracker";
    const description = "An independent sample of five source-backed ETH Zurich policy facts. Specific penalties and appeal deadlines were not established in the reviewed material; this is an evidence gap, not a finding that no rules exist.";
    return {
      title,
      description,
      alternates: getLocalizedAlternates("/universities/eth-zurich", locale),
      ...(process.env.NODE_ENV === "development" ? { robots: { index: false, follow: false } } : {}),
      openGraph: { title, description, images: [getSiteOgImageUrl(locale)], type: "article" }
    };
  }
  const university = await getCatalogUniversityBySlug(slug);
  const publicSummary = await getPublicUniversitySummaryBySlug(slug);
  if (university && publicSummary && isPolicyV6Preview(slug, layout)) {
    const seo = universityPolicySeo(publicSummary, locale);
    const metadataBasis = universityReadingBasis(slug, publicSummary) ?? { recordSha256: "", originalEvidenceSha256: "" };
    const localizedMetadata = await universityReadingMetadata(slug, `/universities/${slug}`, readingLocale, metadataBasis, publicSummary);
    return {...seo,
      ...localizedMetadata,
      ...(process.env.NODE_ENV === "development" ? {robots: {index: false, follow: false}} : {}),
      twitter: {card: "summary_large_image", title: seo.title, description: seo.description, images: [getSiteOgImageUrl(locale)]},
      openGraph: {title: seo.title, description: seo.description, images: [getSiteOgImageUrl(locale)], url: String(seo.alternates.canonical), type: "article"}
    };
  }
  const displayName = university
    ? getLocalizedInstitutionName(university.slug, university.name, locale)
    : undefined;
  const pilotLocaleRestriction = getIndexRecoveryPilotLocaleRestriction(slug);
  const localizedMetadata = publicSummary
    ? await universityReadingMetadata(slug, `/universities/${slug}`, readingLocale, universityReadingBasis(slug, publicSummary) ?? { recordSha256: "", originalEvidenceSha256: "" }, publicSummary)
    : undefined;
  const alternates = localizedMetadata?.alternates ?? getLocalizedAlternates(
    `/universities/${slug}`, locale,
    pilotLocaleRestriction ? { restrictLocales: pilotLocaleRestriction } : undefined
  );
  const canonical = String(alternates.canonical);

  const metadataSnapshot = isIndexRecoveryPilotSlug(slug)
    ? await getLoadedPolicySnapshotBySlug(slug) : undefined;
  const basisVerified = Boolean(publicSummary && hasCurrentIndexRecoveryBasis(slug, publicSummary.claims));
  const titleBasisVerified = basisVerified && (isStrongStudentSnapshot(metadataSnapshot) ||
    (isIndexRecoveryPilotSlug(slug) && Boolean(indexRecoveryPilotContent[slug].claimsSummary)));
  const pilotTitle = university && displayName
    ? buildIndexRecoveryTitle(displayName, slug, titleBasisVerified)
    : undefined;
  const pilotDescription = university && publicSummary
    ? await buildPilotDescription(slug, publicSummary)
    : undefined;

  const title = pilotTitle
    ? `${pilotTitle} | University AI Policy Tracker`
    : university
      ? `${displayName} AI policy | University AI Policy Tracker`
      : "University not found";
  const description = pilotDescription ??
    (university && publicSummary
      ? isIndexRecoveryPilotSlug(slug)
        ? `${displayName} AI policy record with reviewed claims and official sources.`
        : `${displayName} AI policy record with reviewed claims, official sources, and a student-first policy snapshot.`
      : "University AI Policy Tracker record not found.");

  return {
    title,
    description,
    alternates,
    ...(localizedMetadata?.robots ? { robots: localizedMetadata.robots } : {}),
    ...((process.env.NODE_ENV === "development" && (isPolicyReferencePreview(slug, layout) || isPolicyV6Preview(slug, layout))) ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      images: [getSiteOgImageUrl(locale)],
      url: canonical,
      type: "article"
    }
  };
}

async function buildPilotDescription(
  slug: string,
  publicSummary: PublicUniversitySummary
): Promise<string | undefined> {
  if (!isIndexRecoveryPilotSlug(slug)) return undefined;

  const loadedSnapshot = await getLoadedPolicySnapshotBySlug(slug);
  const strongSnapshotSummary = isStrongStudentSnapshot(loadedSnapshot)
    ? loadedSnapshot.snapshot.summary
    : undefined;
  const reviewedClaimCount = publicSummary.claims.filter((claim) =>
    isReviewedClaim(claim.reviewState)
  ).length;

  return buildIndexRecoveryDescription({
    slug,
    basisVerified: hasCurrentIndexRecoveryBasis(slug, publicSummary.claims),
    strongSnapshotSummary,
    reviewedClaimCount,
    officialSourceCount: publicSummary.officialSources.length
  });
}

export default async function UniversityPage({
  params,
  searchParams
}: UniversityPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const readingLocale = normalizeReadingLocale(localeParam);
  await redirectAliasSlug(slug, localeParam);
  const pageQuery = await readDevelopmentPreviewQuery(searchParams);
  if (isEthEnforcementPreview(slug, pageQuery?.layout) && !isPolicyV6Preview(slug, pageQuery?.layout)) return <EthEnforcementPreview locale={locale} />;

  const uiLab = isPolicyV6Preview(slug, pageQuery?.layout);
  // Preserve the pre-existing seven-locale V6 cache only when no complete
  // accepted reading package is selected. New reading locales stay English based.
  const fallbackV6Locale = readingLocale === locale ? locale : "en";
  // Translation hashes bind to the frozen English display export. Keep V6 input
  // language-neutral so pre-existing zh bundles cannot bypass the accepted 32-locale map.
  const v6Input = uiLab ? getV6PageInput(slug, "en") : undefined;
  const fallbackV6Input = uiLab && fallbackV6Locale !== "en" ? getV6PageInput(slug, fallbackV6Locale) : undefined;
  const localBundle = v6Input?.bundle;
  const v6PublicSummary = uiLab && publishedV6Enabled() && (publishedV6Slugs.includes(slug) || Boolean(v6Input?.bundle || v6Input?.evidence)) ? await getPublicUniversitySummaryBySlug(slug) : undefined;
  const v6Basis = v6PublicSummary
    ? universityReadingBasis(slug, v6PublicSummary)
    : undefined;
  const v6TranslationResult = v6Basis && readingLocale !== "en" ? await getReadingTranslations(slug, readingLocale, v6Basis) : undefined;
  const readyV6Translations = v6TranslationResult?.state === "ready" ? v6TranslationResult : undefined;
  const v6JsonLd = v6PublicSummary ? <JsonLd data={universityPolicyStructuredData(v6PublicSummary, locale)} /> : null;
  if (localBundle) {
    const [identity, rawData, catalog, summaries] = await Promise.all([getCatalogUniversityBySlug(slug), getPolicyV6Data("en", slug), getCatalogUniversities(), getStagedPublicSummaries()]);
    if (!identity) notFound();
    const v6Requirements = await v6DisplayRequirements(slug, v6PublicSummary).catch(() => undefined);
    const completeV6 = Boolean(readyV6Translations && v6Requirements && readingDisplayRequirementsComplete(v6Requirements.requirements, readyV6Translations.school, readyV6Translations.shared, v6Requirements.sourceScopeComplete));
    const displayV6 = completeV6 ? readyV6Translations : undefined;
    const fallbackData = displayV6 ? undefined : fallbackV6Locale === "en" ? rawData : await getPolicyV6Data(fallbackV6Locale, slug);
    const data = displayV6 ? { ...readingDisplayView(rawData, displayV6, readingLocale), locale, readingLocale, studentGuideTranslated: isStudentGuideTranslated(rawData, displayV6, readingLocale) } : fallbackData ?? rawData;
    const view = displayV6 ? readingDisplayView(localBundle, displayV6, readingLocale) : fallbackV6Input?.bundle ?? localBundle;
    return <>{v6JsonLd}<PolicyV6BundlePage university={identity} data={data} view={view} locale={locale} sharedUiText={displayV6 ? acceptedV6UiText(displayV6, readingLocale, Object.keys(rawData.studentActions?.claims ?? {}).length) : {}} relatedUniversities={selectRelatedUniversities(slug, catalog, summaries, 4, true)} /></>;
  }
  const localEvidence = v6Input?.evidence;
  if (localEvidence) {
    const [localUniversity, rawData, localCatalog, localSummaries] = await Promise.all([getCatalogUniversityBySlug(slug), getPolicyV6Data("en", slug), getCatalogUniversities(), getStagedPublicSummaries()]);
    if (!localUniversity) notFound();
    const v6Requirements = await v6DisplayRequirements(slug, v6PublicSummary).catch(() => undefined);
    const completeV6 = Boolean(readyV6Translations && v6Requirements && readingDisplayRequirementsComplete(v6Requirements.requirements, readyV6Translations.school, readyV6Translations.shared, v6Requirements.sourceScopeComplete));
    const displayV6 = completeV6 ? readyV6Translations : undefined;
    const fallbackData = displayV6 ? undefined : fallbackV6Locale === "en" ? rawData : await getPolicyV6Data(fallbackV6Locale, slug);
    const localData = displayV6 ? { ...readingDisplayView(rawData, displayV6, readingLocale), locale, readingLocale, studentGuideTranslated: isStudentGuideTranslated(rawData, displayV6, readingLocale) } : fallbackData ?? rawData;
    const evidence = displayV6 ? readingDisplayView(localEvidence, displayV6, readingLocale) : fallbackV6Input?.evidence ?? localEvidence;
    return <>{v6JsonLd}<PolicyV6LocalPage university={localUniversity} data={localData} evidence={evidence} locale={locale} sharedUiText={displayV6 ? acceptedV6UiText(displayV6, readingLocale, Object.keys(rawData.studentActions?.claims ?? {}).length) : {}} relatedUniversities={selectRelatedUniversities(slug, localCatalog, localSummaries, 4, true)}/></>;
  }

  const [university, rawPublicSummary, loadedSnapshot] = await Promise.all([
    getCatalogUniversityBySlug(slug),
    getPublicUniversitySummaryBySlug(slug),
    getLoadedPolicySnapshotBySlug(slug)
  ]);

  if (!university || !rawPublicSummary) notFound();
  const summaryBasis = universityReadingBasis(slug, rawPublicSummary);
  const translationResult = readingLocale !== "en" && summaryBasis ? await getReadingTranslations(slug, readingLocale, summaryBasis) : undefined;
  const readyTranslations = translationResult?.state === "ready" ? translationResult : undefined;
  const publicSummary = readyTranslations ? readingSummaryView(rawPublicSummary, readyTranslations) : rawPublicSummary;
  const displaySnapshot = readyTranslations && loadedSnapshot ? readingDisplayView(loadedSnapshot, readyTranslations, readingLocale) : loadedSnapshot;

  const displayName = getLocalizedInstitutionName(
    university.slug,
    university.name,
    locale
  );
  const publicJsonUrl = publicSummary.apiUrl ?? resolveUrl(
    getPublicJsonUrl(slug),
    publicSummary.canonicalUrl
  );
  const draftPreview = isCandidateRepairPreview(slug);
  const reviewedClaims = rawPublicSummary.claims.filter((claim) =>
    draftPreview || isReviewedClaim(claim.reviewState)
  );
  // Keep raw claims for every fingerprint, eligibility and evidence decision;
  // only the visible claim prose uses the accepted display view.
  const displayReviewedClaims = readyTranslations
    ? readingDisplayView(reviewedClaims, readyTranslations, readingLocale)
    : reviewedClaims;
  const strongSnapshot = isStrongStudentSnapshot(loadedSnapshot);
  const rawLabData = uiLab ? bindPolicyV6ReadingEvidence(await getPolicyV6Data("en", slug), reviewedClaims) : undefined;
  const labRequirements = uiLab && readyTranslations ? await v6DisplayRequirements(slug, rawPublicSummary).catch(() => undefined) : undefined;
  const displayLabTranslations = readyTranslations && labRequirements && readingDisplayRequirementsComplete(labRequirements.requirements, readyTranslations.school, readyTranslations.shared, labRequirements.sourceScopeComplete) ? readyTranslations : undefined;
  const legacyLabData = uiLab && fallbackV6Locale !== "en" && !displayLabTranslations ? bindPolicyV6ReadingEvidence(await getPolicyV6Data(fallbackV6Locale, slug), reviewedClaims) : undefined;
  const labData = displayLabTranslations && rawLabData ? { ...readingDisplayView(rawLabData, displayLabTranslations, readingLocale), locale, readingLocale, studentGuideTranslated: isStudentGuideTranslated(rawLabData, displayLabTranslations, readingLocale) } : legacyLabData ?? rawLabData;
  const role = isStudentOnlyPolicyPage(slug) ? "student" : normalizeStudentSnapshotRole(pageQuery?.for);
  const citationReadySummary = buildCitationSummary(
    displayName,
    publicSummary,
    publicJsonUrl,
    reviewedClaims.length
  );
  const canonicalUrl = publicSummary.publicPageUrl ?? publicSummary.canonicalUrl;

  const pilotSlug = isIndexRecoveryPilotSlug(slug) ? slug : undefined;
  const pilotContent = pilotSlug
    ? indexRecoveryPilotContent[pilotSlug]
    : undefined;
  const pilotClaimsSummary =
    pilotContent?.claimsSummary && !strongSnapshot && hasCurrentIndexRecoveryBasis(slug, rawPublicSummary.claims)
      ? pilotContent.claimsSummary
      : undefined;
  const isPublished = isPublishedPolicyReferencePage(slug);
  const isPreview = isPolicyReferencePreview(slug, pageQuery?.layout);
  const originalPolicyScene = getPolicyScenePilot(
    slug,
    rawPublicSummary.claims,
    strongSnapshot,
    Boolean(pilotClaimsSummary),
    { isPreview: isPublished || isPreview }
  );
  const v6School = labData?.schools.find(s => s.slug === slug);
  const sceneLocale = readyTranslations ? "en" : locale;
  const basePolicyScene = uiLab && v6School ? getPolicyV6IllustratedScene(v6School, sceneLocale) ?? originalPolicyScene : originalPolicyScene;
  const showSupplements = approvedPolicySupplementSlugs.includes(slug) && (!uiLab || slug === "harvard-university");
  const enforcementPage = isPublished && enforcementV4RefreshSlugs.includes(slug) && (!uiLab || slug === "harvard-university");
  const policyScene = readyTranslations
    ? acceptedSceneView(basePolicyScene, readyTranslations)
    : enforcementPage && readingLocale === "zh" && locale === "zh" && basePolicyScene
      ? localizeV5Scene(basePolicyScene)
      : basePolicyScene;
  const compactPolicyPilot = Boolean(policyScene?.quickGuide);
  const referencePreview = uiLab || Boolean(
    (policyScene?.quickGuide || enforcementPage) &&
    (strongSnapshot || pilotClaimsSummary || policyScene?.claimsOnly || Boolean(policyScene?.snapshotNotice) || enforcementPage) &&
    (isPublished || isPreview)
  );
  const readingUiText = readyTranslations ? acceptedV6UiText(readyTranslations, readingLocale, reviewedClaims.length) : {};
  const LabProvider = labData
    ? function PolicyV6PageProvider({ children }: { children: ReactNode }) {
        return <PolicyV6Provider data={policyV6ClientData(labData)} sharedUiText={readingUiText}>{children}</PolicyV6Provider>;
      }
    : Fragment;
  const referenceUi = (value: string) => readingUiText[value] ?? (referencePreview ? translatePolicyReferenceUi(value, locale) : value);
  const referenceScene = referencePreview && policyScene ? preparePolicyReferenceScene(policyScene) : policyScene;
  const pilotSeoDescription = pilotSlug
    ? buildIndexRecoveryDescription({
        slug,
        basisVerified: hasCurrentIndexRecoveryBasis(slug, rawPublicSummary.claims),
        strongSnapshotSummary: strongSnapshot
          ? loadedSnapshot.snapshot.summary
          : undefined,
        reviewedClaimCount: reviewedClaims.length,
        officialSourceCount: publicSummary.officialSources.length
      })
    : undefined;
  const claimGroups = (pilotContent || policyScene?.studentFirst)
    ? strongSnapshot
      ? groupReviewedClaimsBySnapshotDimensions(
          reviewedClaims,
          loadedSnapshot.snapshot
        )
      : groupReviewedClaimsByClaimType(reviewedClaims)
    : undefined;
  const displayClaimGroups = claimGroups
    ? claimGroups.map(group => ({ ...group, claims: group.claims.map(claim => displayReviewedClaims.find(item => item.id === claim.id) ?? claim) }))
    : undefined;
  const relatedUniversities = selectRelatedUniversities(
        slug,
        await getCatalogUniversities(),
        await getStagedPublicSummaries(),
        4,
        uiLab
      );
  const structuredDescription = pilotSeoDescription ?? citationReadySummary;
  const structuredDateModified = pilotSlug
    ? (await getIndexRecoveryLastModified(slug)).toISOString()
    : publicSummary.lastChangedAt ?? publicSummary.lastCheckedAt;

  return (
    <main className={`page-shell page-shell--wide${referencePreview ? " policy-reference" : ""}`} data-ui-experience={uiLab?'compact-evidence':undefined} data-policy-layout={uiLab ? "v6" : referencePreview ? "reference-v4" : undefined}>
      {uiLab ? v6JsonLd : <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: publicSummary.citationTitle,
          description: structuredDescription,
          url: canonicalUrl,
          dateModified: structuredDateModified,
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          mainEntity: {
            "@type": "Dataset",
            name: publicSummary.citationTitle,
            description: structuredDescription,
            url: canonicalUrl,
            license: "https://creativecommons.org/licenses/by/4.0/",
            isAccessibleForFree: true,
            creator: {
              "@type": "Organization",
              name: "University AI Policy Tracker",
              url: getAbsoluteSiteUrl("/")
            },
            distribution: {
              "@type": "DataDownload",
              name: `${publicSummary.entity.name} public JSON record`,
              encodingFormat: "application/json",
              contentUrl: publicJsonUrl
            }
          }
        }}
      />}

      <LabProvider>
      <PolicyReferenceLayout changes={uiLab} uiLab={uiLab} studentActions={Boolean(labData?.studentActionsPilot)} enabled={referencePreview} locale={locale} sharedUiText={readingUiText} claimsOnly={!strongSnapshot && !uiLab} enforcement={enforcementPage} tools={isPublishedUniversityAiToolsModule(slug)} supplements={showSupplements}>
      {draftPreview ? <aside data-i18n="preserve" role="status">LOCAL CANDIDATE PREVIEW — pending review; not published. All evidence remains in its original language.</aside> : null}
      <EntityHeader
        actions={uiLab ? <div id="v6-header-actions"><PolicyV6Actions /></div> : undefined}
        leading={uiLab ? <UniversityHomepageMark slug={slug} name={displayName} locale={locale} /> : undefined}
        eyebrow={uiLab ? <PolicyV6HeaderLocation region={university.region} country={university.country} checkedAt={publicSummary.lastCheckedAt} changedAt={publicSummary.lastChangedAt} locale={locale} sharedUiText={readingUiText} /> : `${university.region}, ${university.country}`}
        metadata={uiLab ? undefined :
          <>
            {referencePreview ? <MetaLabel label={referenceUi("Review")}><PolicyReferenceReview state={publicSummary.reviewState} locale={locale} sharedUiText={readingUiText} /></MetaLabel> : null}
            {compactPolicyPilot ? null : (
              <MetaLabel label="Ranking">
                {formatRanking(university.rankings)}
              </MetaLabel>
            )}
            <MetaLabel label={referenceUi("Updated")}>
              {formatDate(
                uiLab ? publicSummary.lastCheckedAt ?? publicSummary.lastChangedAt : publicSummary.lastChangedAt ?? publicSummary.lastCheckedAt,
                locale
              )}
            </MetaLabel>
          </>
        }
        title={<span data-i18n="preserve">{uiLab ? getPolicyV6UniversityTitle(slug, displayName) : displayName}</span>}
      />

      {uiLab ? <PolicyV6Intro /> : null}
      {enforcementPage ? <EnforcementTaskEntrances locale={locale} /> : null}
      {policyScene ? referencePreview ? <PolicyReferenceHero uiLab={uiLab} scene={policyScene} locale={locale} sharedUiText={readingUiText} localizedActions={enforcementPage && locale === "zh"} emphasizeActions={enforcementPage} enforcement={enforcementPage} tools={isPublishedUniversityAiToolsModule(slug)} supplements={showSupplements} /> : <PolicySceneHero scene={policyScene} /> : null}
      {policyScene && !compactPolicyPilot && !uiLab ? <PolicySceneStory scene={policyScene} /> : null}
      {policyScene?.quickGuide && !strongSnapshot && !referencePreview ? <PolicyQuickGuide scene={policyScene} /> : null}

      {draftPreview ? <section id="candidate-analysis" data-i18n="preserve"><h2>Candidate analysis (pending review)</h2>{buildPolicyAnalysisProfile(publicSummary).dimensions.map(d => <article key={d.key}><h3>{d.key}: {d.status}</h3><p>{d.summary}</p></article>)}</section> : null}
      {draftPreview && displaySnapshot ? <section id="candidate-snapshot" data-i18n="preserve"><h2>Candidate student summary (needs review)</h2><p>{displaySnapshot.snapshot.summary}</p>{displaySnapshot.snapshot.dimensions.map(d => <article key={d.key}><h3>{d.key}: {d.status}</h3><p>{d.summary}</p>{d.basis.claimIds.map(id => <a key={id} href={`#claim-${id}`}>{id} </a>)}</article>)}</section> : null}
      {strongSnapshot ? (
        <StudentPolicySnapshot
          claims={displayReviewedClaims}
          entitySlug={slug}
          locale={locale}
          role={role}
          scene={referenceScene}
          snapshot={displaySnapshot!.snapshot}
          guidanceInHero={referencePreview}
          uiLab={uiLab}
          roleSwitch={pageQuery !== undefined}
        />
      ) : null}
      {labData ? <PolicyV6RecordTopics data={labData} additionalOnly={strongSnapshot} sharedUiText={readingUiText} /> : null}
      {policyScene?.quickGuide && !strongSnapshot && !uiLab ? <PolicySceneGallery scene={referenceScene!} locale={referencePreview ? locale : "en"} /> : null}
      {enforcementPage ? <EnforcementV4Refresh slug={slug} locale={locale} uiLab={uiLab} /> : null}
      {uiLab ? <PolicyV6BeforeTools /> : null}
      {isPublishedUniversityAiToolsModule(slug) ? <UniversityAiTools uiLab={uiLab} draftPreview={draftPreview} locale={locale} sharedUiText={readingUiText} records={readyTranslations ? readingDisplayView(await getUniversityToolRecords(rawPublicSummary), readyTranslations, readingLocale) : await getUniversityToolRecords(publicSummary)} /> : null}
      {uiLab ? <PolicyV6ChecklistFaq includeFaq={false} /> : null}
      {showSupplements ? <PolicySupplements slug={slug} locale={locale} claims={displayReviewedClaims} sharedUiText={readingLocale === locale ? undefined : readingUiText} /> : null}
      {referencePreview ? <PolicyReferenceInteractions /> : compactPolicyPilot ? <PolicyRecordHashReveal /> : null}

      {uiLab ? <PolicyV6Changes slug={slug} recordSha256={labData?.schools.find(s=>s.slug===slug)?.fingerprint} locale={locale} sharedUiText={readingUiText}/> : null}
      <section className={`student-record-section${compactPolicyPilot ? " student-record-section--compact" : ""}`} id="claims">
        <div className="section-heading">
          <div>
            <p className="student-policy__eyebrow">{referenceUi("Reviewed record")}</p>
            <h2>{referenceUi("Reviewed claims")}</h2>
          </div>
          <p>{draftPreview ? `${reviewedClaims.length} candidate claims (needs review)` : referenceUi(`${reviewedClaims.length} reviewed claim${reviewedClaims.length === 1 ? "" : "s"}`)}</p>
        </div>
        {pilotClaimsSummary && !compactPolicyPilot ? (
          <div className="index-recovery-summary">
            <p>{pilotClaimsSummary.summary}</p>
            <p className="muted">
              Summary of the {reviewedClaims.length} agent-reviewed claims in
              this record, with their original scope. No student policy
              snapshot has been published for this university yet, and this
              summary is not an official university statement.
            </p>
          </div>
        ) : null}
        {policyScene?.sourceUpdate ? <aside id="current-source-supplement" className="policy-source-update" aria-label="Current official source supplement">
        <p>{policyScene.sourceUpdate.text}</p>
        <a href={policyScene.sourceUpdate.href} target="_blank" rel="noopener noreferrer">Read the current official source →</a>
      </aside> : null}
      {reviewedClaims.length ? (
          uiLab ? <PolicyV6ClaimGroups entitySlug={slug} groups={displayClaimGroups ?? groupReviewedClaimsByClaimType(displayReviewedClaims)} locale={locale} sharedUiText={readingUiText} /> : claimGroups ? (
            <UniversityClaimGroups
              draftPreview={draftPreview}
              entitySlug={slug}
              groups={displayClaimGroups ?? claimGroups}
              locale={locale}
              scene={compactPolicyPilot ? undefined : policyScene}
              role={role}
              collapsible={compactPolicyPilot}
              localizeUi={referencePreview}
            />
          ) : (
            <div className="claim-list">
              {displayReviewedClaims.map((claim) => (
                <ClaimEvidenceCard
                  claim={claim}
                  entitySlug={slug}
                  id={claim.id ? `claim-${claim.id}` : undefined}
                  key={claim.id ?? claim.claimText}
                  locale={locale}
                />
              ))}
            </div>
          )
        ) : (
          <p className="notice-card">No reviewed claims are published for this record yet.</p>
        )}
      </section>

      {uiLab ? <PolicyV6HeldRecords slug={slug} locale={locale} sharedUiText={readingUiText}/> : null}
      <section className={`student-record-section${compactPolicyPilot ? " student-record-section--compact" : ""}`} id="sources">
        <div className="section-heading">
          <div>
            <p className="student-policy__eyebrow">{referenceUi("Source record")}</p>
            <h2>{referenceUi("Official sources")}</h2>
          </div>
          <p>{referenceUi(`${publicSummary.officialSources.length} source${publicSummary.officialSources.length === 1 ? "" : "s"}`)}</p>
        </div>
        {uiLab ? <PolicyV6Sources sources={publicSummary.officialSources} slug={slug} locale={locale} sharedUiText={readingUiText} /> : compactPolicyPilot ? (
          <details className="policy-record-sources">
            <summary>{referenceUi("Open official source list")} <span aria-hidden="true">⌄</span></summary>
            <OfficialSourceAttributionList sources={publicSummary.officialSources} slug={slug} locale={locale} localizeUi={referencePreview} />
          </details>
        ) : (
          <OfficialSourceAttributionList sources={publicSummary.officialSources} slug={slug} locale={locale} localizeUi={referencePreview} />
        )}
      </section>

      {relatedUniversities?.length ? (
        <RelatedUniversities universities={relatedUniversities} locale={locale} localizeUi={referencePreview} uiLab={uiLab} sharedUiText={readingUiText} />
      ) : null}

      <section className="student-record-info" id="record-info">
        <details>
          <summary>{referenceUi("Record information, JSON & citation")}</summary>
          <div className="student-record-info__body">
            <div className="tag-row" id="snapshot-scope">
              <MetaLabel label={referenceUi("Review")}>
                {uiLab && v6School?.v6ReviewState === "agent_reviewed" ? <span className="policy-v6-review" data-v6-review-state="agent_reviewed">{policyV6AgentReviewLabel(locale)}</span> : referencePreview ? <PolicyReferenceReview state={publicSummary.reviewState} locale={locale} sharedUiText={readingUiText} /> : formatReviewState(publicSummary.reviewState)}
              </MetaLabel>
              <MetaLabel label={referenceUi("Confidence")}>
                {publicSummary.confidence === undefined
                  ? "Not listed"
                  : `${Math.round(publicSummary.confidence * 100)}%`}
              </MetaLabel>
              <MetaLabel label={referenceUi("Snapshot status")}>
                {referenceUi(loadedSnapshot?.validation.effectiveStatus ?? "Not published")}
              </MetaLabel>
              {loadedSnapshot ? (
                <MetaLabel label={referenceUi("Snapshot hash")}>
                  <span
                    className="hash-value"
                    title={loadedSnapshot.snapshot.basisFingerprint}
                  >
                    {formatSnapshotHash(loadedSnapshot.snapshot.basisFingerprint)}
                  </span>
                </MetaLabel>
              ) : null}
              <MetaLabel label={referenceUi("JSON")}>
                <a
                  data-analytics-entity-slug={slug}
                  data-analytics-event="record_public_json_click"
                  href={publicJsonUrl}
                >
                  {referenceUi("Public JSON")}
                </a>
              </MetaLabel>
            </div>
            {uiLab ? <PolicyV6RecordLinks slug={slug} locale={locale}/> : null}
            {uiLab?<p><a href="https://github.com/SciWhite/university-ai-policy-tracker/issues/new" target="_blank" rel="noopener noreferrer">{locale==='zh'?'发现过期或错误政策？报告问题':'Outdated or incorrect policy? Report an issue'} ↗</a></p>:null}
            <p className="student-record-info__citation">
              <strong>Citation:</strong> {publicSummary.suggestedCitation}
            </p>
            <p className="muted">
              Original university source language remains canonical. This tracker is not an official university statement.
            </p>
            <Link className="site-action" href={`/changes/${slug}`}>
              Open change log
            </Link>
          </div>
        </details>
      </section>
      {referencePreview ? <p className="policy-reference-print-note">Saved from University AI Policy Tracker. This record summarizes the cited sources; it is not an official university statement or assessment permission. Source and review dates are listed above. Hashes identify retained content, not authorization.</p> : null}
      {uiLab ? <PolicyV6Faq /> : null}
      </PolicyReferenceLayout>
      </LabProvider>
    </main>
  );
}

async function redirectAliasSlug(
  slug: string,
  localeParam: string | undefined
): Promise<void> {
  const canonicalSlug = await getCanonicalSlugForAlias(slug);
  if (canonicalSlug) {
    permanentRedirect(
      withLocalePrefix(
        `/universities/${canonicalSlug}`,
        normalizeLocale(localeParam)
      )
    );
  }
}

function isReviewedClaim(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function OfficialSourceAttributionList({
  sources,
  slug,
  locale = "en",
  localizeUi = false
}: {
  sources: PublicUniversitySummary["officialSources"];
  slug: string;
  locale?: import("@/lib/i18n").SupportedLocale;
  localizeUi?: boolean;
}) {
  const t = (value: string) => localizeUi ? translatePolicyReferenceUi(value, locale) : value;
  return (
    <div className="student-source-attribution-list">
      {sources.map((source) => (
        <article
          className="student-source-attribution"
          key={`${source.sourceUrl}:${source.snapshotHash}`}
        >
          <div>
            <h3>{source.citationTitle}</h3>
            <p className="muted">{source.publisher ?? "Official university source"}</p>
            {slug === "imperial-college-london" && source.sourceUrl.includes("dAIsy-use-guidance-and-process-flows") ? <p data-i18n="preserve" lang={locale === "zh" ? "zh" : "en"}>{locale === "zh" ? "历史来源目前无法访问（HTTP 404）；保留原历史哈希，当前主张不以此证明政策有效。" : "Historical source currently unavailable (HTTP 404). Original historical hash retained; current claims do not rely on this source."}</p> : null}
          </div>
          <dl>
            <div>
              <dt>{t("Source URL")}</dt>
              <dd>
                <a
                  data-analytics-entity-slug={slug}
                  data-analytics-event="official_source_click"
                  data-analytics-source-domain={getSourceDomain(source.sourceUrl)}
                  href={source.sourceUrl}
                >
                  {source.sourceUrl}
                </a>
              </dd>
            </div>
            <div>
              <dt>{t("Snapshot hash")}</dt>
              <dd className="hash-value" title={source.snapshotHash}>
                {formatSnapshotHash(source.snapshotHash)}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function formatRanking(
  rankings: Array<{ systemId: string; systemName: string; rankingYear: number | string; rankText: string }>
): string {
  const ranking = rankings.find((item) => item.systemId === "qs") ?? rankings[0];
  return ranking
    ? `${ranking.systemName} ${ranking.rankingYear}: ${ranking.rankText}`
    : "Not listed";
}

function formatDate(value: string | undefined, locale: string): string {
  if (!value) return "Not listed";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatReviewState(value: string): string {
  return value.replaceAll("_", " ");
}

function resolveUrl(pathOrUrl: string, baseUrl: string): string {
  return new URL(pathOrUrl, baseUrl).toString();
}

function getSourceDomain(href: string): string | undefined {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function buildCitationSummary(
  displayName: string,
  summary: PublicUniversitySummary,
  publicJsonUrl: string,
  reviewedClaimCount: number
): string {
  const update = summary.lastCheckedAt
    ? ` Last checked ${formatDate(summary.lastCheckedAt, "en")}.`
    : "";
  return `${displayName} AI policy record with ${reviewedClaimCount} reviewed claim${reviewedClaimCount === 1 ? "" : "s"} from ${summary.officialSources.length} official source${summary.officialSources.length === 1 ? "" : "s"}.${update} Public JSON: ${publicJsonUrl}.`;
}
