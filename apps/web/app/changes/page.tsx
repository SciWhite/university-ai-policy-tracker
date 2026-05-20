import Link from "next/link";
import { NO_ADVICE_BOUNDARY, PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import { getChangeRecords, type ChangeRecord } from "@/lib/change-records";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Recent Changes | University AI Policy Tracker";
const description =
  "Recent source checks and policy-change records with last checked dates, last changed dates, review states, and versioned public JSON links.";

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
  const recentChangesPath = `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`;
  const recentChangesUrl = getAbsoluteSiteUrl(recentChangesPath);
  const changedCount = records.filter((record) => record.lastChangedAt).length;
  const checkedCount = records.filter((record) => record.lastCheckedAt).length;
  const totalClaims = records.reduce(
    (total, record) => total + record.claimCount,
    0
  );
  const totalSources = records.reduce(
    (total, record) => total + record.sourceCount,
    0
  );

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Changes</p>
        <h1>Source checks and policy record freshness</h1>
        <p className="lead">
          Freshness metadata for public university records: checked dates,
          changed dates, review state, claim counts, and JSON links.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Recent changes summary">
        <div>
          <span>{records.length}</span>
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

      <section className="answer-strip" aria-label="Change feed answer blocks">
        <article className="answer-card">
          <h2>What changed means</h2>
          <p>
            A changed date means the promoted public record or tracked source
            metadata changed in the release, not that a university policy became
            stricter or more permissive.
          </p>
        </article>
        <article className="answer-card">
          <h2>What checked means</h2>
          <p>
            A checked date records source-review freshness. Open the record page
            and JSON before citing a current institutional policy statement.
          </p>
        </article>
        <article className="answer-card">
          <h2>How agents should use it</h2>
          <p>
            Use the recent changes JSON to find records, then retrieve canonical
            university pages and source-backed claims for claim-level answers.
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
      </ReferenceBox>

      <section className="section">
        <div className="section-heading">
          <h2>Change timeline</h2>
          <p>
            {totalSources} source attributions across {records.length} records.
          </p>
        </div>
        {records.length ? (
          <DataList className="timeline-list">
            {records.map((record) => {
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
            No public change records are available yet. The versioned feed URL
            remains available for readers and agents.
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

  return `${record.name} has ${record.claimCount} ${pluralize("source-backed claim record", record.claimCount)} and ${record.sourceCount} ${pluralize("official source attribution", record.sourceCount)}.${changed}`;
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
