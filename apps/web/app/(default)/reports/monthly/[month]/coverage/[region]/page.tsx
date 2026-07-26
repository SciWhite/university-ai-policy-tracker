import Link from "next/link";
import { notFound } from "next/navigation";
import { MetaLabel } from "@/components/meta-label";
import { monthlyReportSlugs } from "@/lib/monthly-report-registry";
import {
  formatReportDate,
  getMonthlyReport,
  getMonthlyReportCoverageGroup,
  getMonthlyReportCoverageSlug
} from "@/lib/reports";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { ReportCoverageTable } from "../../report-coverage-table";

interface MonthlyReportCoveragePageProps {
  params: Promise<{
    month: string;
    region: string;
  }>;
}

export const dynamic = "force-static";
// dynamicParams stays on so unknown months/regions render through the page,
// hit notFound(), and get the branded group 404 with a real 404 status.
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  const params = await Promise.all(
    monthlyReportSlugs.map(async (month) => {
      const report = await getMonthlyReport(month);

      return (
        report?.coverageGroups.map((group) => ({
          month,
          region: getMonthlyReportCoverageSlug(group)
        })) ?? []
      );
    })
  );

  return params.flat();
}

export async function generateMetadata({
  params
}: MonthlyReportCoveragePageProps) {
  const { month, region } = await params;
  const coverage = await getMonthlyReportCoverageGroup(month, region);
  const canonical = getAbsoluteSiteUrl(
    `/reports/monthly/${month}/coverage/${region}`
  );

  return {
    title: coverage
      ? `${coverage.group.macroRegion} Coverage Appendix | ${coverage.report.title}`
      : "Coverage appendix not found",
    description: coverage
      ? `${coverage.group.macroRegion} university coverage appendix for ${coverage.report.title}, including public records, JSON links, source counts, and last checked dates.`
      : "Monthly University AI Policy Tracker coverage appendix not found.",
    alternates: getLocalizedAlternates(
      `/reports/monthly/${month}/coverage/${region}`,
      "en"
    ),
    openGraph: {
      title: coverage
        ? `${coverage.group.macroRegion} Coverage Appendix | ${coverage.report.title}`
        : "Coverage appendix not found",
      description: coverage
        ? `${coverage.group.macroRegion} university coverage appendix for ${coverage.report.title}.`
        : "Monthly University AI Policy Tracker coverage appendix not found.",
      type: "article",
      url: canonical
    }
  };
}

export default async function MonthlyReportCoveragePage({
  params
}: MonthlyReportCoveragePageProps) {
  const { month, region } = await params;
  const coverage = await getMonthlyReportCoverageGroup(month, region);

  if (!coverage) {
    notFound();
    return null;
  }

  const { group, report } = coverage;

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Monthly report appendix</p>
        <h1>{group.macroRegion} university coverage</h1>
        <p className="lead">
          Crawlable coverage appendix for {report.title}. It keeps the main
          report lighter on mobile while preserving all public university rows
          for readers, search, and answer-engine retrieval.
        </p>
        <div className="tag-row hero-meta" aria-label="Appendix metadata">
          <MetaLabel label="Report">{report.releaseId}</MetaLabel>
          <MetaLabel label="Published">
            {formatReportDate(report.publishedAt)}
          </MetaLabel>
          <MetaLabel label="Records">{group.universityCount}</MetaLabel>
          <MetaLabel label="Countries/regions">{group.countryCount}</MetaLabel>
          <MetaLabel label="City/campus groups">
            {group.cityGroups.length}
          </MetaLabel>
        </div>
        <div className="tag-row hero-actions">
          <Link className="site-action" href={report.canonicalPath}>
            Back to report
          </Link>
          <a className="site-action" href={report.chartDataPath}>
            Chart JSON
          </a>
        </div>
      </section>

      <ReportCoverageTable group={group} />
    </main>
  );
}
