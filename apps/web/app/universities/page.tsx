import Link from "next/link";
import type { CatalogUniversity, PublicEntitySummary } from "@uapt/shared";
import {
  getCatalogUniversities,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";

export const metadata = {
  title: "Universities | University AI Policy Tracker"
};

interface UniversityIndexRecord {
  catalog: CatalogUniversity;
  summary?: PublicEntitySummary;
}

export default async function UniversitiesPage() {
  const catalogUniversities = await getCatalogUniversities();
  const records = (
    await Promise.all(
      catalogUniversities.map(async (catalog) => ({
        catalog,
        summary: await getPublicUniversitySummaryBySlug(catalog.slug)
      }))
    )
  ).sort(compareUniversityRecords);
  const totalClaims = records.reduce(
    (total, record) => total + (record.summary?.claims.length ?? 0),
    0
  );
  const reviewedClaims = records.reduce(
    (total, record) =>
      total +
      (record.summary?.claims.filter((claim) =>
        isReviewedClaim(claim.reviewState)
      ).length ?? 0),
    0
  );
  const candidateClaims = totalClaims - reviewedClaims;
  const sourceCount = records.reduce(
    (total, record) =>
      total +
      (record.summary?.officialSources.length ??
        record.catalog.sourceCount ??
        record.catalog.sources.length),
    0
  );

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Evidence records</p>
        <h1>Universities</h1>
        <p className="lead">
          Browse crawlable university AI policy records with source-backed claims,
          review state, confidence, official source counts, and versioned public
          JSON links.
        </p>
      </section>

      <section className="metrics-grid" aria-label="University coverage">
        <div>
          <span>{records.length}</span>
          <p>university records</p>
        </div>
        <div>
          <span>{totalClaims}</span>
          <p>source-backed claims</p>
        </div>
        <div>
          <span>{sourceCount}</span>
          <p>official source attributions</p>
        </div>
        <div>
          <span>{reviewedClaims}</span>
          <p>reviewed claims</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Repository-style index</h2>
          <p>
            Sorted by most recent checked or changed date. Candidate claims remain
            labeled and are not final policy conclusions.
          </p>
        </div>
        <DataList>
          {records.map(({ catalog, summary }) => {
            const lastCheckedAt =
              summary?.lastCheckedAt ?? latestSourceDate(catalog, "lastCheckedAt");
            const lastChangedAt =
              summary?.lastChangedAt ?? latestSourceDate(catalog, "lastChangedAt");
            const publicJsonUrl = summary?.apiUrl;
            const recordPath = `/universities/${catalog.slug}`;

            return (
              <DataListRow
                actions={
                  <>
                    <Link href={recordPath}>Open record</Link>
                    {publicJsonUrl ? (
                      <a href={publicJsonUrl}>Public JSON</a>
                    ) : null}
                  </>
                }
                key={catalog.slug}
                metadata={
                  <>
                    {summary ? (
                      <StateLabel reviewState={summary.reviewState} />
                    ) : null}
                    {summary?.confidence !== undefined ? (
                      <MetaLabel label="Confidence">
                        {Math.round(summary.confidence * 100)}%
                      </MetaLabel>
                    ) : null}
                    <MetaLabel label="Claims">
                      {summary?.claims.length ?? 0}
                    </MetaLabel>
                    <MetaLabel label="Sources">
                      {summary?.officialSources.length ??
                        catalog.sourceCount ??
                        catalog.sources.length}
                    </MetaLabel>
                    {lastCheckedAt ? (
                      <MetaLabel label="Checked">
                        {formatDate(lastCheckedAt)}
                      </MetaLabel>
                    ) : null}
                    {lastChangedAt ? (
                      <MetaLabel label="Changed">
                        {formatDate(lastChangedAt)}
                      </MetaLabel>
                    ) : null}
                  </>
                }
              >
                <h2>
                  <Link href={recordPath}>{catalog.name}</Link>
                </h2>
                <p>
                  {catalog.region}, {catalog.country}
                </p>
                <p>{summary?.summary ?? catalog.summary}</p>
              </DataListRow>
            );
          })}
        </DataList>
        {candidateClaims ? (
          <p className="notice-card">
            {candidateClaims} candidate or needs-review claim records remain
            visible for auditability. Review state is separate from confidence.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function compareUniversityRecords(
  left: UniversityIndexRecord,
  right: UniversityIndexRecord
): number {
  const freshnessDifference = getFreshnessTime(right) - getFreshnessTime(left);
  if (freshnessDifference) return freshnessDifference;

  return left.catalog.name.localeCompare(right.catalog.name);
}

function getFreshnessTime(record: UniversityIndexRecord): number {
  const value =
    record.summary?.lastChangedAt ??
    record.summary?.lastCheckedAt ??
    latestSourceDate(record.catalog, "lastChangedAt") ??
    latestSourceDate(record.catalog, "lastCheckedAt");

  return value ? new Date(value).getTime() : 0;
}

function latestSourceDate(
  university: CatalogUniversity,
  key: "lastCheckedAt" | "lastChangedAt"
): string | undefined {
  return university.sources
    .map((source) => source[key])
    .filter((value): value is string => Boolean(value))
    .sort(
      (left, right) => new Date(right).getTime() - new Date(left).getTime()
    )[0];
}

function isReviewedClaim(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
