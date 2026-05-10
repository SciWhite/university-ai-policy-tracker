import Link from "next/link";
import { NO_ADVICE_BOUNDARY, PUBLIC_API_VERSION } from "@uapt/shared";
import type { PublicEntitySummary } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  getCatalogUniversities,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

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
  const recentChangesPath = `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`;
  const recentChangesUrl = getAbsoluteSiteUrl(recentChangesPath);
  const changedCount = summaries.filter((summary) => summary.lastChangedAt).length;
  const checkedCount = summaries.filter((summary) => summary.lastCheckedAt).length;
  const totalClaims = summaries.reduce(
    (total, summary) => total + summary.claims.length,
    0
  );
  const totalSources = summaries.reduce(
    (total, summary) => total + summary.officialSources.length,
    0
  );

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Changes</p>
        <h1>Source checks and policy record freshness</h1>
        <p className="lead">
          This timeline shows source-check and source-change records for public
          university entries. It is a freshness surface for evidence records, not
          legal advice, academic integrity advice, or a substitute for official
          university policy pages.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Recent changes summary">
        <div>
          <span>{summaries.length}</span>
          <p>public university records</p>
        </div>
        <div>
          <span>{checkedCount}</span>
          <p>records with checked dates</p>
        </div>
        <div>
          <span>{changedCount}</span>
          <p>records with changed dates</p>
        </div>
        <div>
          <span>{totalClaims}</span>
          <p>source-backed claims</p>
        </div>
      </section>

      <ReferenceBox
        description="Versioned JSON feed for machines, citations, and audits."
        title="Public changes artifact"
      >
        <ApiEndpointRow
          description="Recent changed or checked records with canonical URLs, review states, claim counts, and claim evidence where available."
          label="Recent changes JSON"
          path={recentChangesPath}
          url={recentChangesUrl}
        />
      </ReferenceBox>

      <section className="section">
        <div className="section-heading">
          <h2>Change timeline</h2>
          <p>
            {totalSources} official source attributions across {summaries.length}{" "}
            public records.
          </p>
        </div>
        {summaries.length ? (
          <DataList className="timeline-list">
            {summaries.map((summary) => {
              const publicJsonUrl =
                summary.apiUrl ??
                getAbsoluteSiteUrl(
                  `/api/public/${PUBLIC_API_VERSION}/universities/${summary.entity.slug}.json`
                );
              const primaryDate = summary.lastChangedAt ?? summary.lastCheckedAt;

              return (
                <DataListRow
                  actions={
                    <>
                      <Link href={`/universities/${summary.entity.slug}`}>
                        University page
                      </Link>
                      <a href={publicJsonUrl}>Public JSON</a>
                    </>
                  }
                  className="timeline-list__row"
                  key={summary.entity.slug}
                  metadata={
                    <>
                      <StateLabel reviewState={summary.reviewState} />
                      <MetaLabel label="Claims">{summary.claims.length}</MetaLabel>
                      <MetaLabel label="Sources">
                        {summary.officialSources.length}
                      </MetaLabel>
                      {summary.lastCheckedAt ? (
                        <MetaLabel label="Checked">
                          {formatDate(summary.lastCheckedAt)}
                        </MetaLabel>
                      ) : null}
                      {summary.lastChangedAt ? (
                        <MetaLabel label="Changed">
                          {formatDate(summary.lastChangedAt)}
                        </MetaLabel>
                      ) : null}
                    </>
                  }
                >
                  <p className="timeline-list__date">
                    {primaryDate ? formatDate(primaryDate) : "No public date yet"}
                  </p>
                  <h2>{summary.entity.name}</h2>
                  <p>{getChangeSummary(summary)}</p>
                </DataListRow>
              );
            })}
          </DataList>
        ) : (
          <p className="notice-card">
            No public change records are available yet. The versioned feed URL
            remains available for readers and agents.
          </p>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>How to read this timeline</h2>
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
  const changed = summary.lastChangedAt
    ? ` The latest tracked changed date is ${formatDate(summary.lastChangedAt)}.`
    : " No changed date has been published yet.";

  return `${summary.entity.name} has ${claimCount} ${pluralize("source-backed claim record", claimCount)} and ${sourceCount} ${pluralize("official source attribution", sourceCount)}.${changed}`;
}

function pluralize(label: string, count: number): string {
  return count === 1 ? label : `${label}s`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
