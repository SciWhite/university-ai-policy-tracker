import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCatalogUniversities,
  getCatalogUniversityBySlug,
  getPublicJsonUrl,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { ClaimEvidenceCard } from "@/components/claim-evidence-card";
import { CitationCopyActions } from "@/components/citation-copy-actions";
import { DEFAULT_LOCALE } from "@/lib/i18n";

interface UniversityPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const universities = await getCatalogUniversities();

  return universities.map((university) => ({
    slug: university.slug
  }));
}

export async function generateMetadata({ params }: UniversityPageProps) {
  const { slug } = await params;
  const university = await getCatalogUniversityBySlug(slug);

  return {
    title: university
      ? `${university.name} | University AI Policy Tracker`
      : "University not found"
  };
}

export default async function UniversityPage({ params }: UniversityPageProps) {
  const { slug } = await params;
  const university = await getCatalogUniversityBySlug(slug);
  const publicSummary = await getPublicUniversitySummaryBySlug(slug);

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

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">
          {university.region}, {university.country}
        </p>
        <h1>{university.name}</h1>
        <p className="lead">{university.summary}</p>
        <div className="policy-meta hero-meta">
          {publicSummary.lastCheckedAt ? (
            <span className="pill">
              Last checked {formatDate(publicSummary.lastCheckedAt)}
            </span>
          ) : null}
          {publicSummary.lastChangedAt ? (
            <span className="pill">
              Last changed {formatDate(publicSummary.lastChangedAt)}
            </span>
          ) : null}
          <span className="pill">Review: {publicSummary.reviewState}</span>
          {publicSummary.confidence !== undefined ? (
            <span className="pill">
              Confidence {Math.round(publicSummary.confidence * 100)}%
            </span>
          ) : null}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Citation-ready summary</h2>
          <p>{publicSummary.schemaVersion} public contract</p>
        </div>
        <article className="policy-card">
          <p>{publicSummary.summary}</p>
          <div className="tag-row">
            <span className="pill">Reviewed claims: {reviewedClaims.length}</span>
            <span className="pill pill-muted">
              Candidate claims: {candidateClaims.length}
            </span>
          </div>
          <p className="muted">
            Candidate claims are source-backed records pending review. They are
            not final policy conclusions and are not legal or academic integrity
            advice.
          </p>
        </article>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Citation record</h2>
          <p>{publicSummary.license} tracker metadata</p>
        </div>
        <article className="policy-card">
          <h3>Suggested citation</h3>
          <p>{publicSummary.suggestedCitation}</p>
          <CitationCopyActions
            canonicalUrl={publicSummary.canonicalUrl}
            citationText={publicSummary.suggestedCitation}
            publicJsonUrl={publicJsonUrl}
          />
          <ul className="source-list">
            <li>
              <a href={publicSummary.canonicalUrl}>Canonical page</a>
            </li>
            <li>
              <a href={publicJsonUrl}>Public JSON</a>
            </li>
          </ul>
          <p className="muted">{publicSummary.sourceRightsPolicy}</p>
          <ul className="compact-list">
            {publicSummary.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Official sources</h2>
          <p>{publicSummary.officialSources.length} source attribution</p>
        </div>
        <div className="card-grid">
          {publicSummary.officialSources.map((source) => (
            <article
              className="policy-card"
              key={`${source.sourceUrl}:${source.snapshotHash}`}
            >
              <div>
                <h3>{source.citationTitle}</h3>
                <p>{source.publisher ?? "Official university source"}</p>
              </div>
              <ul className="source-list">
                <li>
                  <a href={source.sourceUrl}>{source.sourceUrl}</a>
                </li>
                <li>Snapshot hash: {source.snapshotHash}</li>
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Reviewed claims</h2>
          <p>{reviewedClaims.length} reviewed public claim</p>
        </div>
        {reviewedClaims.length ? (
          <div className="card-grid">
            {reviewedClaims.map((claim) => (
              <ClaimEvidenceCard
                claim={claim}
                key={claim.id ?? claim.claimText}
                locale={DEFAULT_LOCALE}
              />
            ))}
          </div>
        ) : (
          <p className="notice-card">
            No reviewed claims are published for this record yet. Candidate claims
            remain visible below for source-review workflow transparency.
          </p>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Candidate claims</h2>
          <p>{candidateClaims.length} machine or needs-review claim</p>
        </div>
        <p className="notice-card">
          Candidate claims are not final policy conclusions. They preserve source
          URL, source snapshot hash, evidence, confidence, and review state so the
          record can be audited before review.
        </p>
        {candidateClaims.length ? (
          <div className="card-grid">
            {candidateClaims.map((claim) => (
              <ClaimEvidenceCard
                claim={claim}
                key={claim.id ?? claim.claimText}
                locale={DEFAULT_LOCALE}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="section">
        <Link href="/universities">Back to universities</Link>
      </section>
    </main>
  );
}

function isReviewedClaim(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
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
