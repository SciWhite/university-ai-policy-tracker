import Link from "next/link";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { CitationCopyActions } from "@/components/citation-copy-actions";
import { DataList, DataListRow } from "@/components/data-list";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  currentMonthlyReportSlug,
  formatReportDate,
  getMonthlyReport
} from "@/lib/reports";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export async function generateMetadata() {
  const report = await getMonthlyReport(currentMonthlyReportSlug);
  const canonical = getAbsoluteSiteUrl(`/reports/${currentMonthlyReportSlug}`);

  return {
    title: report?.title ?? "Monthly Report | University AI Policy Tracker",
    description:
      report?.description ??
      "Monthly University AI Policy Tracker dataset report.",
    alternates: { canonical },
    openGraph: {
      title: report?.title,
      description: report?.description,
      images: report?.ogImageUrl ? [report.ogImageUrl] : undefined,
      type: "article",
      url: canonical
    }
  };
}

export default async function May2026ReportPage() {
  const report = await getMonthlyReport(currentMonthlyReportSlug);

  if (!report) return null;

  const reportCitation = `University AI Policy Tracker. "${report.title}." Published ${formatReportDate(
    report.publishedAt
  )}. ${report.canonicalUrl}`;

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Report",
          name: report.title,
          description: report.description,
          url: report.canonicalUrl,
          datePublished: report.publishedAt,
          isAccessibleForFree: true,
          license: "https://creativecommons.org/licenses/by/4.0/",
          publisher: {
            "@type": "Organization",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          about: [
            "university AI policy",
            "generative AI policy",
            "higher education policy",
            "open dataset"
          ],
          image: report.ogImageUrl,
          citation: reportCitation
        }}
      />

      <section className="hero">
        <p className="kicker">Monthly report</p>
        <h1>{report.title}</h1>
        <p className="lead">{report.description}</p>
        <div className="tag-row" aria-label="Report metadata">
          <MetaLabel label="Release">{report.releaseId}</MetaLabel>
          <MetaLabel label="Period">{report.releasePeriod}</MetaLabel>
          <MetaLabel label="Published">
            {formatReportDate(report.publishedAt)}
          </MetaLabel>
          <MetaLabel label="License">{report.license}</MetaLabel>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Dataset report metrics">
        {report.metricCards.map((metric) => (
          <div key={metric.label}>
            <span>{metric.value}</span>
            <p>{metric.label}</p>
          </div>
        ))}
      </section>

      <ReferenceBox
        actions={
          <CitationCopyActions
            canonicalUrl={report.canonicalUrl}
            citationText={reportCitation}
            publicJsonUrl={report.chartDataUrl}
          />
        }
        description="A reusable summary for citation, newsletter, and media contexts."
        title="Citation-ready summary"
      >
        <ul className="compact-list">
          {report.summaryBullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </ReferenceBox>

      <ReferenceBox
        description="Small chart-ready distributions exposed on the page and as JSON."
        title="Chart assets"
      >
        <div className="metrics-grid" aria-label="Chart data summary">
          <div>
            <span>{report.metrics.reviewedClaimCount}</span>
            <p>reviewed claims</p>
          </div>
          <div>
            <span>{report.metrics.candidateClaimCount}</span>
            <p>candidate or non-reviewed claims</p>
          </div>
          <div>
            <span>{report.sourceLanguageChart.length}</span>
            <p>source language buckets</p>
          </div>
          <div>
            <span>{report.reviewStateChart.length}</span>
            <p>review-state buckets</p>
          </div>
        </div>
        <DataList>
          <DataListRow
            actions={<a href={report.chartDataPath}>Open JSON</a>}
            metadata={<MetaLabel label="Format">JSON</MetaLabel>}
          >
            <h2>Report chart data</h2>
            <p>
              Source-language and review-state distributions for downstream
              charts, slides, newsletters, and reproducible summaries.
            </p>
          </DataListRow>
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="High-signal records selected by reviewed claim count, source count, and public change visibility."
        title="Example institution records"
      >
        <DataList>
          {report.examples.map((record) => (
            <DataListRow
              actions={
                <>
                  <Link href={record.universityUrl}>Record</Link>
                  <Link href={record.changeUrl}>Changes</Link>
                  <a href={record.publicJsonUrl}>JSON</a>
                </>
              }
              key={record.slug}
              metadata={
                <>
                  <StateLabel prefix="" reviewState={record.reviewState} />
                  <MetaLabel label="Claims">{record.claimCount}</MetaLabel>
                  <MetaLabel label="Sources">{record.sourceCount}</MetaLabel>
                  <MetaLabel label="Checked">
                    {formatReportDate(record.lastCheckedAt)}
                  </MetaLabel>
                </>
              }
            >
              <h2>
                <Link href={record.universityUrl}>{record.name}</Link>
              </h2>
              <p>{record.summary}</p>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="Versioned public data used by this report."
        title="Data links"
      >
        {report.dataLinks.map((link) => (
          <ApiEndpointRow
            description={link.description}
            key={link.path}
            label={link.label}
            path={link.path}
            status="Public"
            url={link.url}
          />
        ))}
      </ReferenceBox>

      <ReferenceBox
        description="Methodology and risk boundaries are part of the report surface, not hidden footnotes."
        title="Methodology and limitations"
      >
        <DataList>
          {report.methodologyLinks.map((link) => (
            <DataListRow
              actions={<a href={link.url}>Open</a>}
              key={link.path}
              metadata={<MetaLabel label="Path">{link.path}</MetaLabel>}
            >
              <h2>{link.label}</h2>
              <p>{link.description}</p>
            </DataListRow>
          ))}
        </DataList>
        <ul className="compact-list">
          {report.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </ReferenceBox>
    </main>
  );
}
