import Link from "next/link";
import { NO_ADVICE_BOUNDARY, PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import { getChangeRecords, type ChangeRecord } from "@/lib/change-records";
import { getLatestReleaseDiff } from "@/lib/release-diffs";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Recent Changes | University AI Policy Tracker";
const description =
  "Recent tracker release diffs with newly extracted claims, comparable policy-text changes, source snapshot changes, review states, and versioned public JSON links.";

export const dynamic = "force-static";
export const revalidate = false;

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
        <p className="kicker">Changes</p>
        <h1>Tracker release changes and source freshness</h1>
        <p className="lead">
          Release-to-release tracker diffs for public university AI policy
          records. Newly extracted claims and source snapshot changes are
          separated from comparable policy-text changes.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Recent changes summary">
        <div>
          <span>{changedRecords.length}</span>
          <p>records with tracker diff rows</p>
        </div>
        <div>
          <span>{releaseDiff.changeCounts.policyTextChanged}</span>
          <p>comparable policy-text changes</p>
        </div>
        <div>
          <span>{releaseDiff.changeCounts.newlyExtractedClaims}</span>
          <p>newly extracted claims</p>
        </div>
        <div>
          <span>{releaseDiff.changeCounts.sourceSnapshotChanged}</span>
          <p>source snapshot changes</p>
        </div>
      </section>

      <section className="answer-strip" aria-label="Change feed answer blocks">
        <article className="answer-card">
          <h2>What changed means</h2>
          <p>
            A release diff compares the current promoted claim/evidence snapshot
            with the previous public release. A newly extracted claim is not
            necessarily newly published by the university.
          </p>
        </article>
        <article className="answer-card">
          <h2>What source hash means</h2>
          <p>
            A changed snapshot hash means the same source URL produced different
            tracker content. It may reflect policy text, page layout, navigation,
            or metadata.
          </p>
        </article>
        <article className="answer-card">
          <h2>How agents should use it</h2>
          <p>
            Use semantic fields such as policyTextChanged,
            newlyExtractedClaims, and sourceSnapshotChanged before describing a
            record as a policy update.
          </p>
        </article>
      </section>

      <ReferenceBox
        className="compact-reference-box"
        description="Versioned feed for records and agents."
        title="Public changes artifact"
      >
        <ApiEndpointRow
          description="Recent changed or checked records with canonical URLs, review states, claim counts, and claim evidence where available."
          label="Recent changes JSON"
          path={recentChangesPath}
          url={recentChangesUrl}
        />
        <ApiEndpointRow
          description="Latest release-to-release tracker diff with semantic categories for policy text, extracted claims, evidence, and source snapshots."
          label="Latest release diff JSON"
          path={latestDiffPath}
          url={latestDiffUrl}
        />
      </ReferenceBox>

      <section className="section">
        <div className="section-heading">
          <h2>Change timeline</h2>
          <p>
            Latest release {releaseDiff.currentReleaseId}
            {releaseDiff.previousReleaseId
              ? ` compared with ${releaseDiff.previousReleaseId}`
              : " is the initial tracked release"}
            . {totalSources} source attributions across {records.length} records.
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
                        University page
                      </Link>
                      <a href={record.publicJsonUrl}>Public JSON</a>
                    </>
                  }
                  className="timeline-list__row"
                  key={record.slug}
                  metadata={
                    <>
                      <StateLabel reviewState={record.reviewState} />
                      <MetaLabel label="Diff">
                        policy {record.policyTextChanged} / extracted{" "}
                        {record.newlyExtractedClaims} / source{" "}
                        {record.sourceSnapshotChanged}
                      </MetaLabel>
                      <MetaLabel label="Claims">{record.claimCount}</MetaLabel>
                      <MetaLabel label="Sources">{record.sourceCount}</MetaLabel>
                      {record.lastCheckedAt ? (
                        <MetaLabel label="Checked">
                          {formatDate(record.lastCheckedAt)}
                        </MetaLabel>
                      ) : null}
                      {record.lastChangedAt ? (
                        <MetaLabel label="Changed">
                          {formatDate(record.lastChangedAt)}
                        </MetaLabel>
                      ) : null}
                    </>
                  }
                >
                  <p className="timeline-list__date">
                    {primaryDate ? formatDate(primaryDate) : "No public date yet"}
                  </p>
                  <h2>{record.name}</h2>
                  <p>{getChangeSummary(record)}</p>
                </DataListRow>
              );
            })}
          </DataList>
        ) : (
          <p className="notice-card">
            No claim/evidence changes are recorded for the latest public
            release. The versioned feed URL remains available for readers and
            agents.
          </p>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Boundary</h2>
          <p>Freshness signals only</p>
        </div>
        <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
      </section>
    </main>
  );
}

function getChangeSummary(record: ChangeRecord): string {
  const changed = record.lastChangedAt
    ? ` The latest tracked changed date is ${formatDate(record.lastChangedAt)}.`
    : " No changed date has been published yet.";
  const diff = record.diffRows.length
    ? ` Latest tracker diff: ${record.policyTextChanged} comparable policy-text changes, ${record.newlyExtractedClaims} newly extracted claims, ${record.sourceSnapshotChanged} source snapshot changes.`
    : " No claim/evidence changes are recorded for the latest release.";

  return `${record.name} has ${record.claimCount} ${pluralize("source-backed claim record", record.claimCount)} and ${record.sourceCount} ${pluralize("official source attribution", record.sourceCount)}.${changed}${diff}`;
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
