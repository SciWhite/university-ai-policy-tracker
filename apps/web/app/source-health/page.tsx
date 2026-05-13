import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { SourceHealthLabel } from "@/components/source-health-label";
import {
  getSourceHealthDashboardData,
  type SourceHealthSeverity
} from "@/lib/review-dashboards";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Source Health | University AI Policy Tracker";
const description =
  "Read-only source health dashboard for public source snapshot metadata and staging source/fetch statuses, including robots, login-wall, paywall, forbidden, not-found, redirect, and unknown-error boundaries.";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/source-health");

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

export default async function SourceHealthPage() {
  const data = await getSourceHealthDashboardData();
  const apiPath = `/api/public/${PUBLIC_API_VERSION}/source-health.json`;
  const visibleRows = data.rows.slice(0, 160);

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Source health</p>
        <h1>Source status for public snapshots and staging runs</h1>
        <p className="lead">
          Source health helps plan recrawls, repairs, and manual review. Public
          rows reflect promoted source snapshot metadata; staging rows remain
          planning metadata and never publish canonical claims by themselves.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Public sources">
            {data.summary.publicSourceRows}
          </MetaLabel>
          <MetaLabel label="Staging sources">
            {data.summary.stagingSourceRows}
          </MetaLabel>
          <MetaLabel label="Warnings">{data.summary.warningCount}</MetaLabel>
          <MetaLabel label="Errors">{data.summary.errorCount}</MetaLabel>
        </div>
      </section>

      <ReferenceBox
        description="These statuses are for crawler/review planning. They do not authorize bypassing access controls."
        title="Access and rights boundary"
      >
        <ul className="compact-list">
          <li>
            Never bypass robots.txt, login walls, paywalls, CAPTCHA, WAF, or
            other access controls.
          </li>
          <li>
            Do not publish raw source text, PDFs, screenshots, or normalized
            crawl text as tracker metadata.
          </li>
          <li>
            Public <SourceHealthLabel status="ok" /> means the promoted record
            has source attribution and snapshot metadata; it is not a live
            recrawl guarantee.
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox
        description="Counts by crawler/source status. changed_hash is reserved for future live-diff checks."
        title="Status distribution"
      >
        <DataList>
          {Object.entries(data.summary.statusCounts)
            .filter(([, count]) => count > 0)
            .map(([status, count]) => (
              <DataListRow
                key={status}
                metadata={<MetaLabel label="Rows">{count}</MetaLabel>}
              >
                <h2>
                  <SourceHealthLabel
                    status={status as keyof typeof data.summary.statusCounts}
                  />
                </h2>
                <p>{describeStatus(status)}</p>
              </DataListRow>
            ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="The table is capped for page weight. Use the JSON endpoint for complete machine-readable rows."
        title="Source rows"
      >
        <div className="reference-table-wrap">
          <table className="reference-table source-health-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Scope</th>
                <th>Entity</th>
                <th>Source</th>
                <th>Last checked</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr key={`${row.scope}-${row.sourceUrl}-${index}`}>
                  <td>
                    <SourceHealthLabel status={row.status} />
                    <div className="table-muted">
                      {formatSeverity(row.severity)}
                    </div>
                  </td>
                  <td>{formatScope(row.scope)}</td>
                  <td>
                    <code>{row.entitySlug}</code>
                    {row.stagingRun ? (
                      <div className="table-muted">{row.stagingRun}</div>
                    ) : null}
                  </td>
                  <td>
                    <a href={row.sourceUrl}>{row.sourceTitle ?? row.sourceUrl}</a>
                    <div className="table-muted">
                      {row.sourceType ?? getHost(row.sourceUrl)}
                    </div>
                  </td>
                  <td>{row.lastCheckedAt ? formatDate(row.lastCheckedAt) : "—"}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReferenceBox>

      <ReferenceBox
        description="Versioned read-only JSON for source-health audits and agent planning."
        title="Source health JSON"
      >
        <ApiEndpointRow
          description="Public source snapshot metadata and staging source/fetch statuses with severity and no-bypass caveats."
          label="Source health"
          path={apiPath}
          status="Read-only metadata"
          url={apiPath}
        />
      </ReferenceBox>
    </main>
  );
}

function describeStatus(status: string): string {
  const descriptions: Record<string, string> = {
    captcha_or_waf: "Source appears protected by CAPTCHA or WAF.",
    changed_hash: "Reserved for future source hash drift checks.",
    forbidden: "Source returned or appears likely to return a forbidden status.",
    login_wall: "Source appears to require authentication.",
    not_found: "Source appears missing or stale.",
    ok: "Source has usable public snapshot or staging fetch metadata.",
    paywall: "Source appears paywalled.",
    redirected: "Final URL differs from discovered URL and should be checked.",
    robots_blocked: "Robots policy blocks fetching or source was rejected for robots restrictions.",
    unknown_error: "Source needs manual inspection or another compliant fetch attempt."
  };

  return descriptions[status] ?? "Source needs review.";
}

function formatScope(scope: string): string {
  return scope === "public_release" ? "Public release" : "Staging run";
}

function formatSeverity(severity: SourceHealthSeverity): string {
  if (severity === "error") return "Error";
  if (severity === "warning") return "Warning";
  return "Info";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function getHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}
