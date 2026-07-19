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
import { normalizeLocale } from "@/lib/i18n";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";

const title = "Reports | University AI Policy Tracker";
const description =
  "Monthly dataset reports, public feeds, outreach assets, and citation-safe summaries for the University AI Policy Tracker evidence database.";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/reports");

  return {
    title,
    description,
    alternates: {
      ...getLocalizedAlternates("/reports", "en"),
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

export default async function ReportsPage({
  params
}: {
  params?: Promise<{ locale?: string }>;
} = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const reports = await getReportsIndex(locale);
  const latestReport = reports[0];

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Reports</p>
        <h1>Dataset reports and public distribution assets</h1>
        <p className="lead">
          Citation-ready release summaries, feeds, chart data, and outreach
          packages derived from the public dataset.
        </p>
      </section>

      <section className="answer-strip" aria-label="Reports answer blocks">
        <article className="answer-card">
          <h2>What reports summarize</h2>
          <p>
            Reports summarize public dataset releases, distributions, chart
            data, outreach copy, and citation-safe public records.
          </p>
        </article>
        <article className="answer-card">
          <h2>What reports do not claim</h2>
          <p>
            Reports do not provide legal advice, academic integrity advice, or
            official university policy conclusions.
          </p>
        </article>
        <article className="answer-card">
          <h2>How to reuse reports</h2>
          <p>
            Cite the report page with public JSON, chart data, release metadata,
            and the underlying university records when making claim-level use.
          </p>
        </article>
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
        description="Published reports summarize public data only."
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
                    {formatReportDate(report.publishedAt, locale)}
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
        description="Machine-readable report and change surfaces."
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
        className="compact-reference-box"
        description="Reusable copy with risk boundaries."
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
            <p>Descriptions, newsletter copy, email text, and social copy.</p>
          </DataListRow>
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        className="compact-reference-box"
        description="Same public contracts as the rest of the site."
        title="Distribution contract"
      >
        <ul className="compact-list">
          <li>
            Distinguish reviewed claims from candidate or needs-review records.
          </li>
          <li>
            Original-language evidence remains canonical.
          </li>
          <li>The tracker does not provide legal or academic integrity advice.</li>
          <li>
            Dataset releases, chart data, and JSON stay versioned under{" "}
            <code>/api/public/v1</code>.
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
