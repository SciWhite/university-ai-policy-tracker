import type { Metadata } from "next";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import {
  hasAnalyticsStore,
  listMirroredAnalyticsEvents
} from "@/lib/analytics-store";
import { buildPrivateAnalyticsSummary } from "@/lib/private-analytics";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const WINDOW_DAYS = 30;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;
const title = "Private analytics | University AI Policy Tracker";
const description =
  "Private mirrored analytics for the public site. Access is restricted and the page is not indexed.";

export const dynamic = "force-dynamic";

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

export default async function PrivateAnalyticsPage() {
  const since = new Date(Date.now() - WINDOW_MS);
  const analyticsStoreAvailable = hasAnalyticsStore();
  const rows = await loadAnalyticsRows(since);
  const summary = buildPrivateAnalyticsSummary(rows, since);

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Private analytics</p>
        <h1>First-party mirrored analytics</h1>
        <p className="lead">
          A private, basic-auth protected view of page views and custom events
          mirrored from the public site over the last {WINDOW_DAYS} days.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Window">{WINDOW_DAYS} days</MetaLabel>
          <MetaLabel label="Access">Basic auth</MetaLabel>
          <MetaLabel label="Source">First-party mirror</MetaLabel>
          <MetaLabel label="Scope">Page views + events</MetaLabel>
        </div>
      </section>

      <section className="answer-strip" aria-label="Private analytics summary">
        <article className="answer-card">
          <h2>What this shows</h2>
          <p>
            Mirrored page views, visitor/session counts, search submissions,
            and downstream engagement from the public site.
          </p>
        </article>
        <article className="answer-card">
          <h2>What this excludes</h2>
          <p>
            It reads only the first-party mirror and does not expose this page
            publicly or index it in robots.
          </p>
        </article>
        <article className="answer-card">
          <h2>Identity model</h2>
          <p>
            Visitor and session counts come from anonymous first-party IDs
            stored in the browser for aggregation only.
          </p>
        </article>
      </section>

      {!analyticsStoreAvailable ? (
        <ReferenceBox
          description="Local preview is falling back to an empty dashboard."
          title="Analytics store unavailable"
        >
          <p>
            DATABASE_URL is not set in this environment, so the page cannot
            read mirrored analytics rows yet.
          </p>
        </ReferenceBox>
      ) : null}

      <section className="metrics-grid" aria-label="Private analytics summary metrics">
        <div>
          <span>{formatCount(summary.visitors)}</span>
          <p>Visitors</p>
        </div>
        <div>
          <span>{formatCount(summary.sessions)}</span>
          <p>Sessions</p>
        </div>
        <div>
          <span>{formatCount(summary.pageViews)}</span>
          <p>Page views</p>
        </div>
        <div>
          <span>{formatCount(summary.events)}</span>
          <p>Total events</p>
        </div>
        <div>
          <span>{formatPercent(summary.bounceRate)}</span>
          <p>Bounce rate</p>
        </div>
        <div>
          <span>{formatCount(summary.funnel[0]?.count ?? 0)}</span>
          <p>Search submits</p>
        </div>
        <div>
          <span>{summary.countries[0]?.countryName ?? "Unknown"}</span>
          <p>Top country</p>
        </div>
        <div>
          <span>{formatDeviceSplit(summary.devices)}</span>
          <p>Mobile / desktop</p>
        </div>
        <div>
          <span>{formatLocale(summary.topLanguages[0]?.label)}</span>
          <p>Top language</p>
        </div>
      </section>

      {analyticsStoreAvailable && summary.events === 0 ? (
        <ReferenceBox
          description="The mirror will populate after the first tracked page view or event."
          title="No mirrored events yet"
        >
          <p>Once the public site is exercised, this window will fill in automatically.</p>
        </ReferenceBox>
      ) : null}

      <ReferenceBox
        description="Country is read from Cloudflare when available; old rows appear as unknown."
        title="Countries"
      >
        {summary.countries.length ? (
          <table aria-label="Analytics by country">
            <thead>
              <tr>
                <th>Country</th>
                <th>Page views</th>
                <th>Visitors</th>
                <th>Events</th>
                <th>Primary language</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {summary.countries.map((row) => (
                <tr key={row.countryCode}>
                  <td>{formatCountry(row.countryCode, row.countryName)}</td>
                  <td>{formatCount(row.pageViews)}</td>
                  <td>{formatCount(row.visitors)}</td>
                  <td>{formatCount(row.events)}</td>
                  <td>{formatLocale(row.primaryLocale)}</td>
                  <td>{formatPercent(row.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No country data in this window yet.</p>
        )}
      </ReferenceBox>

      <ReferenceBox
        description="Device type is derived from coarse request headers and does not store the full user agent."
        title="Devices"
      >
        {summary.devices.length ? (
          <table aria-label="Analytics by device type">
            <thead>
              <tr>
                <th>Device</th>
                <th>Page views</th>
                <th>Visitors</th>
                <th>Events</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {summary.devices.map((row) => (
                <tr key={row.deviceType}>
                  <td>{formatDeviceType(row.deviceType)}</td>
                  <td>{formatCount(row.pageViews)}</td>
                  <td>{formatCount(row.visitors)}</td>
                  <td>{formatCount(row.events)}</td>
                  <td>{formatPercent(row.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No device data in this window yet.</p>
        )}
      </ReferenceBox>

      <ReferenceBox
        description="Page-view language split by country for localization decisions."
        title="Country x language"
      >
        {summary.countryLanguages.length ? (
          <table aria-label="Analytics by country and page language">
            <thead>
              <tr>
                <th>Country</th>
                <th>Language</th>
                <th>Page views</th>
                <th>Visitors</th>
                <th>Country share</th>
              </tr>
            </thead>
            <tbody>
              {summary.countryLanguages.map((row) => (
                <tr key={`${row.countryCode}:${row.locale}`}>
                  <td>{formatCountry(row.countryCode, row.countryName)}</td>
                  <td>{formatLocale(row.locale)}</td>
                  <td>{formatCount(row.pageViews)}</td>
                  <td>{formatCount(row.visitors)}</td>
                  <td>{formatPercent(row.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No country and language split in this window yet.</p>
        )}
      </ReferenceBox>

      <ReferenceBox
        description="Daily mirrored activity, grouped in America/Toronto."
        title="Daily trend"
      >
        {groupDailyRowsByMonth(summary.daily).length ? (
          <div className="data-list">
            {groupDailyRowsByMonth(summary.daily).map((group) => (
              <details
                className="data-list-row"
                key={group.month}
                open={group.isCurrentMonth}
              >
                <summary>
                  <strong>{group.label}</strong>
                  <span>
                    {formatCount(group.pageViews)} page views ·{" "}
                    {formatCount(group.visitors)} visitors ·{" "}
                    {formatCount(group.events)} events
                  </span>
                </summary>
                <table aria-label={`Daily analytics trend for ${group.label}`}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Page views</th>
                      <th>Visitors</th>
                      <th>Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        <td>{formatCount(row.pageViews)}</td>
                        <td>{formatCount(row.visitors)}</td>
                        <td>{formatCount(row.events)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>
        ) : (
          <p>No mirrored daily activity in this window yet.</p>
        )}
      </ReferenceBox>

      <ReferenceBox description="Step-by-step path volume." title="Funnel">
        <DataList>
          {summary.funnel.map((row) => (
            <DataListRow
              key={row.label}
              metadata={
                <>
                  <MetaLabel label="Count">{formatCount(row.count)}</MetaLabel>
                  <MetaLabel label="Share">{formatPercent(row.share)}</MetaLabel>
                </>
              }
            >
              <h2>{row.label}</h2>
              <p>{funnelDescription(row.label)}</p>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox description="Most visited paths from mirrored page views." title="Top pages">
        <DataList>
          {summary.topPages.map((row) => (
            <DataListRow
              key={row.label}
              metadata={
                <>
                  <MetaLabel label="Views">{formatCount(row.count)}</MetaLabel>
                  <MetaLabel label="Share">{formatPercent(row.share)}</MetaLabel>
                </>
              }
            >
              <h2>{row.label}</h2>
              <p>Mirrored page views for this path.</p>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox description="Most active entity slugs in the mirrored event stream." title="Top entities">
        <DataList>
          {summary.topEntities.map((row) => (
            <DataListRow
              key={row.label}
              metadata={
                <>
                  <MetaLabel label="Hits">{formatCount(row.count)}</MetaLabel>
                  <MetaLabel label="Share">{formatPercent(row.share)}</MetaLabel>
                </>
              }
            >
              <h2>{row.label}</h2>
              <p>Entity slug observed in tracked events.</p>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox description="External hostnames observed in tracked links." title="Top source domains">
        <DataList>
          {summary.topDomains.map((row) => (
            <DataListRow
              key={row.label}
              metadata={
                <>
                  <MetaLabel label="Hits">{formatCount(row.count)}</MetaLabel>
                  <MetaLabel label="Share">{formatPercent(row.share)}</MetaLabel>
                </>
              }
            >
              <h2>{row.label}</h2>
              <p>Source domain observed in mirrored events.</p>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox description="High-volume custom event names." title="Top events">
        <DataList>
          {summary.topEvents.map((row) => (
            <DataListRow
              key={row.label}
              metadata={
                <>
                  <MetaLabel label="Events">{formatCount(row.count)}</MetaLabel>
                  <MetaLabel label="Share">{formatPercent(row.share)}</MetaLabel>
                </>
              }
            >
              <h2>{row.label}</h2>
              <p>Mirrored event count in the selected window.</p>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox description="Recent mirrored activity." title="Recent events">
        <DataList>
          {summary.recent.map((row) => (
            <DataListRow
              key={row.id}
              metadata={
                <>
                  <MetaLabel label="When">
                    {formatDateTime(row.createdAt)}
                  </MetaLabel>
                  <MetaLabel label="Source">{row.source}</MetaLabel>
                  <MetaLabel label="Page type">
                    {row.pageType ?? "unknown"}
                  </MetaLabel>
                </>
              }
            >
              <h2>{row.eventName}</h2>
              <p>{row.pathname}</p>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>
    </main>
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

function funnelDescription(label: string): string {
  switch (label) {
    case "Search submits":
      return "Searches submitted from the public site.";
    case "Result clicks":
      return "Autocomplete and search-result clicks.";
    case "Record / source opens":
      return "Canonical, JSON, and official source opens.";
    case "Citation copies":
      return "Citation and URL copy actions.";
    case "API / JSON discovery":
      return "API and JSON link discovery events.";
    default:
      return "Tracked event volume.";
  }
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto"
  }).format(new Date(value));
}

function formatCountry(countryCode: string, countryName: string): string {
  return countryCode === "unknown" ? countryName : `${countryName} (${countryCode})`;
}

function formatDeviceSplit(
  devices: Array<{ deviceType: string; pageViews: number }>
): string {
  const mobile = devices.find((row) => row.deviceType === "mobile")?.pageViews ?? 0;
  const desktop = devices.find((row) => row.deviceType === "desktop")?.pageViews ?? 0;
  const total = mobile + desktop;
  if (!total) return "Unknown";
  return `${formatPercent(mobile / total)} mobile`;
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

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent"
  }).format(value);
}

function groupDailyRowsByMonth(
  rows: Array<{
    date: string;
    events: number;
    pageViews: number;
    visitors: number;
  }>
) {
  const currentMonth = formatAnalyticsMonth(new Date());
  const groups = new Map<
    string,
    {
      events: number;
      isCurrentMonth: boolean;
      label: string;
      month: string;
      pageViews: number;
      rows: typeof rows;
      visitors: number;
    }
  >();

  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const group =
      groups.get(month) ??
      {
        events: 0,
        isCurrentMonth: month === currentMonth,
        label: formatMonthLabel(row.date),
        month,
        pageViews: 0,
        rows: [],
        visitors: 0
      };

    group.events += row.events;
    group.pageViews += row.pageViews;
    group.visitors += row.visitors;
    group.rows.push(row);
    groups.set(month, group);
  }

  return Array.from(groups.values()).sort((left, right) =>
    right.month.localeCompare(left.month)
  );
}

function formatAnalyticsMonth(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "America/Toronto",
    year: "numeric"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  return `${year}-${month}`;
}

function formatMonthLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "America/Toronto",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00-04:00`));
}
