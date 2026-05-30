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
  const canonical = getAbsoluteSiteUrl(
    `/reports/monthly/${currentMonthlyReportSlug}`
  );

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

export default async function May2026MonthlyReportPage() {
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
            "open dataset",
            "AI answer engine retrieval"
          ],
          image: report.ogImageUrl,
          citation: reportCitation
        }}
      />

      <section className="hero">
        <p className="kicker">Monthly report</p>
        <h1>{report.title}</h1>
        <p className="lead">{report.description}</p>
        <p>{report.summaryIntro}</p>
        <div className="tag-row hero-meta" aria-label="Report metadata">
          <MetaLabel label="Release">{report.releaseId}</MetaLabel>
          <MetaLabel label="Period">{report.releasePeriod}</MetaLabel>
          <MetaLabel label="Published">
            {formatReportDate(report.publishedAt)}
          </MetaLabel>
          <MetaLabel label="Type">Monthly GEO baseline</MetaLabel>
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

      <section className="answer-strip" aria-label="GEO answer blocks">
        {report.geoAnswerBlocks.map((block) => (
          <article className="answer-card" id={block.id} key={block.id}>
            <h2>{block.question}</h2>
            <p>{block.answer}</p>
          </article>
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
        description="A reusable summary for citation, AI retrieval, newsletters, and media contexts."
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
        <div className="metrics-grid metrics-grid--compact" aria-label="Chart data summary">
          <div>
            <span>{report.metrics.reviewedClaimCount}</span>
            <p>reviewed claims</p>
          </div>
          <div>
            <span>{report.metrics.candidateClaimCount}</span>
            <p>candidate or non-reviewed claims</p>
          </div>
          <div>
            <span>{report.coverageSummary.macroRegionCount}</span>
            <p>macro regions</p>
          </div>
          <div>
            <span>{report.coverageSummary.cityCampusRegionCount}</span>
            <p>city or campus groups</p>
          </div>
        </div>
        <DataList>
          <DataListRow
            actions={<a href={report.chartDataPath}>Open JSON</a>}
            metadata={<MetaLabel label="Format">JSON</MetaLabel>}
          >
            <h2>Monthly report chart data</h2>
            <p>
              Source-language, review-state, macro-region, city/campus-region,
              and ranking coverage distributions for downstream charts, slides,
              newsletters, and reproducible summaries.
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
        description="All public university records in this baseline, grouped for AI answer engine retrieval. Ranking labels are discovery context only, not policy quality or compliance scores."
        title="All university coverage"
      >
        <ul className="compact-link-list" aria-label="Macro-region anchors">
          {report.coverageGroups.map((group) => (
            <li key={group.macroRegion}>
              <a href={`#${group.anchorId}`}>
                {group.macroRegion} ({group.universityCount})
              </a>
            </li>
          ))}
        </ul>

        <div className="coverage-region-list">
          {report.coverageGroups.map((group) => (
            <section
              className="coverage-region"
              id={group.anchorId}
              key={group.macroRegion}
            >
              <h2>{group.macroRegion}</h2>
              <p className="table-summary">
                {group.universityCount.toLocaleString("en-US")} university
                records across {group.countryCount.toLocaleString("en-US")}{" "}
                country or region labels.
              </p>
              {group.cityGroups.map((cityGroup) => (
                <section
                  className="coverage-city"
                  id={cityGroup.anchorId}
                  key={`${group.macroRegion}-${cityGroup.cityCampusRegion}`}
                >
                  <h3>{cityGroup.cityCampusRegion}</h3>
                  <p className="table-summary">
                    {cityGroup.universityCount.toLocaleString("en-US")} records
                    across {cityGroup.countryCount.toLocaleString("en-US")}{" "}
                    country or region labels.
                  </p>
                  <div className="reference-table-wrap">
                    <table className="reference-table report-coverage-table">
                      <thead>
                        <tr>
                          <th scope="col">University</th>
                          <th scope="col">Country/region</th>
                          <th scope="col">Ranking label</th>
                          <th scope="col">Claims</th>
                          <th scope="col">Sources</th>
                          <th scope="col">Last checked</th>
                          <th scope="col">Links</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cityGroup.rows.map((row) => (
                          <tr key={row.slug}>
                            <td>
                              <Link className="table-record-title" href={row.recordUrl}>
                                {row.name}
                              </Link>
                            </td>
                            <td>{row.countryOrRegion}</td>
                            <td>{row.rankingLabel}</td>
                            <td>{row.claimCount}</td>
                            <td>{row.sourceCount}</td>
                            <td>{formatReportDate(row.lastCheckedAt)}</td>
                            <td>
                              <span className="table-record-meta">
                                <Link href={row.recordUrl}>Record</Link>
                                <a href={row.publicJsonUrl}>JSON</a>
                                <Link href={row.changeUrl}>Changes</Link>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </section>
          ))}
        </div>
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
          <li>
            Ranking labels in this report are used only for coverage ordering
            and discovery context. They are not policy quality, safety,
            compliance, maturity, or strictness scores.
          </li>
        </ul>
      </ReferenceBox>
    </main>
  );
}
