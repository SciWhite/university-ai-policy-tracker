import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  hasAnalyticsStore,
  listMirroredAnalyticsEvents
} from "@/lib/analytics-store";
import {
  getGoogleSearchConsoleSummary,
  type GscMetricRow
} from "@/lib/google-search-console";
import {
  buildPrivateAnalyticsSummary,
  type AnalyticsPeriod,
  type PrivateAnalyticsCountRow,
  type PrivateAnalyticsSummary
} from "@/lib/private-analytics";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Private analytics | University AI Policy Tracker";
const description =
  "Private admin analytics for first-party behavior and Google Search Console visibility.";

export const dynamic = "force-dynamic";

interface PrivateAnalyticsPageProps {
  searchParams?: Promise<{
    period?: string;
  }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: {
      canonical: getAbsoluteSiteUrl("/internal/analytics")
    },
    description,
    robots: {
      follow: false,
      index: false
    },
    title
  };
}

export default async function PrivateAnalyticsPage({
  searchParams
}: PrivateAnalyticsPageProps = {}) {
  const period = normalizePeriod((await searchParams)?.period);
  const windowDays = getWindowDays(period);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const gscEndDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const analyticsStoreAvailable = hasAnalyticsStore();
  const [rows, gsc] = await Promise.all([
    loadAnalyticsRows(since),
    getGoogleSearchConsoleSummary(since, gscEndDate)
  ]);
  const summary = buildPrivateAnalyticsSummary(rows, since, period);

  return (
    <main className="analytics-dashboard">
      <header className="analytics-dashboard__header">
        <div>
          <p className="analytics-dashboard__eyebrow">Internal analytics</p>
          <h1>Search visibility and onsite behavior</h1>
          <p>
            GSC metrics are search-side only. First-party metrics are onsite
            page views, sessions, source attribution, geo, and tracked events.
          </p>
        </div>
        <nav className="analytics-period-tabs" aria-label="Analytics period">
          {(["day", "week", "month"] as const).map((value) => (
            <a
              aria-current={period === value ? "page" : undefined}
              href={`/internal/analytics?period=${value}`}
              key={value}
            >
              {formatPeriod(value)}
            </a>
          ))}
        </nav>
      </header>

      <section className="analytics-status-row" aria-label="Data source status">
        <span>{windowDays} day window</span>
        <span>Onsite: {analyticsStoreAvailable ? "connected" : "unavailable"}</span>
        <span>GSC: {gsc.available ? "connected" : "unavailable"}</span>
        <span>No full referrer URLs stored</span>
      </section>

      {!analyticsStoreAvailable || !gsc.available ? (
        <section className="analytics-alert-grid" aria-label="Analytics warnings">
          {!analyticsStoreAvailable ? (
            <div>
              <strong>Onsite analytics unavailable</strong>
              <span>DATABASE_URL or Supabase analytics env is not configured.</span>
            </div>
          ) : null}
          {!gsc.available ? (
            <div>
              <strong>GSC unavailable</strong>
              <span>{gsc.error ?? "Google Search Console credentials are not configured."}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="analytics-kpi-grid" aria-label="Dashboard metrics">
        <KpiCard label="Visitors" value={formatCount(summary.visitors)} source="Onsite" />
        <KpiCard label="Sessions" value={formatCount(summary.sessions)} source="Onsite" />
        <KpiCard label="Page views" value={formatCount(summary.pageViews)} source="Onsite" />
        <KpiCard
          label="Engaged"
          value={formatPercent(safeRate(summary.engagedSessions, summary.sessions))}
          source="Onsite"
        />
        <KpiCard label="Bounce" value={formatPercent(summary.bounceRate)} source="Onsite" />
        <KpiCard label="GSC clicks" value={formatCount(gsc.totals.clicks)} source="Google" />
        <KpiCard
          label="GSC impressions"
          value={formatCount(gsc.totals.impressions)}
          source="Google"
        />
        <KpiCard label="GSC CTR" value={formatPercent(gsc.totals.ctr)} source="Google" />
        <KpiCard label="Avg position" value={formatDecimal(gsc.totals.position)} source="Google" />
      </section>

      <section className="analytics-dashboard-grid">
        <AnalyticsPanel
          meta={`${formatPeriod(period)} buckets`}
          title="Onsite trend"
        >
          <Sparkline values={summary.trend.map((row) => row.pageViews)} />
          <CompactTable
            columns={["Period", "Views", "Visitors", "Sessions", "Events"]}
            rows={summary.trend.slice(-12).map((row) => [
              row.label,
              formatCount(row.pageViews),
              formatCount(row.visitors),
              formatCount(row.sessions),
              formatCount(row.events)
            ])}
          />
        </AnalyticsPanel>

        <AnalyticsPanel meta="Search-side visibility" title="GSC trend">
          <Sparkline values={gsc.dateRows.map((row) => row.clicks)} />
          <CompactTable
            columns={["Date", "Clicks", "Impr.", "CTR", "Pos."]}
            rows={gsc.dateRows.slice(-12).map((row) => [
              row.key,
              formatCount(row.clicks),
              formatCount(row.impressions),
              formatPercent(row.ctr),
              formatDecimal(row.position)
            ])}
          />
        </AnalyticsPanel>

        <AnalyticsPanel meta="First-party referrer and UTM" title="Source mix">
          <SourceMixTable summary={summary} />
        </AnalyticsPanel>

        <AnalyticsPanel meta="Search visibility" title="Top GSC queries">
          <GscRowsTable rows={gsc.queryRows} keyLabel="Query" />
        </AnalyticsPanel>

        <AnalyticsPanel meta="Onsite" title="Top landing pages">
          <CountRowsTable rows={summary.topLandingPages} valueLabel="Views" />
        </AnalyticsPanel>

        <AnalyticsPanel meta="Search visibility" title="Top GSC pages">
          <GscRowsTable rows={gsc.pageRows} keyLabel="Page" />
        </AnalyticsPanel>

        <AnalyticsPanel meta="Cloudflare country on requests" title="Onsite GEO">
          <CompactTable
            columns={["Country", "Views", "Visitors", "Lang.", "Share"]}
            rows={summary.countries.map((row) => [
              formatCountry(row.countryCode, row.countryName),
              formatCount(row.pageViews),
              formatCount(row.visitors),
              formatLocale(row.primaryLocale),
              formatPercent(row.share)
            ])}
          />
        </AnalyticsPanel>

        <AnalyticsPanel meta="Search-side country" title="GSC GEO">
          <GscRowsTable rows={gsc.countryRows} keyLabel="Country" transformKey={formatGscCountry} />
        </AnalyticsPanel>

        <AnalyticsPanel meta="Tracked behavior" title="Event funnel">
          <FunnelTable summary={summary} />
        </AnalyticsPanel>

        <AnalyticsPanel meta="Coarse request headers" title="Devices">
          <CompactTable
            columns={["Device", "Views", "Visitors", "Events", "Share"]}
            rows={summary.devices.map((row) => [
              formatDeviceType(row.deviceType),
              formatCount(row.pageViews),
              formatCount(row.visitors),
              formatCount(row.events),
              formatPercent(row.share)
            ])}
          />
        </AnalyticsPanel>

        <AnalyticsPanel meta="Mirrored events" title="Top events">
          <CountRowsTable rows={summary.topEvents} valueLabel="Events" />
        </AnalyticsPanel>

        <AnalyticsPanel meta="Recent stream" title="Recent events">
          <CompactTable
            columns={["When", "Event", "Path", "Source"]}
            rows={summary.recent.slice(0, 12).map((row) => [
              formatDateTime(row.createdAt),
              row.eventName,
              row.pathname,
              row.sourceName ?? row.source
            ])}
          />
        </AnalyticsPanel>
      </section>
    </main>
  );
}

function KpiCard({
  label,
  source,
  value
}: {
  label: string;
  source: string;
  value: string;
}) {
  return (
    <article>
      <span>{source}</span>
      <strong>{value}</strong>
      <p>{label}</p>
    </article>
  );
}

function AnalyticsPanel({
  children,
  meta,
  title
}: {
  children: ReactNode;
  meta: string;
  title: string;
}) {
  return (
    <section className="analytics-panel">
      <header>
        <h2>{title}</h2>
        <span>{meta}</span>
      </header>
      {children}
    </section>
  );
}

function CompactTable({
  columns,
  rows
}: {
  columns: string[];
  rows: string[][];
}) {
  if (!rows.length) {
    return <p className="analytics-empty">No data in this window.</p>;
  }

  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}:${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}:${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountRowsTable({
  rows,
  valueLabel
}: {
  rows: PrivateAnalyticsCountRow[];
  valueLabel: string;
}) {
  if (!rows.length) {
    return <p className="analytics-empty">No data in this window.</p>;
  }

  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table analytics-table--bars">
        <thead>
          <tr>
            <th>Item</th>
            <th>{valueLabel}</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{formatCount(row.count)}</td>
              <td>
                <InlineBar value={row.share} label={formatPercent(row.share)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceMixTable({ summary }: { summary: PrivateAnalyticsSummary }) {
  if (!summary.sourceMix.length) {
    return <p className="analytics-empty">No source data in this window yet.</p>;
  }

  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table analytics-table--bars">
        <thead>
          <tr>
            <th>Source</th>
            <th>Category</th>
            <th>Views</th>
            <th>Visitors</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          {summary.sourceMix.map((row) => (
            <tr key={`${row.sourceCategory}:${row.sourceName}:${row.referrerDomain}`}>
              <td>
                <strong>{formatSourceName(row.sourceName)}</strong>
                <span>{row.referrerDomain === "unknown" ? "" : row.referrerDomain}</span>
              </td>
              <td>{formatSourceCategory(row.sourceCategory)}</td>
              <td>{formatCount(row.pageViews)}</td>
              <td>{formatCount(row.visitors)}</td>
              <td>
                <InlineBar value={row.share} label={formatPercent(row.share)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GscRowsTable({
  keyLabel,
  rows,
  transformKey = (value) => value
}: {
  keyLabel: string;
  rows: GscMetricRow[];
  transformKey?: (value: string) => string;
}) {
  if (!rows.length) {
    return <p className="analytics-empty">No GSC rows in this window.</p>;
  }

  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead>
          <tr>
            <th>{keyLabel}</th>
            <th>Clicks</th>
            <th>Impr.</th>
            <th>CTR</th>
            <th>Pos.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{transformKey(row.key)}</td>
              <td>{formatCount(row.clicks)}</td>
              <td>{formatCount(row.impressions)}</td>
              <td>{formatPercent(row.ctr)}</td>
              <td>{formatDecimal(row.position)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FunnelTable({ summary }: { summary: PrivateAnalyticsSummary }) {
  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table analytics-table--bars">
        <thead>
          <tr>
            <th>Step</th>
            <th>Count</th>
            <th>Step rate</th>
          </tr>
        </thead>
        <tbody>
          {summary.funnel.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{formatCount(row.count)}</td>
              <td>
                <InlineBar value={row.share} label={formatPercent(row.share)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineBar({ label, value }: { label: string; value: number }) {
  const width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  return (
    <span className="analytics-inline-bar">
      <span style={{ width }} />
      <em>{label}</em>
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 0);
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = max ? 36 - (value / max) * 32 : 36;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      className="analytics-sparkline"
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 100 40"
    >
      <polyline points={points} />
    </svg>
  );
}

async function loadAnalyticsRows(since: Date) {
  if (!hasAnalyticsStore()) {
    return [];
  }

  try {
    return await listMirroredAnalyticsEvents(since);
  } catch {
    return [];
  }
}

function normalizePeriod(value: string | undefined): AnalyticsPeriod {
  return value === "week" || value === "month" ? value : "day";
}

function getWindowDays(period: AnalyticsPeriod): number {
  if (period === "month") return 180;
  if (period === "week") return 90;
  return 30;
}

function formatPeriod(period: AnalyticsPeriod): string {
  if (period === "day") return "Daily";
  if (period === "week") return "Weekly";
  return "Monthly";
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Toronto"
  }).format(new Date(value));
}

function formatCountry(countryCode: string, countryName: string): string {
  return countryCode === "unknown" ? countryName : `${countryName} (${countryCode})`;
}

function formatGscCountry(value: string): string {
  return value.toUpperCase();
}

function formatDeviceType(value: string): string {
  if (value === "mobile") return "Mobile";
  if (value === "desktop") return "Desktop";
  if (value === "bot") return "Bot";
  return "Unknown";
}

function formatLocale(value: string | undefined): string {
  if (!value || value === "unknown") return "Unknown";
  const labels: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    ms: "Malay",
    nl: "Dutch",
    pl: "Polish",
    zh: "Chinese"
  };
  return labels[value] ?? value.toUpperCase();
}

function formatSourceCategory(value: string): string {
  if (value === "ai") return "AI";
  if (value === "search") return "Search";
  if (value === "social") return "Social";
  if (value === "campaign") return "Campaign";
  if (value === "referral") return "Referral";
  if (value === "direct") return "Direct";
  return "Unknown";
}

function formatSourceName(value: string): string {
  if (value === "chatgpt") return "ChatGPT";
  if (value === "duckduckgo") return "DuckDuckGo";
  if (value === "direct") return "Direct";
  if (value === "unknown") return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent"
  }).format(value);
}

function formatDecimal(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1
  }).format(value);
}

function safeRate(value: number, total: number): number {
  return total ? value / total : 0;
}
