import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { getReviewQueueData } from "@/lib/review-dashboards";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Review Queue | University AI Policy Tracker";
const description =
  "Read-only staging review queue for OpenClaw artifact runs, validation status, source breadth, review-decision counts, and recommended next actions.";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/review/queue");

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

export default async function ReviewQueuePage() {
  const data = await getReviewQueueData();
  const apiPath = `/api/public/${PUBLIC_API_VERSION}/review/queue.json`;

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Review queue</p>
        <h1>Staging runs awaiting repair, review, or promotion</h1>
        <p className="lead">
          Visible queue for unpromoted staging runs. It cannot publish data or
          change review state.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Total runs">{data.summary.totalRuns}</MetaLabel>
          <MetaLabel label="Unpromoted">
            {data.summary.unpromotedRunCount}
          </MetaLabel>
          <MetaLabel label="Ready">
            {data.summary.readyForReviewCount}
          </MetaLabel>
          <MetaLabel label="Repair needed">
            {data.summary.repairNeededCount}
          </MetaLabel>
        </div>
      </section>

      <ReferenceBox
        className="compact-reference-box"
        description="Validation is not a publication decision."
        title="Publication boundary"
      >
        <ul className="compact-list">
          <li>Only release-manifest directories feed public pages and JSON.</li>
          <li>Staging runs still need review and manifest promotion.</li>
          <li>Review queue metadata cannot be used as official source evidence.</li>
        </ul>
      </ReferenceBox>

      <ReferenceBox
        description="Unpromoted runs, validator failures first."
        title="Unpromoted staging runs"
      >
        <div className="reference-table-wrap">
          <table className="reference-table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Validation</th>
                <th>Claims</th>
                <th>Sources</th>
                <th>Review decisions</th>
                <th>Detected slugs</th>
                <th>Last artifact</th>
                <th>Recommended action</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.directory}>
                  <td>
                    <code>{row.directory}</code>
                  </td>
                  <td>{row.validationStatus === "pass" ? "Pass" : "Fail"}</td>
                  <td>{row.claimCount}</td>
                  <td>{row.sourceCandidateCount}</td>
                  <td>{row.reviewDecisionCount}</td>
                  <td>{row.detectedSlugs.join(", ") || "—"}</td>
                  <td>{row.lastArtifactAt ? formatDate(row.lastArtifactAt) : "—"}</td>
                  <td>{row.recommendedAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReferenceBox>

      <ReferenceBox
        description="Versioned read-only metadata."
        title="Queue JSON"
      >
        <ApiEndpointRow
          description="Unpromoted staging run status, counts, detected slugs, validation state, and recommended next action."
          label="Review queue"
          path={apiPath}
          status="Read-only metadata"
          url={apiPath}
        />
      </ReferenceBox>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
