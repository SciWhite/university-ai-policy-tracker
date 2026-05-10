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
  type ChangeRecord
} from "@/lib/change-records";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface ChangeDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export async function generateStaticParams() {
  return (await getChangeRecords()).map((record) => ({
    slug: record.slug
  }));
}

export async function generateMetadata({ params }: ChangeDetailPageProps) {
  const { slug } = await params;
  const record = await getChangeRecordBySlug(slug);
  const canonical = getAbsoluteSiteUrl(`/changes/${slug}`);
  const title = record
    ? `${record.name} AI Policy Change Log | University AI Policy Tracker`
    : "Change record not found";
  const description = record
    ? `${record.name} AI policy source checks, source snapshot hashes, claim review state, and diff-style evidence preview.`
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
  const { slug } = await params;
  const record = await getChangeRecordBySlug(slug);

  if (!record) notFound();

  return (
    <main className="page-shell page-shell--wide">
      <section className="entity-header">
        <div className="entity-header__main">
          <p className="entity-header__eyebrow">Change log</p>
          <h1>{record.name}</h1>
          <p className="entity-header__summary">
            Source-check timeline, source snapshot hashes, claim review state, and
            a diff-style preview of current source-backed claim evidence.
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
          </ReferenceBox>

          <ReferenceBox
            description="Diff-style preview built from current public claim/evidence records. Full old/new source diffs require paired historical snapshots."
            title="Claim/evidence diff preview"
          >
            <DiffBlock
              description="Inserted lines represent current public claim and evidence records in the source-backed dataset."
              lines={record.diffLines}
              title={`${record.name} current policy evidence`}
            />
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
                      {source.retrievedAt ? `checked ${formatDate(source.retrievedAt)}` : ""}
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
          <ReferenceBox title="Change record">
            <div className="tag-row">
              <MetaLabel label="Reviewed claims">
                {record.reviewedClaimCount}
              </MetaLabel>
              <MetaLabel label="Candidate claims">
                {record.candidateClaimCount}
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

function getSummaryText(record: ChangeRecord): string {
  const changed = record.lastChangedAt
    ? ` Latest tracked changed date: ${formatDate(record.lastChangedAt)}.`
    : " No tracked changed date is published yet.";

  return `${record.name} currently has ${record.claimCount} ${pluralize("source-backed claim record", record.claimCount)} and ${record.sourceCount} ${pluralize("official source attribution", record.sourceCount)}.${changed}`;
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
