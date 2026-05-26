import Link from "next/link";
import { notFound } from "next/navigation";
import { NO_ADVICE_BOUNDARY } from "@uapt/shared";
import { DiffBlock } from "@/components/diff-block";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  getChangeRecordBySlug,
  getChangeRecords,
  getReleaseChangeRecords,
  type ChangeRecord
} from "@/lib/change-records";
import { getKnownReleaseIds } from "@/lib/release-diffs";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface ChangeDetailPageProps {
  params: Promise<{
    releaseId: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  const [records, releaseIds] = await Promise.all([
    getChangeRecords(),
    getKnownReleaseIds()
  ]);

  return [
    ...records
      .filter((record) => record.diffRows.length)
      .map((record) => ({ releaseId: record.slug })),
    ...releaseIds.map((releaseId) => ({ releaseId }))
  ];
}

export async function generateMetadata({ params }: ChangeDetailPageProps) {
  const { releaseId } = await params;
  const releaseRecords = await getReleaseChangeRecords(releaseId);
  if (releaseRecords) {
    const canonical = getAbsoluteSiteUrl(`/changes/${releaseId}`);
    const changedCount = releaseRecords.filter((record) => record.diffRows.length).length;

    return {
      title: `University AI Policy Tracker Release Diff: ${releaseId}`,
      description: `${changedCount} university tracker records have release diff rows in ${releaseId}.`,
      alternates: { canonical },
      openGraph: {
        title: `University AI Policy Tracker Release Diff: ${releaseId}`,
        description: `${changedCount} university tracker records have release diff rows in ${releaseId}.`,
        url: canonical,
        type: "article"
      }
    };
  }

  const record = await getChangeRecordBySlug(releaseId);
  const canonical = getAbsoluteSiteUrl(`/changes/${releaseId}`);
  const title = record
    ? `${record.name} AI Policy Tracker Release Diff | University AI Policy Tracker`
    : "Change record not found";
  const description = record
    ? `${record.name} tracker release diff with semantic categories for policy text, newly extracted claims, evidence, and source snapshots.`
    : "University AI Policy Tracker change record not found.";

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

export default async function ChangeDetailPage({
  params
}: ChangeDetailPageProps) {
  const { releaseId } = await params;
  const releaseRecords = await getReleaseChangeRecords(releaseId);
  if (releaseRecords) return <ReleaseOverviewPage records={releaseRecords} releaseId={releaseId} />;

  const record = await getChangeRecordBySlug(releaseId);

  if (!record) notFound();

  return (
    <main className="page-shell page-shell--wide">
      <section className="entity-header">
        <div className="entity-header__main">
          <p className="entity-header__eyebrow">Change log</p>
          <h1>{record.name}</h1>
          <p className="entity-header__summary">
            Release-to-release tracker diff with separate policy-text,
            newly-extracted claim, evidence, and source snapshot categories.
          </p>
          <div className="entity-header__metadata">
            <StateLabel reviewState={record.reviewState} />
            {record.lastCheckedAt ? (
              <MetaLabel label="Last checked">
                {formatDate(record.lastCheckedAt)}
              </MetaLabel>
            ) : null}
            {record.lastChangedAt ? (
              <MetaLabel label="Last changed">
                {formatDate(record.lastChangedAt)}
              </MetaLabel>
            ) : null}
            <MetaLabel label="Claims">{record.claimCount}</MetaLabel>
            <MetaLabel label="Sources">{record.sourceCount}</MetaLabel>
            {record.releaseId ? (
              <MetaLabel label="Release">{record.releaseId}</MetaLabel>
            ) : null}
          </div>
        </div>
        <div className="entity-header__actions">
          <Link className="site-action" href={record.universityUrl}>
            University page
          </Link>
          <a className="site-action" href={record.publicJsonUrl}>
            Public JSON
          </a>
        </div>
      </section>

      <div className="entity-record-layout">
        <div className="entity-record-main">
          <ReferenceBox
            description="Current public record freshness and review state."
            title="Change summary"
          >
            <p>{getSummaryText(record)}</p>
            <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
            <p className="notice-card">
              Newly extracted claims are tracker additions and are not
              necessarily newly published by the university. Source snapshot
              changes show hash changes for the same source URL and are not by
              themselves policy changes.
            </p>
          </ReferenceBox>

          <ReferenceBox
            description="Semantic classification for this release diff."
            title="Diff categories"
          >
            <div className="tag-row">
              <MetaLabel label="Policy text">
                {record.policyTextChanged}
              </MetaLabel>
              <MetaLabel label="Newly extracted">
                {record.newlyExtractedClaims}
              </MetaLabel>
              <MetaLabel label="Evidence">{record.evidenceChanged}</MetaLabel>
              <MetaLabel label="Source snapshots">
                {record.sourceSnapshotChanged}
              </MetaLabel>
              <MetaLabel label="Source added">{record.sourceAdded}</MetaLabel>
              <MetaLabel label="Source removed">{record.sourceRemoved}</MetaLabel>
            </div>
          </ReferenceBox>

          <ReferenceBox
            description="Unified tracker diff generated from the previous and current public release snapshots."
            title="Release diff"
          >
            {record.diffLines.length ? (
              <DiffBlock
                description={getDiffDescription(record)}
                lines={record.diffLines}
                title={`${record.name} release diff`}
              />
            ) : (
              <p className="notice-card">
                No tracker claim/evidence/source changes are recorded for this
                university in the latest public release.
              </p>
            )}
          </ReferenceBox>

          <section className="record-section">
            <div className="section-heading">
              <h2>Claim changes</h2>
              <p>
                {record.claimChanges.length}{" "}
                {pluralize("claim record", record.claimChanges.length)}
              </p>
            </div>
            <div className="source-attribution-list">
              {record.claimChanges.map((claim) => (
                <article
                  className="source-attribution-row"
                  key={claim.claimId ?? claim.claimText}
                >
                  <div>
                    <h3>{claim.claimType}</h3>
                    <p>{claim.claimText}</p>
                  </div>
                  <div className="tag-row">
                    <StateLabel reviewState={claim.reviewState} />
                    <MetaLabel label="Confidence">
                      {Math.round(claim.confidence * 100)}%
                    </MetaLabel>
                    <MetaLabel label="Evidence">{claim.evidenceCount}</MetaLabel>
                    {claim.sourceLanguages.length ? (
                      <MetaLabel label="Languages">
                        {claim.sourceLanguages.join(", ")}
                      </MetaLabel>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="record-section">
            <div className="section-heading">
              <h2>Source snapshots</h2>
              <p>
                {record.sourceChanges.length}{" "}
                {pluralize("source attribution", record.sourceChanges.length)}
              </p>
            </div>
            <div className="source-attribution-list">
              {record.sourceChanges.map((source) => (
                <article
                  className="source-attribution-row"
                  key={`${source.sourceUrl}:${source.snapshotHash}`}
                >
                  <div>
                    <h3>{source.citationTitle}</h3>
                    <p className="muted">
                      {source.sourceType ?? "official source"}{" "}
                      {formatSourceFreshness(source)}
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
        </div>

        <aside className="entity-sidebar">
          <ReferenceBox title="Diff record">
            <div className="tag-row">
              <MetaLabel label="Reviewed claims">
                {record.reviewedClaimCount}
              </MetaLabel>
              <MetaLabel label="Candidate claims">
                {record.candidateClaimCount}
              </MetaLabel>
              <MetaLabel label="Policy text">
                {record.policyTextChanged}
              </MetaLabel>
              <MetaLabel label="Newly extracted">
                {record.newlyExtractedClaims}
              </MetaLabel>
              <MetaLabel label="Source hash">
                {record.sourceSnapshotChanged}
              </MetaLabel>
            </div>
            <ul className="compact-list">
              <li>
                <Link href="/changes">All changes</Link>
              </li>
              <li>
                <Link href={record.universityUrl}>University record</Link>
              </li>
              <li>
                <a href={record.publicJsonUrl}>Versioned public JSON</a>
              </li>
            </ul>
          </ReferenceBox>
        </aside>
      </div>
    </main>
  );
}

function ReleaseOverviewPage({
  records,
  releaseId
}: {
  records: ChangeRecord[];
  releaseId: string;
}) {
  const changedRecords = records.filter((record) => record.diffRows.length > 0);

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Release diff</p>
        <h1>University AI Policy Tracker Release Diff: {releaseId}</h1>
        <p className="lead">
          Release-to-release tracker changes. Comparable policy-text changes,
          newly extracted claims, and source snapshot changes are counted
          separately.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Release diff summary">
        <div>
          <span>{changedRecords.length}</span>
          <p>records with tracker diff rows</p>
        </div>
        <div>
          <span>
            {changedRecords.reduce((total, record) => total + record.policyTextChanged, 0)}
          </span>
          <p>policy-text changes</p>
        </div>
        <div>
          <span>
            {changedRecords.reduce((total, record) => total + record.newlyExtractedClaims, 0)}
          </span>
          <p>newly extracted claims</p>
        </div>
        <div>
          <span>
            {changedRecords.reduce((total, record) => total + record.sourceSnapshotChanged, 0)}
          </span>
          <p>source snapshot changes</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Changed universities</h2>
          <p>{changedRecords.length} records with release diff rows.</p>
        </div>
        <div className="source-attribution-list">
          {changedRecords.map((record) => (
            <article className="source-attribution-row" key={record.slug}>
              <div>
                <h3>{record.name}</h3>
                <p>
                  Policy text {record.policyTextChanged}; newly extracted{" "}
                  {record.newlyExtractedClaims}; source snapshots{" "}
                  {record.sourceSnapshotChanged}
                </p>
              </div>
              <div className="tag-row">
                <Link href={`/changes/${releaseId}/${record.slug}`}>
                  Release diff
                </Link>
                <Link href={`/changes/${record.slug}`}>Latest diff</Link>
                <Link href={record.universityUrl}>University page</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function getSummaryText(record: ChangeRecord): string {
  const changed = record.lastChangedAt
    ? ` Latest tracked changed date: ${formatDate(record.lastChangedAt)}.`
    : " No tracked changed date is published yet.";

  const diff =
    record.diffRows.length > 0
      ? ` Latest tracker diff: ${record.policyTextChanged} comparable policy-text changes, ${record.newlyExtractedClaims} newly extracted claims, ${record.sourceSnapshotChanged} source snapshot changes.`
      : " No tracker diff rows are recorded in the latest public release.";

  return `${record.name} currently has ${record.claimCount} ${pluralize("source-backed claim record", record.claimCount)} and ${record.sourceCount} ${pluralize("official source attribution", record.sourceCount)}.${changed}${diff}`;
}

function getDiffDescription(record: ChangeRecord): string {
  if (!record.previousReleaseId || !record.releaseId) {
    return "Initial tracked release. Lines represent public claim/evidence records entering the release snapshot.";
  }

  return `Comparing ${record.previousReleaseId} to ${record.releaseId}.`;
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

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatSourceFreshness(source: {
  retrievedAt?: string;
  sourceLastModified?: string;
  trackerCheckedAt?: string;
}): string {
  if (source.sourceLastModified) {
    return `Source Last-Modified ${formatTimestamp(source.sourceLastModified)}`;
  }

  const checkedAt = source.trackerCheckedAt ?? source.retrievedAt;
  return checkedAt ? `Tracker checked at ${formatTimestamp(checkedAt)}` : "";
}
