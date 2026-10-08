const isAllowedTulsaSlug = (slug:string):boolean => slug === "university-of-tulsa";
import {loadTulsaContent} from "@zone/lib/runtime-content";
import {EnforcementV4Refresh as RuntimeEnforcement} from "@zone/components/runtime-enforcement";
import {localizeV5Scene as localizeRuntimeScene} from "@zone/lib/scene-zh";
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
export const revalidate = false;

export async function generateStaticParams(){return [{slug:"university-of-tulsa"}];}

export async function generateMetadata({ params, searchParams }: UniversityPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  if(!isAllowedTulsaSlug(slug))notFound();
  await redirectAliasSlug(slug, localeParam);
  if (isEthEnforcementPreview(slug, (await searchParams)?.layout)) {
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
    ...(isPolicyReferencePreview(slug, (await searchParams)?.layout) ? { robots: { index: false, follow: false } } : {}),
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
  if(!isAllowedTulsaSlug(slug))notFound();
  await redirectAliasSlug(slug, localeParam);
  if (isEthEnforcementPreview(slug, (await searchParams)?.layout)) return <EthEnforcementPreview locale={locale} />;

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
  const reviewedClaims = publicSummary.claims.filter((claim) =>
    isReviewedClaim(claim.reviewState)
  );
  const strongSnapshot = isStrongStudentSnapshot(loadedSnapshot);
  const pageQuery = await searchParams;
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
  const isPublished = slug === "university-of-tulsa" || isPublishedPolicyReferencePage(slug);
  const isPreview = isPolicyReferencePreview(slug, pageQuery?.layout);
  const runtimeContent = await loadTulsaContent(slug, publicSummary.claims);
  const basePolicyScene = runtimeContent?.scene ?? getPolicyScenePilot(
    slug,
    publicSummary.claims,
    strongSnapshot,
    Boolean(pilotClaimsSummary),
    { isPreview: isPublished || isPreview }
  );
  const enforcementPage = Boolean(runtimeContent) || isPublished && enforcementV4RefreshSlugs.includes(slug);
  const policyScene = enforcementPage && locale === "zh" && basePolicyScene
    ? (runtimeContent ? localizeRuntimeScene(basePolicyScene) : localizeV5Scene(basePolicyScene))
    : basePolicyScene;
  const compactPolicyPilot = Boolean(policyScene?.quickGuide);
  const referencePreview = Boolean(
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
  const relatedUniversities = pilotSlug
    ? selectRelatedUniversities(
        slug,
        await getCatalogUniversities(),
        await getStagedPublicSummaries()
      )
    : undefined;
  const structuredDescription = pilotSeoDescription ?? citationReadySummary;
  const structuredDateModified = pilotSlug
    ? (await getIndexRecoveryLastModified(slug)).toISOString()
    : publicSummary.lastChangedAt ?? publicSummary.lastCheckedAt;

  return (
    <main className={`page-shell page-shell--wide${referencePreview ? " policy-reference" : ""}`} data-policy-layout={referencePreview ? "reference-v4" : undefined}>
      <JsonLd
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
      />

      <PolicyReferenceLayout enabled={referencePreview} locale={locale} claimsOnly={!strongSnapshot} enforcement={enforcementPage} tools={(slug === "university-of-tulsa" || isPublishedUniversityAiToolsModule(slug))} supplements={approvedPolicySupplementSlugs.includes(slug)}>
      <EntityHeader
        eyebrow={`${university.region}, ${university.country}`}
        metadata={
          <>
            {referencePreview ? <MetaLabel label={referenceUi("Review")}>{referencePreview ? <PolicyReferenceReview state={publicSummary.reviewState} locale={locale} /> : formatReviewState(publicSummary.reviewState)}</MetaLabel> : null}
            {compactPolicyPilot ? null : (
              <MetaLabel label="Ranking">
                {formatRanking(university.rankings)}
              </MetaLabel>
            )}
            <MetaLabel label={referenceUi("Updated")}>
              {formatDate(
                publicSummary.lastChangedAt ?? publicSummary.lastCheckedAt,
                locale
              )}
            </MetaLabel>
          </>
        }
        title={<span data-i18n="preserve">{displayName}</span>}
      />

      {enforcementPage ? <EnforcementTaskEntrances locale={locale} /> : null}
      {policyScene ? referencePreview ? <PolicyReferenceHero scene={policyScene} locale={locale} localizedActions={enforcementPage && locale === "zh"} emphasizeActions={enforcementPage} enforcement={enforcementPage} tools={(slug === "university-of-tulsa" || isPublishedUniversityAiToolsModule(slug))} supplements={approvedPolicySupplementSlugs.includes(slug)} /> : <PolicySceneHero scene={policyScene} /> : null}
      {policyScene && !compactPolicyPilot ? <PolicySceneStory scene={policyScene} /> : null}
      {policyScene?.quickGuide && !strongSnapshot && !referencePreview ? <PolicyQuickGuide scene={policyScene} /> : null}

      {strongSnapshot ? (
        <StudentPolicySnapshot
          claims={reviewedClaims}
          entitySlug={slug}
          locale={locale}
          role={role}
          scene={referenceScene}
          snapshot={loadedSnapshot.snapshot}
          guidanceInHero={referencePreview}
        />
      ) : null}
      {policyScene?.quickGuide && !strongSnapshot ? <PolicySceneGallery scene={referenceScene!} locale={referencePreview ? locale : "en"} /> : null}
      {enforcementPage ? <RuntimeEnforcement slug={slug} locale={locale} records={runtimeContent.records} /> : null}
      {(slug === "university-of-tulsa" || isPublishedUniversityAiToolsModule(slug)) ? <UniversityAiTools locale={locale} records={runtimeContent.tools ?? await getUniversityToolRecords(publicSummary)} /> : null}
      {approvedPolicySupplementSlugs.includes(slug) ? <PolicySupplements slug={slug} locale={locale} claims={reviewedClaims} /> : null}
      {referencePreview ? <PolicyReferenceInteractions /> : compactPolicyPilot ? <PolicyRecordHashReveal /> : null}

      <section className={`student-record-section${compactPolicyPilot ? " student-record-section--compact" : ""}`} id="claims">
        <div className="section-heading">
          <div>
            <p className="student-policy__eyebrow">Reviewed record</p>
            <h2>{referenceUi("Reviewed claims")}</h2>
          </div>
          <p>{referenceUi(`${reviewedClaims.length} reviewed claim${reviewedClaims.length === 1 ? "" : "s"}`)}</p>
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
          claimGroups ? (
            <UniversityClaimGroups
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

      <section className={`student-record-section${compactPolicyPilot ? " student-record-section--compact" : ""}`} id="sources">
        <div className="section-heading">
          <div>
            <p className="student-policy__eyebrow">Source record</p>
            <h2>{referenceUi("Official sources")}</h2>
          </div>
          <p>{referenceUi(`${publicSummary.officialSources.length} source${publicSummary.officialSources.length === 1 ? "" : "s"}`)}</p>
        </div>
        {compactPolicyPilot ? (
          <details className="policy-record-sources">
            <summary>{referenceUi("Open official source list")} <span aria-hidden="true">⌄</span></summary>
            <OfficialSourceAttributionList sources={publicSummary.officialSources} slug={slug} locale={locale} localizeUi={referencePreview} />
          </details>
        ) : (
          <OfficialSourceAttributionList sources={publicSummary.officialSources} slug={slug} locale={locale} localizeUi={referencePreview} />
        )}
      </section>

      {relatedUniversities?.length ? (
        <RelatedUniversities universities={relatedUniversities} locale={locale} localizeUi={referencePreview} />
      ) : null}

      <section className="student-record-info" id="record-info">
        <details>
          <summary>{referenceUi("Record information, JSON & citation")}</summary>
          <div className="student-record-info__body">
            <div className="tag-row" id="snapshot-scope">
              <MetaLabel label={referenceUi("Review")}>
                {referencePreview ? <PolicyReferenceReview state={publicSummary.reviewState} locale={locale} /> : formatReviewState(publicSummary.reviewState)}
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
      </PolicyReferenceLayout>
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
