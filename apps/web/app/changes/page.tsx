import Link from "next/link";
import { NO_ADVICE_BOUNDARY, PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import { getChangeRecords, type ChangeRecord } from "@/lib/change-records";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";
import { getPageCopy } from "@/lib/page-copy";
import { getLatestReleaseDiff } from "@/lib/release-diffs";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface ChangesPageProps {
  params?: Promise<{
    locale?: string;
  }>;
}

export const dynamic = "force-static";
export const revalidate = false;

export async function generateMetadata({
  params
}: ChangesPageProps = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).changes;
  const alternates = getLocalizedAlternates("/changes", locale);
  const canonical = String(alternates.canonical);

  return {
    title: copy.title,
    description: copy.description,
    alternates,
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function ChangesPage({ params }: ChangesPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).changes;
  const records = await getChangeRecords();
  const releaseDiff = await getLatestReleaseDiff();
  const recentChangesPath = `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`;
  const recentChangesUrl = getAbsoluteSiteUrl(recentChangesPath);
  const latestDiffPath = `/api/public/${PUBLIC_API_VERSION}/changes/latest.json`;
  const latestDiffUrl = getAbsoluteSiteUrl(latestDiffPath);
  const changedRecords = records.filter((record) => record.diffRows.length);
  const totalSources = records.reduce(
    (total, record) => total + record.sourceCount,
    0
  );

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">{copy.kicker}</p>
        <h1>{copy.heading}</h1>
        <p className="lead">{copy.lead}</p>
      </section>

      <section className="metrics-grid" aria-label={copy.summaryLabel}>
        <div>
          <span>{changedRecords.length}</span>
          <p>{copy.recordsWithDiffRows}</p>
        </div>
        <div>
          <span>{releaseDiff.changeCounts.policyTextChanged}</span>
          <p>{copy.policyTextChanges}</p>
        </div>
        <div>
          <span>{releaseDiff.changeCounts.newlyExtractedClaims}</span>
          <p>{copy.newlyExtractedClaims}</p>
        </div>
        <div>
          <span>{releaseDiff.changeCounts.sourceTextChanged}</span>
          <p>{copy.privateSourceTextChanges}</p>
        </div>
      </section>

      <section className="answer-strip" aria-label={copy.answersLabel}>
        {copy.answers.map((answer) => (
          <article className="answer-card" key={answer.title}>
            <h2>{answer.title}</h2>
            <p>{answer.text}</p>
          </article>
        ))}
      </section>

      <ReferenceBox
        className="compact-reference-box"
        description={copy.artifactDescription}
        title={copy.artifactTitle}
      >
        <ApiEndpointRow
          description={copy.recentChangesJsonDescription}
          label={copy.recentChangesJson}
          path={recentChangesPath}
          url={recentChangesUrl}
        />
        <ApiEndpointRow
          description={copy.latestDiffJsonDescription}
          label={copy.latestDiffJson}
          path={latestDiffPath}
          url={latestDiffUrl}
        />
      </ReferenceBox>

      <section className="section">
        <div className="section-heading">
          <h2>{copy.timelineTitle}</h2>
          <p>
            {copy.timelineLead(
              releaseDiff.currentReleaseId,
              releaseDiff.previousReleaseId,
              totalSources,
              records.length
            )}
          </p>
        </div>
        {changedRecords.length ? (
          <DataList className="timeline-list">
            {changedRecords.map((record) => {
              const primaryDate = record.lastChangedAt ?? record.lastCheckedAt;

              return (
                <DataListRow
                  actions={
                    <>
                      <Link href={record.changeUrl}>Change detail</Link>
                      <Link href={record.universityUrl}>
                        {copy.universityPage}
                      </Link>
                      <a href={record.publicJsonUrl}>{copy.publicJson}</a>
                    </>
                  }
                  className="timeline-list__row"
                  key={record.slug}
                  metadata={
                    <>
                      <StateLabel reviewState={record.reviewState} />
                      <MetaLabel label={copy.diff}>
                        policy {record.policyTextChanged} / extracted{" "}
                        {record.newlyExtractedClaims} / source{" "}
                        {record.sourceSnapshotChanged} / text{" "}
                        {record.sourceTextChanged}
                      </MetaLabel>
                      <MetaLabel label={copy.claims}>{record.claimCount}</MetaLabel>
                      <MetaLabel label={copy.sources}>{record.sourceCount}</MetaLabel>
                      {record.lastCheckedAt ? (
                        <MetaLabel label={copy.checked}>
                          {formatDate(record.lastCheckedAt)}
                        </MetaLabel>
                      ) : null}
                      {record.lastChangedAt ? (
                        <MetaLabel label={copy.changed}>
                          {formatDate(record.lastChangedAt)}
                        </MetaLabel>
                      ) : null}
                    </>
                  }
                >
                  <p className="timeline-list__date">
                    {primaryDate ? formatDate(primaryDate) : copy.noPublicDate}
                  </p>
                  <h2>{record.name}</h2>
                  <p>{getChangeSummary(record, copy)}</p>
                </DataListRow>
              );
            })}
          </DataList>
        ) : (
          <p className="notice-card">
            {copy.noChanges}
          </p>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>{copy.boundaryTitle}</h2>
          <p>{copy.boundaryLead}</p>
        </div>
        <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
      </section>
    </main>
  );
}

function getChangeSummary(
  record: ChangeRecord,
  copy: ReturnType<typeof getPageCopy>["changes"]
): string {
  return copy.summary(
    record.name,
    record.claimCount,
    record.sourceCount,
    record.lastChangedAt ? formatDate(record.lastChangedAt) : undefined,
    record.diffRows.length,
    record.policyTextChanged,
    record.newlyExtractedClaims,
    record.sourceSnapshotChanged,
    record.sourceTextChanged
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
