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
import { Fragment } from 'react';
import { PolicyV6Provider, PolicyV6Actions, PolicyV6Intro, PolicyV6BeforeTools, PolicyV6ChecklistFaq, PolicyV6Faq } from '@/components/policy-v6';
import { getPolicyV6Data, isPolicyV6Preview } from '@/lib/policy-v6';
import { buildPolicyAnalysisProfile } from "@/lib/policy-analysis";
import { isCandidateRepairPreview } from "@/lib/public-record-repairs";
import { translatePolicyReferenceUi } from "@/lib/policy-reference-ui";
import { isStudentOnlyPolicyPage } from "@/lib/policy-page-audience";
import { isPublishedPolicyReferencePage, isPublishedUniversityAiToolsModule, isPolicyReferencePreview, preparePolicyReferenceScene } from "@/lib/policy-reference-preview";
import { PolicySupplements } from "@/components/policy-supplements";
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
import { normalizeLocale, withLocalePrefix } from "@/lib/i18n";
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

type PublicUniversitySummary = NonNullable<
  Awaited<ReturnType<typeof getPublicUniversitySummaryBySlug>>
>;

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const universities = await getCatalogUniversities();
  return universities.map((university) => ({ slug: university.slug }));
}

export async function generateMetadata({ params, searchParams }: UniversityPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  await redirectAliasSlug(slug, localeParam);
  if (isEthEnforcementPreview(slug, (await searchParams)?.layout) && !isPolicyV6Preview(slug, (await searchParams)?.layout)) {
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
  if (university && publicSummary && isPolicyV6Preview(slug, (await searchParams)?.layout)) {
    const seo = universityPolicySeo(publicSummary, locale);
    return {...seo,
      ...(process.env.NODE_ENV === "development" ? {robots: {index: false, follow: false}} : {}),
      twitter: {card: "summary_large_image", title: seo.title, description: seo.description, images: [getSiteOgImageUrl(locale)]},
      openGraph: {title: seo.title, description: seo.description, images: [getSiteOgImageUrl(locale)], url: String(seo.alternates.canonical), type: "article"}
    };
  }
  const displayName = university
    ? getLocalizedInstitutionName(university.slug, university.name, locale)
    : undefined;
  const pilotLocaleRestriction = getIndexRecoveryPilotLocaleRestriction(slug);
  const alternates = getLocalizedAlternates(
    `/universities/${slug}`,
    locale,
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
    ...((process.env.NODE_ENV === "development" && (isPolicyReferencePreview(slug, (await searchParams)?.layout) || isPolicyV6Preview(slug, (await searchParams)?.layout))) ? { robots: { index: false, follow: false } } : {}),
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
  await redirectAliasSlug(slug, localeParam);
  if (isEthEnforcementPreview(slug, (await searchParams)?.layout) && !isPolicyV6Preview(slug, (await searchParams)?.layout)) return <EthEnforcementPreview locale={locale} />;

  const pageQuery = await searchParams;
  const uiLab = isPolicyV6Preview(slug, pageQuery?.layout);
  const v6Input = uiLab ? getV6PageInput(slug, locale) : undefined;
  const localBundle = v6Input?.bundle;
  const v6PublicSummary = uiLab && publishedV6Enabled() && (publishedV6Slugs.includes(slug) || Boolean(v6Input?.bundle || v6Input?.evidence)) ? await getPublicUniversitySummaryBySlug(slug) : undefined;
  const v6JsonLd = v6PublicSummary ? <JsonLd data={universityPolicyStructuredData(v6PublicSummary, locale)} /> : null;
  if (localBundle) {
    const [identity, data, catalog, summaries] = await Promise.all([getCatalogUniversityBySlug(slug), getPolicyV6Data(locale, slug), getCatalogUniversities(), getStagedPublicSummaries()]);
    if (!identity) notFound();
    return <>{v6JsonLd}<PolicyV6BundlePage university={identity} data={data} view={localBundle} locale={locale} relatedUniversities={selectRelatedUniversities(slug, catalog, summaries, 4, true)} /></>;
  }
  const localEvidence = v6Input?.evidence;
  if (localEvidence) {
    const [localUniversity, localData, localCatalog, localSummaries] = await Promise.all([getCatalogUniversityBySlug(slug), getPolicyV6Data(locale, slug), getCatalogUniversities(), getStagedPublicSummaries()]);
    if (!localUniversity) notFound();
    return <>{v6JsonLd}<PolicyV6LocalPage university={localUniversity} data={localData} evidence={localEvidence} locale={locale} relatedUniversities={selectRelatedUniversities(slug, localCatalog, localSummaries, 4, true)}/></>;
  }

  const [university, publicSummary, loadedSnapshot] = await Promise.all([
    getCatalogUniversityBySlug(slug),
    getPublicUniversitySummaryBySlug(slug),
    getLoadedPolicySnapshotBySlug(slug)
  ]);

  if (!university || !publicSummary) notFound();

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
  const reviewedClaims = publicSummary.claims.filter((claim) =>
    draftPreview || isReviewedClaim(claim.reviewState)
  );
  const strongSnapshot = isStrongStudentSnapshot(loadedSnapshot);
  const labData = uiLab ? await getPolicyV6Data(locale, slug) : undefined;
  const LabProvider = labData ? PolicyV6Provider : Fragment;
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
    pilotContent?.claimsSummary && !strongSnapshot && hasCurrentIndexRecoveryBasis(slug, publicSummary.claims)
      ? pilotContent.claimsSummary
      : undefined;
  const isPublished = isPublishedPolicyReferencePage(slug);
  const isPreview = isPolicyReferencePreview(slug, pageQuery?.layout);
  const originalPolicyScene = getPolicyScenePilot(
    slug,
    publicSummary.claims,
    strongSnapshot,
    Boolean(pilotClaimsSummary),
    { isPreview: isPublished || isPreview }
  );
  const v6School = labData?.schools.find(s => s.slug === slug);
  const basePolicyScene = uiLab && v6School ? getPolicyV6IllustratedScene(v6School, locale) ?? originalPolicyScene : originalPolicyScene;
  const showSupplements = approvedPolicySupplementSlugs.includes(slug) && (!uiLab || slug === "harvard-university");
  const enforcementPage = isPublished && enforcementV4RefreshSlugs.includes(slug) && (!uiLab || slug === "harvard-university");
  const policyScene = enforcementPage && locale === "zh" && basePolicyScene
    ? localizeV5Scene(basePolicyScene)
    : basePolicyScene;
  const compactPolicyPilot = Boolean(policyScene?.quickGuide);
  const referencePreview = uiLab || Boolean(
    (policyScene?.quickGuide || enforcementPage) &&
    (strongSnapshot || pilotClaimsSummary || policyScene?.claimsOnly || Boolean(policyScene?.snapshotNotice) || enforcementPage) &&
    (isPublished || isPreview)
  );
  const referenceUi = (value: string) => referencePreview ? translatePolicyReferenceUi(value, locale) : value;
  const referenceScene = referencePreview && policyScene ? preparePolicyReferenceScene(policyScene) : policyScene;
  const pilotSeoDescription = pilotSlug
    ? buildIndexRecoveryDescription({
        slug,
        basisVerified: hasCurrentIndexRecoveryBasis(slug, publicSummary.claims),
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

      <LabProvider {...(labData ? { data: labData } : {})}>
      <PolicyReferenceLayout changes={uiLab} uiLab={uiLab} studentActions={Boolean(labData?.studentActionsPilot)} enabled={referencePreview} locale={locale} claimsOnly={!strongSnapshot && !uiLab} enforcement={enforcementPage} tools={isPublishedUniversityAiToolsModule(slug)} supplements={showSupplements}>
      {draftPreview ? <aside data-i18n="preserve" role="status">LOCAL CANDIDATE PREVIEW — pending review; not published. All evidence remains in its original language.</aside> : null}
      <EntityHeader
        actions={uiLab ? <div id="v6-header-actions"><PolicyV6Actions /></div> : undefined}
        leading={uiLab ? <UniversityHomepageMark slug={slug} name={displayName} locale={locale} /> : undefined}
        eyebrow={uiLab ? <PolicyV6HeaderLocation region={university.region} country={university.country} checkedAt={publicSummary.lastCheckedAt} changedAt={publicSummary.lastChangedAt} locale={locale} /> : `${university.region}, ${university.country}`}
        metadata={uiLab ? undefined :
          <>
            {referencePreview ? <MetaLabel label={referenceUi("Review")}><PolicyReferenceReview state={publicSummary.reviewState} locale={locale} /></MetaLabel> : null}
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
      {policyScene ? referencePreview ? <PolicyReferenceHero uiLab={uiLab} scene={policyScene} locale={locale} localizedActions={enforcementPage && locale === "zh"} emphasizeActions={enforcementPage} enforcement={enforcementPage} tools={isPublishedUniversityAiToolsModule(slug)} supplements={showSupplements} /> : <PolicySceneHero scene={policyScene} /> : null}
      {policyScene && !compactPolicyPilot && !uiLab ? <PolicySceneStory scene={policyScene} /> : null}
      {policyScene?.quickGuide && !strongSnapshot && !referencePreview ? <PolicyQuickGuide scene={policyScene} /> : null}

      {draftPreview ? <section id="candidate-analysis" data-i18n="preserve"><h2>Candidate analysis (pending review)</h2>{buildPolicyAnalysisProfile(publicSummary).dimensions.map(d => <article key={d.key}><h3>{d.key}: {d.status}</h3><p>{d.summary}</p></article>)}</section> : null}
      {draftPreview && loadedSnapshot ? <section id="candidate-snapshot" data-i18n="preserve"><h2>Candidate student summary (needs review)</h2><p>{loadedSnapshot.snapshot.summary}</p>{loadedSnapshot.snapshot.dimensions.map(d => <article key={d.key}><h3>{d.key}: {d.status}</h3><p>{d.summary}</p>{d.basis.claimIds.map(id => <a key={id} href={`#claim-${id}`}>{id} </a>)}</article>)}</section> : null}
      {strongSnapshot ? (
        <StudentPolicySnapshot
          claims={reviewedClaims}
          entitySlug={slug}
          locale={locale}
          role={role}
          scene={referenceScene}
          snapshot={loadedSnapshot.snapshot}
          guidanceInHero={referencePreview}
          uiLab={uiLab}
        />
      ) : null}
      {labData ? <PolicyV6RecordTopics data={labData} additionalOnly={strongSnapshot} /> : null}
      {policyScene?.quickGuide && !strongSnapshot && !uiLab ? <PolicySceneGallery scene={referenceScene!} locale={referencePreview ? locale : "en"} /> : null}
      {enforcementPage ? <EnforcementV4Refresh slug={slug} locale={locale} uiLab={uiLab} /> : null}
      {uiLab ? <PolicyV6BeforeTools /> : null}
      {isPublishedUniversityAiToolsModule(slug) ? <UniversityAiTools uiLab={uiLab} draftPreview={draftPreview} locale={locale} records={await getUniversityToolRecords(publicSummary)} /> : null}
      {uiLab ? <PolicyV6ChecklistFaq includeFaq={false} /> : null}
      {showSupplements ? <PolicySupplements slug={slug} locale={locale} claims={reviewedClaims} /> : null}
      {referencePreview ? <PolicyReferenceInteractions /> : compactPolicyPilot ? <PolicyRecordHashReveal /> : null}

      {uiLab ? <PolicyV6Changes slug={slug} recordSha256={labData?.schools.find(s=>s.slug===slug)?.fingerprint} locale={locale}/> : null}
      <section className={`student-record-section${compactPolicyPilot ? " student-record-section--compact" : ""}`} id="claims">
        <div className="section-heading">
          <div>
            <p className="student-policy__eyebrow">Reviewed record</p>
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
          uiLab ? <PolicyV6ClaimGroups entitySlug={slug} groups={claimGroups ?? groupReviewedClaimsByClaimType(reviewedClaims)} locale={locale} /> : claimGroups ? (
            <UniversityClaimGroups
              draftPreview={draftPreview}
              entitySlug={slug}
              groups={claimGroups}
              locale={locale}
              scene={compactPolicyPilot ? undefined : policyScene}
              role={role}
              collapsible={compactPolicyPilot}
              localizeUi={referencePreview}
            />
          ) : (
            <div className="claim-list">
              {reviewedClaims.map((claim) => (
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

      {uiLab ? <PolicyV6HeldRecords slug={slug} locale={locale}/> : null}
      <section className={`student-record-section${compactPolicyPilot ? " student-record-section--compact" : ""}`} id="sources">
        <div className="section-heading">
          <div>
            <p className="student-policy__eyebrow">Source record</p>
            <h2>{referenceUi("Official sources")}</h2>
          </div>
          <p>{referenceUi(`${publicSummary.officialSources.length} source${publicSummary.officialSources.length === 1 ? "" : "s"}`)}</p>
        </div>
        {uiLab ? <PolicyV6Sources sources={publicSummary.officialSources} slug={slug} locale={locale} /> : compactPolicyPilot ? (
          <details className="policy-record-sources">
            <summary>{referenceUi("Open official source list")} <span aria-hidden="true">⌄</span></summary>
            <OfficialSourceAttributionList sources={publicSummary.officialSources} slug={slug} locale={locale} localizeUi={referencePreview} />
          </details>
        ) : (
          <OfficialSourceAttributionList sources={publicSummary.officialSources} slug={slug} locale={locale} localizeUi={referencePreview} />
        )}
      </section>

      {relatedUniversities?.length ? (
        <RelatedUniversities universities={relatedUniversities} locale={locale} localizeUi={referencePreview} uiLab={uiLab} />
      ) : null}

      <section className="student-record-info" id="record-info">
        <details>
          <summary>{referenceUi("Record information, JSON & citation")}</summary>
          <div className="student-record-info__body">
            <div className="tag-row" id="snapshot-scope">
              <MetaLabel label={referenceUi("Review")}>
                {uiLab && v6School?.v6ReviewState === "agent_reviewed" ? <span className="policy-v6-review" data-v6-review-state="agent_reviewed">{policyV6AgentReviewLabel(locale)}</span> : referencePreview ? <PolicyReferenceReview state={publicSummary.reviewState} locale={locale} /> : formatReviewState(publicSummary.reviewState)}
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
