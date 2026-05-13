import Link from "next/link";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import {
  formatReportDate,
  getReportsIndex
} from "@/lib/reports";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Reports | University AI Policy Tracker";
const description =
  "Monthly dataset reports, public feeds, outreach assets, and citation-safe summaries for the University AI Policy Tracker evidence database.";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/reports");

  return {
    title,
    description,
    alternates: {
      canonical,
      types: {
        "application/rss+xml": getAbsoluteSiteUrl("/feeds/reports.xml"),
        "application/atom+xml": getAbsoluteSiteUrl("/feeds/atom.xml")
      }
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function ReportsPage() {
  const reports = await getReportsIndex();
  const latestReport = reports[0];

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Reports</p>
        <h1>Dataset reports and public distribution assets</h1>
        <p className="lead">
          Reports turn the evidence database into citation-ready public
          artifacts: baseline releases, change summaries, feed entries, chart
          data, and outreach copy for researchers, newsletters, teaching
          centers, and media.
        </p>
      </section>

      {latestReport ? (
        <section className="metrics-grid" aria-label="Latest report summary">
          {latestReport.metricCards.map((metric) => (
            <div key={metric.label}>
              <span>{metric.value}</span>
              <p>{metric.label}</p>
            </div>
          ))}
        </section>
      ) : null}

      <ReferenceBox
        description="Published reports only summarize the public dataset and keep review state visible."
        title="Published reports"
      >
        <DataList>
          {reports.map((report) => (
            <DataListRow
              actions={
                <>
                  <Link href={report.canonicalPath}>Read report</Link>
                  <a href={report.chartDataPath}>Chart data</a>
                </>
              }
              key={report.slug}
              metadata={
                <>
                  <MetaLabel label="Release">{report.releaseId}</MetaLabel>
                  <MetaLabel label="Published">
                    {formatReportDate(report.publishedAt)}
                  </MetaLabel>
                  <MetaLabel label="Period">{report.releasePeriod}</MetaLabel>
                </>
              }
            >
              <h2>
                <Link href={report.canonicalPath}>{report.title}</Link>
              </h2>
              <p>{report.description}</p>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="Machine-readable feeds for reports and source-check/change updates."
        title="Feeds and public JSON"
      >
        <ApiEndpointRow
          description="Machine-readable reports index with report URLs, metrics, data links, feeds, and outreach discovery."
          label="Reports index JSON"
          path="/api/public/v1/reports/index.json"
          status="Public JSON"
          url="/api/public/v1/reports/index.json"
        />
        <ApiEndpointRow
          description="Machine-readable media, newsletter, researcher-email, and social copy with use boundaries."
          label="Outreach package JSON"
          path="/api/public/v1/reports/outreach.json"
          status="Public JSON"
          url="/api/public/v1/reports/outreach.json"
        />
        <ApiEndpointRow
          description="RSS feed for monthly and periodic dataset reports."
          label="Reports RSS"
          path="/feeds/reports.xml"
          status="Public feed"
          url="/feeds/reports.xml"
        />
        <ApiEndpointRow
          description="RSS feed for recent institution-level source checks and change records."
          label="Recent changes RSS"
          path="/feeds/recent-changes.xml"
          status="Public feed"
          url="/feeds/recent-changes.xml"
        />
        <ApiEndpointRow
          description="Combined Atom feed with report and recent-change entries."
          label="Combined Atom"
          path="/feeds/atom.xml"
          status="Public feed"
          url="/feeds/atom.xml"
        />
      </ReferenceBox>

      <ReferenceBox
        description="Reusable copy for people who want to cite or share the project without overstating the data."
        title="Media and newsletter package"
      >
        <DataList>
          <DataListRow
            actions={<Link href="/reports/outreach">Open package</Link>}
            metadata={<MetaLabel label="Audience">Researchers, media</MetaLabel>}
          >
            <h2>
              <Link href="/reports/outreach">Outreach package</Link>
            </h2>
            <p>
              Short descriptions, newsletter copy, researcher email text, social
              post copy, and risk boundaries for public sharing.
            </p>
          </DataListRow>
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="Reports rely on the same public contracts as the rest of the site."
        title="Distribution contract"
      >
        <ul className="compact-list">
          <li>
            Reports must distinguish reviewed claims from candidate or
            needs-review records.
          </li>
          <li>
            Original-language evidence remains canonical; translated summaries
            are only display helpers.
          </li>
          <li>
            The tracker does not provide legal advice or academic integrity
            advice.
          </li>
          <li>
            Dataset releases, chart data, and public JSON remain versioned under{" "}
            <code>/api/public/v1/...</code>.
          </li>
          <li>
            Report release operations are tracked in{" "}
            <a href="https://github.com/SciWhite/university-ai-policy-tracker/blob/main/docs/report-distribution-playbook.md">
              docs/report-distribution-playbook.md
            </a>
            .
          </li>
        </ul>
      </ReferenceBox>
    </main>
  );
}
