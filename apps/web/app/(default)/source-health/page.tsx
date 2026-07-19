import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { SourceHealthLabel } from "@/components/source-health-label";
import {
  getSourceHealthDashboardData,
  type SourceHealthRow,
  type SourceHealthSeverity,
  type SourceHealthStatus
} from "@/lib/review-dashboards";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  type SupportedLocale
} from "@/lib/i18n";
import { translateSurfaceText } from "@/lib/surface-localization";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";

const title = "Source Health | University AI Policy Tracker";
const description =
  "Read-only source health dashboard for public source snapshot metadata, Firecrawl verification checks, and staging source/fetch statuses.";
const MAX_TABLE_ROWS = 80;
const VERIFIED_STATUSES = new Set<SourceHealthStatus>([
  "agent_verified_accessible",
  "browser_verified",
  "firecrawl_verified"
]);
const ACCESS_BOUNDARY_STATUSES = new Set<SourceHealthStatus>([
  "agent_blocked_captcha_waf",
  "agent_blocked_login",
  "agent_blocked_robots",
  "blocked_by_client",
  "browser_timeout_unverified",
  "captcha_or_waf",
  "forbidden",
  "login_wall",
  "paywall",
  "robots_blocked"
]);

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/source-health");

  return {
    title,
    description,
    alternates: getLocalizedAlternates("/source-health", "en"),
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function SourceHealthPage({
  params
}: {
  params?: Promise<{ locale?: string }>;
} = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const data = await getSourceHealthDashboardData();
  const apiPath = `/api/public/${PUBLIC_API_VERSION}/source-health.json`;
  const actionableRows = data.rows
    .filter(isOpenActionableRow)
    .slice(0, MAX_TABLE_ROWS);
  const verifiedRows = data.rows
    .filter((row) => VERIFIED_STATUSES.has(row.status))
    .slice(0, MAX_TABLE_ROWS);
  const blockedRows = data.rows
    .filter((row) => ACCESS_BOUNDARY_STATUSES.has(row.status))
    .slice(0, MAX_TABLE_ROWS);
  const rejectedRows = data.rows
    .filter((row) => row.status === "rejected_not_policy_evidence")
    .slice(0, MAX_TABLE_ROWS);

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Source health</p>
        <h1>Source status for public snapshots and staging runs</h1>
        <p className="lead">
          Recrawl, repair, and review planning for public source snapshots and
          staging fetches.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Public sources">
            {data.summary.publicSourceRows}
          </MetaLabel>
          <MetaLabel label="Staging sources">
            {data.summary.stagingSourceRows}
          </MetaLabel>
          <MetaLabel label="Actionable">
            {data.summary.actionableIssueCount}
          </MetaLabel>
          <MetaLabel label="Rejected discovery">
            {data.summary.rejectedDiscoveryRows}
          </MetaLabel>
          <MetaLabel label="Warnings">{data.summary.warningCount}</MetaLabel>
          <MetaLabel label="Errors">{data.summary.errorCount}</MetaLabel>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Supplemental verification summary">
        <div>
          <span>{data.agentVerification.summary.total}</span>
          <p>agent verification rows</p>
        </div>
        <div>
          <span>{data.agentVerification.summary.verifiedAccessible}</span>
          <p>agent verified accessible</p>
        </div>
        <div>
          <span>{data.agentVerification.summary.blocked}</span>
          <p>agent access boundaries</p>
        </div>
        <div>
          <span>
            {data.agentVerification.summary.fetchFailed +
              data.agentVerification.summary.unresolved}
          </span>
          <p>agent follow-ups</p>
        </div>
        <div>
          <span>{data.firecrawlVerification.summary.total}</span>
          <p>legacy browser/firecrawl rows</p>
        </div>
      </section>

      <section className="answer-strip" aria-label="Source health answer blocks">
        <article className="answer-card">
          <h2>What source health means</h2>
          <p>
            Source health is access and maintenance metadata for snapshots and
            staging fetches; it does not change claim review state.
          </p>
        </article>
        <article className="answer-card">
          <h2>What verification means</h2>
          <p>
            Fresh scrape verification can confirm access, redirects, or
            failures, but official source evidence remains the citation target.
          </p>
        </article>
        <article className="answer-card">
          <h2>Repair boundary</h2>
          <p>
            Prefer alternative official URLs or snapshot-only notes; do not
            bypass robots, paywalls, login walls, CAPTCHA, or WAF.
          </p>
        </article>
      </section>

      <ReferenceBox
        className="compact-reference-box"
        description="Crawler/review planning only."
        title="Access and rights boundary"
      >
        <ul className="compact-list">
          <li>Never bypass robots, login walls, paywalls, CAPTCHA, or WAF.</li>
          <li>Do not publish raw source text, PDFs, screenshots, or crawl text.</li>
          <li>
            Public <SourceHealthLabel status="ok" /> means the promoted record
            has source attribution and snapshot metadata; it is not a live
            recrawl guarantee.
          </li>
          <li>
            <SourceHealthLabel status="firecrawl_verified" /> means a fresh
            compliant scrape extracted content for a URL that normal requests
            could not verify. It does not upgrade claim review state, source
            officialness, or canonical evidence status.
          </li>
          <li>
            <SourceHealthLabel status="browser_verified" /> means a browser
            check opened the official URL with readable content after another
            check was inconclusive.
          </li>
          <li>
            <SourceHealthLabel status="blocked_by_client" /> and{" "}
            <SourceHealthLabel status="browser_timeout_unverified" /> are
            follow-up statuses, not source-down findings.
          </li>
          <li>
            Maintenance rows are planning metadata, not claim/evidence data.
          </li>
          {data.agentVerification.requestPolicy ? (
            <li>{data.agentVerification.requestPolicy}</li>
          ) : null}
          {data.firecrawlVerification.requestPolicy ? (
            <li>{data.firecrawlVerification.requestPolicy}</li>
          ) : null}
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
        description="Warnings and errors that remain after separating blocked access and non-policy discovery noise."
        title="Actionable source-access issues"
      >
        <SourceHealthTable
          emptyLabel="No open actionable rows in the first triage slice."
          rows={actionableRows}
        />
      </ReferenceBox>

      <ReferenceBox
        description="Confirmed accessible by the latest allowed agent, browser, or Firecrawl check."
        title="Agent verified"
      >
        <SourceHealthTable
          emptyLabel="No supplemental verification rows are currently published."
          rows={verifiedRows}
        />
      </ReferenceBox>

      <ReferenceBox
        description="Access controls or client boundaries. These rows should not be bypassed."
        title="Blocked by access boundary"
      >
        <SourceHealthTable
          emptyLabel="No access-boundary rows in the current source-health data."
          rows={blockedRows}
        />
      </ReferenceBox>

      <ReferenceBox
        description="Rejected discovery candidates are retained for auditability but excluded from source repair counts."
        title="Rejected discovery"
      >
        <SourceHealthTable
          emptyLabel="No rejected discovery rows in the current source-health data."
          rows={rejectedRows}
        />
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

function SourceHealthTable({
  emptyLabel,
  locale = DEFAULT_LOCALE,
  rows
}: {
  emptyLabel: string;
  locale?: SupportedLocale;
  rows: SourceHealthRow[];
}) {
  const t = (value: string) => translateSurfaceText(value, locale);
  if (rows.length === 0) {
    return <p className="table-muted">{emptyLabel}</p>;
  }

  return (
    <div className="reference-table-wrap">
      <table className="reference-table source-health-table">
        <thead>
          <tr>
            <th>{t("Status")}</th>
            <th>{t("Scope")}</th>
            <th>{t("Entity")}</th>
            <th>{t("Source")}</th>
            <th>{t("Last checked")}</th>
            <th>{t("Note")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.scope}-${row.sourceUrl}-${index}`}>
              <td>
                <SourceHealthLabel locale={locale} status={row.status} />
                <div className="table-muted">{t(formatSeverity(row.severity))}</div>
              </td>
              <td>{t(formatScope(row.scope))}</td>
              <td>
                <code>{row.entitySlug}</code>
                {row.stagingRun ? (
                  <div className="table-muted">{row.stagingRun}</div>
                ) : null}
              </td>
              <td>
                <a data-i18n="preserve" href={row.sourceUrl}>{row.sourceTitle ?? row.sourceUrl}</a>
                <div className="table-muted">
                  {row.sourceType ?? getHost(row.sourceUrl)}
                </div>
              </td>
              <td>
                {row.lastCheckedAt ? formatDate(row.lastCheckedAt, locale) : t("Not checked")}
              </td>
              <td>{t(row.note)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isOpenActionableRow(row: SourceHealthRow): boolean {
  if (row.status === "rejected_not_policy_evidence") return false;
  if (VERIFIED_STATUSES.has(row.status)) return false;
  if (ACCESS_BOUNDARY_STATUSES.has(row.status)) return false;
  return row.severity === "error" || row.severity === "warning";
}

function describeStatus(status: string): string {
  const descriptions: Record<string, string> = {
    agent_blocked_captcha_waf:
      "Agent verification reached CAPTCHA, WAF, or anti-bot protection without bypassing controls.",
    agent_blocked_login:
      "Agent verification reached a login or authentication boundary without bypassing controls.",
    agent_blocked_robots:
      "Agent verification found robots restrictions and did not crawl the source.",
    agent_fetch_failed:
      "Agent verification could not fetch readable content through the allowed checks.",
    agent_unresolved:
      "Current metadata is still inconclusive and needs another automated verification pass.",
    agent_verified_404:
      "Agent verification confirmed a missing or stale public route.",
    agent_verified_accessible:
      "Agent verification confirmed the official URL opens with readable content.",
    agent_verified_empty:
      "Agent verification opened the URL but did not extract meaningful source content.",
    agent_verified_redirect_unrelated:
      "Agent verification confirmed the URL redirects away from the intended policy source.",
    blocked_by_client:
      "The current browser profile or client blocked navigation; this is a warning, not proof that the official source is down.",
    browser_timeout_unverified:
      "Browser verification timed out or returned no readable content; keep in manual or alternate-source follow-up.",
    browser_verified:
      "Browser verification confirmed the official URL opens with readable content.",
    captcha_or_waf: "Source appears protected by CAPTCHA or WAF.",
    changed_hash: "Reserved for future source hash drift checks.",
    firecrawl_failed:
      "Firecrawl could not verify this URL; prioritize alternate official URLs or mark snapshot-only.",
    firecrawl_opened_no_content:
      "Firecrawl opened the URL but did not extract meaningful source content; prioritize alternate official URLs or mark snapshot-only.",
    firecrawl_verified:
      "A fresh Firecrawl scrape extracted source content after a normal request was blocked or inconclusive.",
    forbidden: "Source returned or appears likely to return a forbidden status.",
    login_wall: "Source appears to require authentication.",
    not_found: "Source appears missing or stale.",
    ok: "Source has usable public snapshot or staging fetch metadata.",
    paywall: "Source appears paywalled.",
    redirected: "Final URL differs from discovered URL and should be checked.",
    rejected_not_policy_evidence:
      "Rejected discovery candidate is not policy evidence and is hidden from actionable repair by default.",
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

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
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
