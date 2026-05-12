import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCatalogUniversities,
  getCatalogUniversityBySlug,
  getPublicJsonUrl,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { AnalysisStatusLabel } from "@/components/analysis-status-label";
import { ClaimEvidenceCard } from "@/components/claim-evidence-card";
import { EntityHeader } from "@/components/entity-header";
import { EntitySidebar } from "@/components/entity-sidebar";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { ReferenceTabs } from "@/components/reference-tabs";
import { StateLabel } from "@/components/state-label";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getPolicyAnalysisProfileBySlug } from "@/lib/policy-analysis";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface UniversityPageProps {
  params: Promise<{
    slug: string;
  }>;
}

const recordTabs = [
  { label: "Overview", href: "#overview" },
  { label: "Policy profile", href: "#policy-profile" },
  { label: "Claims", href: "#claims" },
  { label: "Sources", href: "#sources" },
  { label: "Changes", href: "#changes" },
  { label: "JSON", href: "#json" },
  { label: "Citation", href: "#citation" }
] as const;

export async function generateStaticParams() {
  const universities = await getCatalogUniversities();

  return universities.map((university) => ({
    slug: university.slug
  }));
}

export async function generateMetadata({ params }: UniversityPageProps) {
  const { slug } = await params;
  const university = await getCatalogUniversityBySlug(slug);
  const canonical = getAbsoluteSiteUrl(`/universities/${slug}`);
  const title = university
    ? `${university.name} | University AI Policy Tracker`
    : "University not found";
  const description = university
    ? `${university.name} AI policy record with evidence-backed claims, official sources, review state, confidence, and public JSON.`
    : "University AI Policy Tracker record not found.";

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article"
    }
  };
}

export default async function UniversityPage({ params }: UniversityPageProps) {
  const { slug } = await params;
  const university = await getCatalogUniversityBySlug(slug);
  const publicSummary = await getPublicUniversitySummaryBySlug(slug);
  const policyAnalysisProfile = await getPolicyAnalysisProfileBySlug(slug);

  if (!university || !publicSummary) {
    notFound();
  }
  const jsonUrl = getPublicJsonUrl(slug);
  const publicJsonUrl =
    publicSummary.apiUrl ?? resolveUrl(jsonUrl, publicSummary.canonicalUrl);
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

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: publicSummary.citationTitle,
          description: publicSummary.summary,
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
            description: publicSummary.summary,
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
            <a className="site-action" href={publicJsonUrl}>
              Public JSON
            </a>
            <Link className="site-action" href={`/changes/${slug}`}>
              Change log
            </Link>
            <Link className="site-action" href="/citation">
              Citation rules
            </Link>
            <Link className="site-action" href="/datasets">
              Dataset access
            </Link>
            {policyAnalysisProfile ? (
              <a className="site-action" href={policyAnalysisProfile.publicJsonUrl}>
                Analysis JSON
              </a>
            ) : null}
            <Link className="site-action" href="/contribute">
              Submit correction
            </Link>
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
        summary={university.summary}
        title={university.name}
      />

      <ReferenceTabs tabs={recordTabs} />

      <div className="entity-record-layout">
        <div className="entity-record-main">
          <ReferenceBox
            description={`${publicSummary.schemaVersion} public contract`}
            id="overview"
            title="Short answer"
          >
            <p>{publicSummary.summary}</p>
            <div className="tag-row">
              <MetaLabel label="Policy status">{policyStatus}</MetaLabel>
              <StateLabel reviewState={publicSummary.reviewState} />
              <MetaLabel label="Evidence-backed claims">
                {publicSummary.claims.length}
              </MetaLabel>
              <MetaLabel label="Reviewed">{reviewedClaims.length}</MetaLabel>
              <MetaLabel label="Candidate">{candidateClaims.length}</MetaLabel>
              <MetaLabel label="Official sources">
                {publicSummary.officialSources.length}
              </MetaLabel>
            </div>
            <p className="muted">
              This reference record summarizes visible public data only.
              Official sources and original-language evidence remain canonical;
              confidence is separate from review state.
            </p>
            {candidateClaims.length ? (
              <p className="notice-card">
                This record includes candidate or needs-review claims. Candidate
                claims are evidence-backed workflow records, not final policy
                conclusions.
              </p>
            ) : null}
            <p className="notice-card">
              This page is not legal advice, not academic integrity advice, and
              not an official university statement unless a linked source is the
              university&apos;s own official page.
            </p>
          </ReferenceBox>

          {policyAnalysisProfile ? (
            <ReferenceBox
              description="Deterministic source-backed dimensions derived from this record's public claims."
              id="policy-profile"
              title="Policy profile"
              actions={
                <a className="site-action" href={policyAnalysisProfile.publicJsonUrl}>
                  Analysis JSON
                </a>
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
              <p className="notice-card">
                Policy profile rows are machine-candidate derived metadata. They
                are not final policy conclusions; inspect the linked claim
                evidence before reuse.
              </p>
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
              <p className="muted">
                Coverage score measures breadth of public, source-backed
                coverage only. It is not a policy quality, strictness, legal
                adequacy, safety, or compliance score.
              </p>
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
                    locale={DEFAULT_LOCALE}
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
            <p className="notice-card">
              Candidate claims are not final policy conclusions. They preserve
              source URL, source snapshot hash, evidence, confidence, and review
              state so the record can be audited before review.
            </p>
            {candidateClaims.length ? (
              <div className="claim-list">
                {candidateClaims.map((claim) => (
                  <ClaimEvidenceCard
                    claim={claim}
                    id={claim.id ? `claim-${claim.id}` : undefined}
                    key={claim.id ?? claim.claimText}
                    locale={DEFAULT_LOCALE}
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
                        <a href={source.sourceUrl}>{source.sourceUrl}</a>
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
            description="Source-check timeline and diff-style claim/evidence preview."
            id="changes"
            title="Change log"
          >
            <p>
              View the public change record for this university, including
              source snapshot hashes, claim review states, and a diff-style
              preview of current source-backed evidence.
            </p>
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

          <ReferenceBox
            description="Corrections create review tasks and do not directly change this public record."
            title="Corrections and missing evidence"
          >
            <p>
              If an official source is missing, stale, moved, blocked, or
              incorrectly summarized, submit a source URL, policy change report,
              or institution correction for review. Corrections must preserve
              source URLs, source language, original evidence, review state, and
              audit history.
            </p>
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
