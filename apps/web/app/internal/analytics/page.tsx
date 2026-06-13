import type { Metadata } from "next";
import { listAnalyticsEvents } from "@uapt/db";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
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
  const rows = await listAnalyticsEvents(since);
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
            It does not read the Vercel dashboard directly and it does not
            expose this page publicly or index it in robots.
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
      </section>

      {summary.events === 0 ? (
        <ReferenceBox
          description="The mirror will populate after the first tracked page view or event."
          title="No mirrored events yet"
        >
          <p>Once the public site is exercised, this window will fill in automatically.</p>
        </ReferenceBox>
      ) : null}

      <ReferenceBox
        description="Daily mirrored activity, grouped in America/Toronto."
        title="Daily trend"
      >
        <table aria-label="Daily analytics trend">
          <thead>
            <tr>
              <th>Date</th>
              <th>Page views</th>
              <th>Visitors</th>
              <th>Events</th>
            </tr>
          </thead>
          <tbody>
            {summary.daily.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{formatCount(row.pageViews)}</td>
                <td>{formatCount(row.visitors)}</td>
                <td>{formatCount(row.events)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent"
  }).format(value);
}
