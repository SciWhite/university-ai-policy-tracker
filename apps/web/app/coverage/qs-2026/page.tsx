import Link from "next/link";
import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  getCoverageDashboardData,
  type CoverageStatus
} from "@/lib/review-dashboards";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "QS 2026 Coverage | University AI Policy Tracker";
const description =
  "QS 2026 target coverage dashboard showing public records, staging-only records awaiting review, missing targets, source counts, review states, and recommended next actions.";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/coverage/qs-2026");

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

export default async function QsCoveragePage() {
  const data = await getCoverageDashboardData();
  const apiPath = `/api/public/${PUBLIC_API_VERSION}/coverage/qs-2026.json`;

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">QS 2026 coverage</p>
        <h1>Public, staging, and missing tracker coverage</h1>
        <p className="lead">
          QS rows are used here as a collection target list. A public status
          means the tracker has a promoted source-backed record. Staging-only
          means a local artifact run exists but still needs validation, review,
          and manifest promotion before it can become public data.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Public">{data.summary.publicCount}</MetaLabel>
          <MetaLabel label="Staging">
            {data.summary.stagingUnpromotedCount}
          </MetaLabel>
          <MetaLabel label="Missing">{data.summary.missingCount}</MetaLabel>
          <MetaLabel label="API">{apiPath}</MetaLabel>
        </div>
      </section>

      <ReferenceBox
        description="Collection coverage is not a policy quality score and should not be cited as a ranking of AI governance maturity."
        title="Coverage boundary"
      >
        <ul className="compact-list">
          {data.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </ReferenceBox>

      <ReferenceBox
        actions={
          data.ranking.sourceUrl ? (
            <a className="site-action" href={data.ranking.sourceUrl}>
              Ranking source
            </a>
          ) : null
        }
        description="Rows preserve QS rank text, including ties, while the tracker stores separate coverage status and review metadata."
        title="QS 2026 target rows"
      >
        <div className="reference-table-wrap">
          <table className="reference-table coverage-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>University</th>
                <th>Status</th>
                <th>Claims</th>
                <th>Sources</th>
                <th>Review</th>
                <th>Last checked</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={`${row.qsRank}-${row.universityName}`}>
                  <td>{row.rankText}</td>
                  <td>
                    <strong>{row.universityName}</strong>
                    <div className="table-muted">{row.countryOrRegion}</div>
                    {row.publicSlug ? (
                      <Link href={`/universities/${row.publicSlug}`}>
                        Open record
                      </Link>
                    ) : row.stagingRun ? (
                      <span className="table-muted">{row.stagingRun}</span>
                    ) : null}
                  </td>
                  <td>{formatCoverageStatus(row.status)}</td>
                  <td>{row.claimCount}</td>
                  <td>{row.sourceCount}</td>
                  <td>
                    {row.reviewState ? (
                      <StateLabel reviewState={row.reviewState} prefix="" />
                    ) : (
                      <span className="table-muted">Not public</span>
                    )}
                  </td>
                  <td>{row.lastCheckedAt ? formatDate(row.lastCheckedAt) : "—"}</td>
                  <td>{row.recommendedAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReferenceBox>

      <ReferenceBox
        description="Versioned JSON mirrors the visible dashboard fields and citation caveats."
        title="Coverage JSON"
      >
        <ApiEndpointRow
          description="QS 2026 public/staging/missing status, source counts, claim counts, review state, and recommended next action."
          label="QS coverage JSON"
          path={apiPath}
          status="Read-only metadata"
          url={apiPath}
        />
      </ReferenceBox>
    </main>
  );
}

function formatCoverageStatus(status: CoverageStatus): string {
  if (status === "public") return "Public record";
  if (status === "staging_unpromoted") return "Staging only";
  return "Missing";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
