import Link from "next/link";
import {
  getCatalogUniversities,
  getPublicUniversitySummaryBySlug,
  getRecentChangesJsonUrl
} from "@/lib/catalog";
import type { PublicEntitySummary } from "@uapt/shared";

export const metadata = {
  title: "Recent Changes | University AI Policy Tracker",
  description:
    "Recent source checks and policy-change records with review states, source links, and versioned public JSON."
};

export default async function ChangesPage() {
  const universities = await getCatalogUniversities();
  const summaries = (
    await Promise.all(
      universities.map((university) =>
        getPublicUniversitySummaryBySlug(university.slug)
      )
    )
  ).filter((summary): summary is PublicEntitySummary => Boolean(summary));

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Changes</p>
        <h1>Recent source checks and policy records</h1>
        <p className="lead">
          This page exposes change-oriented records without presenting candidate
          extraction as final policy conclusions. Source-backed diffs will be
          added after the change-log product phase.
        </p>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Public changes feed</h2>
          <p>Versioned JSON</p>
        </div>
        <article className="policy-card">
          <h3>Recent changes JSON</h3>
          <p>
            <a href={getRecentChangesJsonUrl()}>
              {getRecentChangesJsonUrl()}
            </a>
          </p>
          <p className="muted">
            Entries include review state and source-backed claims when available.
          </p>
        </article>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Current records</h2>
          <p>{summaries.length} university record</p>
        </div>
        <div className="card-grid">
          {summaries.map((summary) => (
            <article className="policy-card" key={summary.entity.slug}>
              <div>
                <h3>{summary.entity.name}</h3>
                <p>{summary.citationTitle}</p>
              </div>
              <div className="tag-row">
                <span className="pill">Review: {summary.reviewState}</span>
                {summary.lastCheckedAt ? (
                  <span className="pill pill-muted">
                    Checked {formatDate(summary.lastCheckedAt)}
                  </span>
                ) : null}
                {summary.lastChangedAt ? (
                  <span className="pill pill-muted">
                    Changed {formatDate(summary.lastChangedAt)}
                  </span>
                ) : null}
              </div>
              <Link href={`/universities/${summary.entity.slug}`}>
                View university record
              </Link>
            </article>
          ))}
        </div>
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
