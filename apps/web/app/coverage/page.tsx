import Link from "next/link";
import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import {
  getCoverageDashboardData,
  getReviewQueueData,
  getSourceHealthDashboardData
} from "@/lib/review-dashboards";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Coverage Dashboard | University AI Policy Tracker";
const description =
  "Collection coverage dashboard for QS 2026 targets, public source-backed records, staging-only runs, missing targets, and source health.";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/coverage");

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

export default async function CoveragePage() {
  const [coverage, sourceHealth, reviewQueue] = await Promise.all([
    getCoverageDashboardData(),
    getSourceHealthDashboardData(),
    getReviewQueueData()
  ]);
  const qsCoveragePath = `/api/public/${PUBLIC_API_VERSION}/coverage/qs-2026.json`;
  const sourceHealthPath = `/api/public/${PUBLIC_API_VERSION}/source-health.json`;
  const reviewQueuePath = `/api/public/${PUBLIC_API_VERSION}/review/queue.json`;

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "University AI Policy Tracker coverage dashboard",
          description,
          url: getAbsoluteSiteUrl("/coverage"),
          isAccessibleForFree: true,
          license: "https://creativecommons.org/licenses/by/4.0/",
          distribution: [
            {
              "@type": "DataDownload",
              name: "QS 2026 coverage JSON",
              encodingFormat: "application/json",
              contentUrl: getAbsoluteSiteUrl(qsCoveragePath)
            },
            {
              "@type": "DataDownload",
              name: "Source health JSON",
              encodingFormat: "application/json",
              contentUrl: getAbsoluteSiteUrl(sourceHealthPath)
            }
          ]
        }}
      />

      <section className="hero">
        <p className="kicker">Coverage</p>
        <h1>Collection coverage, not policy quality</h1>
        <p className="lead">
          Crawl and review planning for public records, staging-only runs, and
          missing targets.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Ranking">{coverage.ranking.system}</MetaLabel>
          <MetaLabel label="Year">{coverage.ranking.year}</MetaLabel>
          <MetaLabel label="Rows">{coverage.summary.totalRows}</MetaLabel>
          <MetaLabel label="Generated">
            {formatDate(coverage.generatedAt)}
          </MetaLabel>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Coverage summary">
        <div>
          <span>{coverage.summary.publicCount}</span>
          <p>public records</p>
        </div>
        <div>
          <span>{coverage.summary.stagingUnpromotedCount}</span>
          <p>staging-only targets</p>
        </div>
        <div>
          <span>{coverage.summary.missingCount}</span>
          <p>missing targets</p>
        </div>
        <div>
          <span>{sourceHealth.summary.warningCount}</span>
          <p>source warnings</p>
        </div>
      </section>

      <section className="answer-strip" aria-label="Coverage answer blocks">
        <article className="answer-card">
          <h2>What coverage means</h2>
          <p>
            Coverage describes collection and review status for target
            institutions. It is not a policy quality or compliance score.
          </p>
        </article>
        <article className="answer-card">
          <h2>What staging means</h2>
          <p>
            Staging-only rows are crawl/review work, not public evidence, until
            validated and promoted into the public release.
          </p>
        </article>
        <article className="answer-card">
          <h2>How to cite coverage</h2>
          <p>
            Cite coverage JSON for collection status only; cite university
            records and source evidence for policy statements.
          </p>
        </article>
      </section>

      <div className="docs-layout">
        <nav className="docs-toc" aria-label="Coverage sections">
          <a href="#surfaces">Surfaces</a>
          <a href="#gaps">Priority gaps</a>
          <a href="#queue">Review queue</a>
          <a href="#json">Public JSON</a>
        </nav>

        <div className="docs-content">
          <ReferenceBox
            description="Collection state and review work."
            id="surfaces"
            title="Review surfaces"
          >
            <DataList>
              <DataListRow
                actions={<Link href="/coverage/qs-2026">Open</Link>}
                metadata={
                  <MetaLabel label="Rows">
                    {coverage.summary.totalRows}
                  </MetaLabel>
                }
              >
                <h2>QS 2026 coverage</h2>
                <p>Public, staging-only, and missing status for QS 2026 targets.</p>
              </DataListRow>
              <DataListRow
                actions={<Link href="/source-health">Open</Link>}
                metadata={
                  <MetaLabel label="Rows">
                    {sourceHealth.summary.totalRows}
                  </MetaLabel>
                }
              >
                <h2>Source health</h2>
                <p>Source snapshot and fetch status for repair planning.</p>
              </DataListRow>
              <DataListRow
                actions={<Link href="/review/queue">Open</Link>}
                metadata={
                  <MetaLabel label="Runs">
                    {reviewQueue.summary.unpromotedRunCount}
                  </MetaLabel>
                }
              >
                <h2>Review queue</h2>
                <p>Unpromoted runs by validation status and next action.</p>
              </DataListRow>
            </DataList>
          </ReferenceBox>

          <ReferenceBox
            description="Top unresolved targets by QS row order. Staging rows still require validation and promotion before becoming public records."
            id="gaps"
            title="Priority coverage gaps"
          >
            <div className="reference-table-wrap">
              <table className="reference-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>University</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.highPriorityGaps.slice(0, 12).map((row) => (
                    <tr key={`${row.qsRank}-${row.universityName}`}>
                      <td>{row.rankText}</td>
                      <td>
                        <strong>{row.universityName}</strong>
                        <div className="table-muted">{row.countryOrRegion}</div>
                      </td>
                      <td>{formatCoverageStatus(row.status)}</td>
                      <td>{row.recommendedAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReferenceBox>

          <ReferenceBox
            description="The review queue is planning metadata. It cannot promote runs or publish claims."
            id="queue"
            title="Queue summary"
          >
            <div className="tag-row">
              <MetaLabel label="Total runs">
                {reviewQueue.summary.totalRuns}
              </MetaLabel>
              <MetaLabel label="Promoted">
                {reviewQueue.summary.promotedRunCount}
              </MetaLabel>
              <MetaLabel label="Ready">
                {reviewQueue.summary.readyForReviewCount}
              </MetaLabel>
              <MetaLabel label="Repair needed">
                {reviewQueue.summary.repairNeededCount}
              </MetaLabel>
            </div>
            <p className="notice-card">
              Staging-only data is not canonical public data. Public claims still
              require source URL, source language, snapshot hash,
              original-language evidence, confidence, and review state.
            </p>
          </ReferenceBox>

          <ReferenceBox
            description="Versioned read-only metadata endpoints for dashboards and external audit workflows."
            id="json"
            title="Dashboard JSON"
          >
            <ApiEndpointRow
              description="QS 2026 public/staging/missing coverage rows, counts, recommended actions, and citation fields."
              label="QS 2026 coverage"
              path={qsCoveragePath}
              status="Read-only metadata"
              url={qsCoveragePath}
            />
            <ApiEndpointRow
              description="Source health summary with public snapshot metadata and staging fetch/source status rows."
              label="Source health"
              path={sourceHealthPath}
              status="Read-only metadata"
              url={sourceHealthPath}
            />
            <ApiEndpointRow
              description="Unpromoted staging queue metadata for validation and promotion planning."
              label="Review queue"
              path={reviewQueuePath}
              status="Read-only metadata"
              url={reviewQueuePath}
            />
          </ReferenceBox>
        </div>
      </div>
    </main>
  );
}

function formatCoverageStatus(status: string): string {
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
