import { notFound } from "next/navigation";
import {
  getCatalogUniversityBySlug,
  getPublicJsonUrl,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { AnalysisStatusLabel } from "@/components/analysis-status-label";
import { ClaimEvidenceCard } from "@/components/claim-evidence-card";
import { DocumentLink as Link } from "@/components/document-link";
import { EntityHeader } from "@/components/entity-header";
import { EntitySidebar } from "@/components/entity-sidebar";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { ReferenceTabs } from "@/components/reference-tabs";
import { StateLabel } from "@/components/state-label";
import { normalizeLocale } from "@/lib/i18n";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getPolicyAnalysisProfileBySlug } from "@/lib/policy-analysis";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface UniversityPageProps {
  params: Promise<{
    locale?: string;
    slug: string;
  }>;
}

type PublicUniversitySummary = NonNullable<
  Awaited<ReturnType<typeof getPublicUniversitySummaryBySlug>>
>;
type PublicUniversityClaim = PublicUniversitySummary["claims"][number];

const recordTabs = [
  { label: "Overview", href: "#overview" },
  { label: "Policy profile", href: "#policy-profile" },
  { label: "Claims", href: "#claims" },
  { label: "Sources", href: "#sources" },
  { label: "Changes", href: "#changes" },
  { label: "JSON", href: "#json" },
  { label: "Citation", href: "#citation" }
] as const;

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateMetadata({ params }: UniversityPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const university = await getCatalogUniversityBySlug(slug);
  const publicSummary = await getPublicUniversitySummaryBySlug(slug);
  const displayName = university
    ? getLocalizedInstitutionName(university.slug, university.name, locale)
    : undefined;
  const alternates = getLocalizedAlternates(`/universities/${slug}`, locale);
  const canonical = String(alternates.canonical);
  const title = university
    ? `${displayName} AI Policy: ChatGPT, GenAI Rules & Sources`
    : "University not found";
  const description = university && publicSummary
    ? buildUniversityMetaDescription({
        displayName,
        summary: publicSummary
      })
    : university
      ? `${displayName} AI policy record with evidence-backed claims, official sources, review state, confidence, and public JSON.`
    : "University AI Policy Tracker record not found.";

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article"
    }
  };
}

export default async function UniversityPage({ params }: UniversityPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const university = await getCatalogUniversityBySlug(slug);
  const publicSummary = await getPublicUniversitySummaryBySlug(slug);
  const policyAnalysisProfile = await getPolicyAnalysisProfileBySlug(slug);

  if (!university || !publicSummary) {
    notFound();
  }
  const displayName = getLocalizedInstitutionName(
    university.slug,
    university.name,
    locale
  );
  const jsonUrl = getPublicJsonUrl(slug);
  const publicJsonUrl =
    publicSummary.apiUrl ?? resolveUrl(jsonUrl, publicSummary.canonicalUrl);
  const publicJsonPath = new URL(publicJsonUrl).pathname;
  const reviewedClaims = publicSummary.claims.filter((claim) =>
    isReviewedClaim(claim.reviewState)
  );
  const candidateClaims = publicSummary.claims.filter(
    (claim) => !isReviewedClaim(claim.reviewState)
  );
  const policyStatus = getPolicyStatus(
    reviewedClaims.length,
    candidateClaims.length,
    publicSummary.officialSources.length
  );
  const canonicalUrl = publicSummary.publicPageUrl ?? publicSummary.canonicalUrl;
  const citationReadySummary = buildCitationReadySummary({
    candidateClaimCount: candidateClaims.length,
    displayName,
    officialSourceCount: publicSummary.officialSources.length,
    publicJsonUrl,
    reviewedClaimCount: reviewedClaims.length,
    summary: publicSummary,
    totalClaimCount: publicSummary.claims.length
  });
  const sourceLanguages = getSourceLanguages(publicSummary.claims);

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: publicSummary.citationTitle,
          description: citationReadySummary,
          url: canonicalUrl,
          dateModified:
            publicSummary.lastChangedAt ?? publicSummary.lastCheckedAt,
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          mainEntity: {
            "@type": "Dataset",
            name: publicSummary.citationTitle,
            description: citationReadySummary,
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

      <EntityHeader
        actions={
          <>
            <div className="entity-header__desktop-actions">
              <a
                className="site-action"
                data-analytics-entity-slug={slug}
                data-analytics-event="record_public_json_click"
                href={publicJsonUrl}
              >
                Public JSON
              </a>
              <Link className="site-action" href={`/changes/${slug}`}>
                Change log
              </Link>
              <Link className="site-action" href="/reports/monthly/2026-05">
                Monthly report
              </Link>
              <Link className="site-action" href="/citation">
                Citation rules
              </Link>
              <Link className="site-action" href="/datasets">
                Dataset access
              </Link>
              {policyAnalysisProfile ? (
                <a
                  className="site-action"
                  data-analytics-endpoint-kind="analysis"
                  data-analytics-entity-slug={slug}
                  data-analytics-event="api_link_click"
                  href={policyAnalysisProfile.publicJsonUrl}
                >
                  Analysis JSON
                </a>
              ) : null}
              <Link className="site-action" href="/contribute">
                Submit correction
              </Link>
            </div>
            <div className="entity-header__mobile-actions">
              <a
                className="site-action"
                data-analytics-entity-slug={slug}
                data-analytics-event="record_public_json_click"
                href={publicJsonUrl}
              >
                Public JSON
              </a>
              <Link className="site-action" href="/citation">
                Citation rules
              </Link>
              <details className="entity-header__tool-menu">
                <summary>More tools</summary>
                <div>
                  <Link className="site-action" href={`/changes/${slug}`}>
                    Change log
                  </Link>
                  <Link className="site-action" href="/reports/monthly/2026-05">
                    Monthly report
                  </Link>
                  <Link className="site-action" href="/datasets">
                    Dataset access
                  </Link>
                  {policyAnalysisProfile ? (
                    <a
                      className="site-action"
                      data-analytics-endpoint-kind="analysis"
                      data-analytics-entity-slug={slug}
                      data-analytics-event="api_link_click"
                      href={policyAnalysisProfile.publicJsonUrl}
                    >
                      Analysis JSON
                    </a>
                  ) : null}
                  <Link className="site-action" href="/contribute">
                    Submit correction
                  </Link>
                </div>
              </details>
            </div>
          </>
        }
        eyebrow={`${university.region}, ${university.country}`}
        metadata={
          <>
            {publicSummary.lastCheckedAt ? (
              <MetaLabel label="Last checked">
                {formatDate(publicSummary.lastCheckedAt)}
              </MetaLabel>
            ) : null}
            {publicSummary.lastChangedAt ? (
              <MetaLabel label="Last changed">
                {formatDate(publicSummary.lastChangedAt)}
              </MetaLabel>
            ) : null}
            <StateLabel reviewState={publicSummary.reviewState} />
            {publicSummary.confidence !== undefined ? (
              <MetaLabel label="Confidence">
                {Math.round(publicSummary.confidence * 100)}%
              </MetaLabel>
            ) : null}
          </>
        }
        title={displayName}
      />

      <ReferenceTabs tabs={recordTabs} />

      <div className="entity-record-layout">
        <div className="entity-record-main">
          <ReferenceBox
            id="overview"
            title="Record status"
          >
            <div className="tag-row">
              <MetaLabel label="Policy status">{policyStatus}</MetaLabel>
              <StateLabel reviewState={publicSummary.reviewState} />
              <MetaLabel label="Claim coverage">
                {formatClaimCoverage(reviewedClaims.length, candidateClaims.length)}
              </MetaLabel>
              <MetaLabel label="Evidence-backed claims">
                {publicSummary.claims.length}
              </MetaLabel>
              <MetaLabel label="Reviewed">{reviewedClaims.length}</MetaLabel>
              <MetaLabel label="Candidate">{candidateClaims.length}</MetaLabel>
              <MetaLabel label="Official sources">
                {publicSummary.officialSources.length}
              </MetaLabel>
              <MetaLabel label="Source language">
                {sourceLanguages.length ? sourceLanguages.join(", ") : "Not specified"}
              </MetaLabel>
              <MetaLabel label="Public JSON">
                <a
                  data-analytics-entity-slug={slug}
                  data-analytics-event="record_public_json_click"
                  href={publicJsonUrl}
                >
                  {publicJsonPath}
                </a>
              </MetaLabel>
            </div>
          </ReferenceBox>

          {policyAnalysisProfile ? (
            <ReferenceBox
              id="policy-profile"
              title="Policy profile"
              actions={
                <>
                  <a
                    className="site-action"
                    data-analytics-endpoint-kind="analysis"
                    data-analytics-entity-slug={slug}
                    data-analytics-event="api_link_click"
                    href={policyAnalysisProfile.publicJsonUrl}
                  >
                    Analysis JSON
                  </a>
                  <Link className="site-action" href="/review#analysis-review">
                    Analysis review
                  </Link>
                </>
              }
            >
              <div className="tag-row">
                <MetaLabel label="Coverage score">
                  {policyAnalysisProfile.coverageScore.score}/
                  {policyAnalysisProfile.coverageScore.maxScore}
                </MetaLabel>
                <MetaLabel label="Coverage label">
                  {policyAnalysisProfile.coverageScore.label.replaceAll("_", " ")}
                </MetaLabel>
                <StateLabel reviewState={policyAnalysisProfile.reviewState} />
                <MetaLabel label="Analysis confidence">
                  {Math.round(policyAnalysisProfile.confidence * 100)}%
                </MetaLabel>
              </div>
              <div className="analysis-dimension-list">
                {policyAnalysisProfile.dimensions.map((dimension) => (
                  <article
                    className="analysis-dimension-row"
                    data-analysis-status={dimension.status}
                    key={dimension.key}
                  >
                    <div>
                      <h3>{dimension.label}</h3>
                      <p>{dimension.summary}</p>
                      {dimension.notMentionedReason ? (
                        <p className="muted">{dimension.notMentionedReason}</p>
                      ) : null}
                    </div>
                    <div className="analysis-dimension-row__meta">
                      <AnalysisStatusLabel
                        prefix=""
                        status={dimension.status}
                      />
                      <StateLabel
                        prefix=""
                        reviewState={dimension.reviewState}
                      />
                      <MetaLabel label="Confidence">
                        {Math.round(dimension.confidence * 100)}%
                      </MetaLabel>
                      <MetaLabel label="Evidence">
                        {dimension.evidenceCount}
                      </MetaLabel>
                      <MetaLabel label="Sources">{dimension.sourceCount}</MetaLabel>
                    </div>
                    <div className="analysis-dimension-row__links">
                      {dimension.basis.slice(0, 3).map((basis) => (
                        <Link
                          href={`#claim-${basis.claimId}`}
                          key={`${dimension.key}:${basis.claimId}`}
                        >
                          Claim {basis.claimId}
                        </Link>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </ReferenceBox>
          ) : null}

          <section className="record-section" id="claims">
            <div className="section-heading">
              <h2>Evidence-backed claims</h2>
              <p>{reviewedClaims.length} reviewed evidence-backed public claim</p>
            </div>
            {reviewedClaims.length ? (
              <div className="claim-list">
                {reviewedClaims.map((claim) => (
                  <ClaimEvidenceCard
                    claim={claim}
                    id={claim.id ? `claim-${claim.id}` : undefined}
                    key={claim.id ?? claim.claimText}
                    locale={locale}
                  />
                ))}
              </div>
            ) : (
              <p className="notice-card">
                No reviewed claims are published for this record yet. Candidate
                claims remain visible below for source-review workflow
                transparency.
              </p>
            )}
          </section>

          <section className="record-section">
            <div className="section-heading">
              <h2>Candidate claims</h2>
              <p>{candidateClaims.length} machine or needs-review claim</p>
            </div>
            {candidateClaims.length ? (
              <div className="claim-list">
                {candidateClaims.map((claim) => (
                  <ClaimEvidenceCard
                    claim={claim}
                    id={claim.id ? `claim-${claim.id}` : undefined}
                    key={claim.id ?? claim.claimText}
                    locale={locale}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <section className="record-section" id="sources">
            <div className="section-heading">
              <h2>Official sources</h2>
              <p>{publicSummary.officialSources.length} source attribution</p>
            </div>
            <div className="source-attribution-list">
              {publicSummary.officialSources.map((source) => (
                <article
                  className="source-attribution-row"
                  key={`${source.sourceUrl}:${source.snapshotHash}`}
                >
                  <div>
                    <h3>{source.citationTitle}</h3>
                    <p className="muted">
                      {source.publisher ?? "Official university source"}
                    </p>
                  </div>
                  <dl className="source-attribution-row__meta">
                    <div>
                      <dt>Source URL</dt>
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
                      <dt>Snapshot hash</dt>
                      <dd className="hash-value">{source.snapshotHash}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <ReferenceBox
            id="changes"
            title="Change log"
          >
            <div className="tag-row">
              {publicSummary.lastCheckedAt ? (
                <MetaLabel label="Last checked">
                  {formatDate(publicSummary.lastCheckedAt)}
                </MetaLabel>
              ) : null}
              {publicSummary.lastChangedAt ? (
                <MetaLabel label="Last changed">
                  {formatDate(publicSummary.lastChangedAt)}
                </MetaLabel>
              ) : null}
              <Link className="site-action" href={`/changes/${slug}`}>
                Open change log
              </Link>
            </div>
          </ReferenceBox>

          <ReferenceBox title="Corrections">
            <div className="tag-row">
              <Link className="site-action" href="/contribute">
                Open contribution paths
              </Link>
              <Link className="site-action" href="/review">
                Review workflow
              </Link>
            </div>
          </ReferenceBox>

          <section className="record-section">
            <Link href="/universities">Back to universities</Link>
          </section>
        </div>

        <EntitySidebar
          canonicalUrl={publicSummary.canonicalUrl}
          citationText={publicSummary.suggestedCitation}
          license={publicSummary.license}
          limitations={publicSummary.limitations}
          officialSourceCount={publicSummary.officialSources.length}
          publicJsonUrl={publicJsonUrl}
          sourceRightsPolicy={publicSummary.sourceRightsPolicy}
        />
      </div>
    </main>
  );
}

function isReviewedClaim(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function getPolicyStatus(
  reviewedClaimCount: number,
  candidateClaimCount: number,
  sourceCount: number
): string {
  if (reviewedClaimCount > 0) return "Reviewed evidence-backed record";
  if (candidateClaimCount > 0) return "Candidate evidence-backed record";
  if (sourceCount > 0) return "Source-attributed record";

  return "No public claim record yet";
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

function buildUniversityMetaDescription({
  displayName,
  summary
}: {
  displayName: string | undefined;
  summary: PublicUniversitySummary;
}): string {
  const name = displayName ?? summary.entity.name;
  const sourceLanguages = getSourceLanguages(summary.claims);
  const checkedText = summary.lastCheckedAt
    ? ` Last checked ${formatDate(summary.lastCheckedAt)}.`
    : "";
  const languageText = sourceLanguages.length
    ? ` Source language: ${sourceLanguages.join(", ")}.`
    : "";

  return `${name} AI policy and ChatGPT/GenAI rule record with ${summary.claims.length} source-backed claims from ${summary.officialSources.length} official sources, review state, evidence snippets, and public JSON.${checkedText}${languageText}`;
}

interface CitationReadySummaryInput {
  candidateClaimCount: number;
  displayName: string;
  officialSourceCount: number;
  publicJsonUrl: string;
  reviewedClaimCount: number;
  summary: PublicUniversitySummary;
  totalClaimCount: number;
}

function buildCitationReadySummary({
  candidateClaimCount,
  displayName,
  officialSourceCount,
  publicJsonUrl,
  reviewedClaimCount,
  summary,
  totalClaimCount
}: CitationReadySummaryInput): string {
  const checkedText = summary.lastCheckedAt
    ? `last checked on ${formatDate(summary.lastCheckedAt)}`
    : "with no last-checked date published yet";
  const changedText = summary.lastChangedAt
    ? ` and last changed on ${formatDate(summary.lastChangedAt)}`
    : "";
  const reviewText = formatReviewStateForRecord(summary.reviewState);
  const confidenceText =
    summary.confidence !== undefined
      ? ` The entity-level confidence is ${Math.round(summary.confidence * 100)}%.`
      : "";
  const candidateText = candidateClaimCount
    ? ` ${candidateClaimCount} claim${candidateClaimCount === 1 ? "" : "s"} still require review and should not be treated as final policy conclusions.`
    : "";

  return `As of this public record, University AI Policy Tracker lists ${displayName} as ${reviewText} AI policy record ${checkedText}${changedText}. The record contains ${totalClaimCount} source-backed claim${totalClaimCount === 1 ? "" : "s"}, including ${reviewedClaimCount} reviewed claim${reviewedClaimCount === 1 ? "" : "s"}, from ${officialSourceCount} official source attribution${officialSourceCount === 1 ? "" : "s"}. Original-language evidence snippets and source URLs remain canonical, with public JSON available at ${publicJsonUrl}.${confidenceText}${candidateText} This tracker is not legal advice, not academic integrity advice, and not an official university statement unless the linked source is the university's own official page.`;
}

function getSourceLanguages(
  claims: PublicUniversityClaim[]
): string[] {
  const languages = new Set<string>();

  for (const claim of claims) {
    for (const evidence of claim.evidence) {
      if (evidence.sourceLanguage) languages.add(evidence.sourceLanguage);
    }
  }

  return Array.from(languages).sort((left, right) => left.localeCompare(right));
}

function formatClaimCoverage(
  reviewedClaimCount: number,
  candidateClaimCount: number
): string {
  if (!candidateClaimCount) {
    return `${reviewedClaimCount} reviewed`;
  }

  return `${reviewedClaimCount} reviewed, ${candidateClaimCount} needs review`;
}

function formatReviewState(value: string): string {
  return value.replaceAll("_", " ");
}

function formatReviewStateForRecord(value: string): string {
  const phrase = value.replaceAll("_", "-");
  const article = /^[aeiou]/i.test(phrase) ? "an" : "a";

  return `${article} ${phrase}`;
}
