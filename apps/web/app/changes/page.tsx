import Link from "next/link";
import { NO_ADVICE_BOUNDARY, PUBLIC_API_VERSION } from "@uapt/shared";
import {
  getCatalogUniversities,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import type { PublicEntitySummary } from "@uapt/shared";

const title = "Recent Changes | University AI Policy Tracker";
const description =
  "Recent source checks and policy-change records with last checked dates, last changed dates, review states, and versioned public JSON links.";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/changes");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function ChangesPage() {
  const universities = await getCatalogUniversities();
  const summaries = (
    await Promise.all(
      universities.map((university) =>
        getPublicUniversitySummaryBySlug(university.slug)
      )
    )
  )
    .filter((summary): summary is PublicEntitySummary => Boolean(summary))
    .sort(compareSummaryFreshness);
  const recentChangesUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`
  );
  const changedCount = summaries.filter((summary) => summary.lastChangedAt).length;
  const checkedCount = summaries.filter((summary) => summary.lastCheckedAt).length;

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Changes</p>
        <h1>Recent source checks and policy records</h1>
        <p className="lead">
          This page shows the public freshness surface for tracked university
          records. Candidate data remains labeled by review state and is not
          presented as a final policy conclusion.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Recent changes summary">
        <div>
          <span>{summaries.length}</span>
          <p>public university records</p>
        </div>
        <div>
          <span>{checkedCount}</span>
          <p>records with last checked dates</p>
        </div>
        <div>
          <span>{changedCount}</span>
          <p>records with last changed dates</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Public changes feed</h2>
          <p>Versioned JSON</p>
        </div>
        <article className="policy-card">
          <h3>Recent changes JSON</h3>
          <p>
            <a href={recentChangesUrl}>
              /api/public/{PUBLIC_API_VERSION}/recent-changes.json
            </a>
          </p>
          <p className="muted">
            Feed entries include canonical URL, last checked date, last changed
            date, review state, claim count, and source-backed claims when
            available.
          </p>
        </article>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Recent changed institutions</h2>
          <p>{summaries.length} early-stage record</p>
        </div>
        {summaries.length ? (
          <div className="card-grid">
            {summaries.map((summary) => {
              const publicJsonUrl =
                summary.apiUrl ??
                getAbsoluteSiteUrl(
                  `/api/public/${PUBLIC_API_VERSION}/universities/${summary.entity.slug}.json`
                );

              return (
                <article className="policy-card" key={summary.entity.slug}>
                  <div>
                    <h3>{summary.entity.name}</h3>
                    <p>{getChangeSummary(summary)}</p>
                  </div>
                  <div className="tag-row">
                    <span className="review-pill" data-review-state={summary.reviewState}>
                      Review: {formatReviewState(summary.reviewState)}
                    </span>
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
                  <ul className="source-list">
                    <li>
                      <Link href={`/universities/${summary.entity.slug}`}>
                        University page
                      </Link>
                    </li>
                    <li>
                      <a href={publicJsonUrl}>Public JSON</a>
                    </li>
                  </ul>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="notice-card">
            No public change records are available yet. The page remains available
            so readers and agents can cite the feed location before the reviewed
            change-log product expands.
          </p>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>How to read this page</h2>
          <p>Freshness signals, not advice</p>
        </div>
        <ul className="compact-list">
          <li>Last checked records when a source was most recently inspected.</li>
          <li>Last changed records when a tracked source or claim last changed.</li>
          <li>Review state describes workflow status; it is separate from confidence.</li>
          <li>Original-language evidence remains canonical inside claim evidence.</li>
          <li>{NO_ADVICE_BOUNDARY}</li>
        </ul>
      </section>
    </main>
  );
}

function compareSummaryFreshness(
  left: PublicEntitySummary,
  right: PublicEntitySummary
): number {
  return getFreshnessTime(right) - getFreshnessTime(left);
}

function getFreshnessTime(summary: PublicEntitySummary): number {
  const value = summary.lastChangedAt ?? summary.lastCheckedAt;
  return value ? new Date(value).getTime() : 0;
}

function getChangeSummary(summary: PublicEntitySummary): string {
  const claimCount = summary.claims.length;
  const sourceCount = summary.officialSources.length;

  if (summary.lastChangedAt) {
    return `${summary.entity.name} has ${claimCount} source-backed claim record and ${sourceCount} official source attribution. The latest tracked change date is ${formatDate(summary.lastChangedAt)}.`;
  }

  return `${summary.entity.name} has ${claimCount} source-backed claim record and ${sourceCount} official source attribution. No changed date has been published yet.`;
}

function formatReviewState(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
