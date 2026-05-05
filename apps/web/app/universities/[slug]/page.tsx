import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCatalogUniversities,
  getCatalogUniversityBySlug,
  getPublicJsonUrl,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";

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
          <h2>Citation record</h2>
          <p>{publicSummary.license} tracker metadata</p>
        </div>
        <article className="policy-card">
          <h3>Suggested citation</h3>
          <p>{publicSummary.suggestedCitation}</p>
          <div className="source-list">
            <a href={jsonUrl}>Public JSON</a>
          </div>
          <p className="muted">{publicSummary.sourcePolicy}</p>
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
          <h2>Evidence-backed claims</h2>
          <p>{publicSummary.claims.length} public claim</p>
        </div>
        <div className="card-grid">
          {publicSummary.claims.map((claim) => (
            <article className="policy-card" key={claim.id ?? claim.claimText}>
              <div>
                <h3>{claim.claimText}</h3>
                <p>{claim.claimType}</p>
              </div>
              <div className="tag-row">
                <span className="pill">Review: {claim.reviewState}</span>
                <span className="pill">
                  Confidence {Math.round(claim.confidence * 100)}%
                </span>
              </div>
              {claim.evidence.map((evidence) => (
                <blockquote
                  className="evidence-snippet"
                  key={`${claim.claimText}:${evidence.sourceSnapshotHash}`}
                >
                  {evidence.evidenceSnippet}
                  <footer>
                    <a href={evidence.sourceUrl}>{evidence.attribution.citationTitle}</a>
                  </footer>
                </blockquote>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <Link href="/universities">Back to universities</Link>
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
