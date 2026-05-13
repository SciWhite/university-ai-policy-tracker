import {
  NO_ADVICE_BOUNDARY,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE
} from "@uapt/shared";
import { getChangeRecords, type ChangeRecord } from "./change-records";
import { getDatasetRelease } from "./dataset-release";
import { getAbsoluteSiteUrl } from "./site-url";

export const currentMonthlyReportSlug = "2026-05";

export interface ReportDataLink {
  description: string;
  label: string;
  path: string;
  url: string;
}

export interface ReportMetric {
  label: string;
  value: string;
}

export interface ReportChartDatum {
  label: string;
  value: number;
}

export interface MonthlyReport {
  canonicalPath: string;
  canonicalUrl: string;
  chartDataPath: string;
  chartDataUrl: string;
  dataLinks: ReportDataLink[];
  description: string;
  examples: ChangeRecord[];
  feedPath: string;
  feedUrl: string;
  license: string;
  limitations: string[];
  metrics: {
    candidateClaimCount: number;
    changedInstitutionCount: number;
    checkedInstitutionCount: number;
    claimCount: number;
    datasetArtifactCount: number;
    evidenceRecordCount: number;
    publicUniversityCount: number;
    reviewedClaimCount: number;
    sourceCount: number;
  };
  metricCards: ReportMetric[];
  methodologyLinks: ReportDataLink[];
  ogImagePath: string;
  ogImageUrl: string;
  publishedAt: string;
  releaseId: string;
  releasePeriod: string;
  reviewStateChart: ReportChartDatum[];
  slug: string;
  sourceLanguageChart: ReportChartDatum[];
  summaryBullets: string[];
  title: string;
}

export interface OutreachAsset {
  body: string;
  label: string;
}

export interface OutreachPackage {
  assets: OutreachAsset[];
  canonicalPath: string;
  canonicalUrl: string;
  description: string;
  title: string;
}

export async function getMonthlyReport(
  slug = currentMonthlyReportSlug
): Promise<MonthlyReport | undefined> {
  if (slug !== currentMonthlyReportSlug) return undefined;

  const [datasetRelease, changeRecords] = await Promise.all([
    getDatasetRelease(),
    getChangeRecords()
  ]);
  const { manifest } = datasetRelease;
  const canonicalPath = `/reports/${slug}`;
  const chartDataPath = `/api/public/${PUBLIC_API_VERSION}/reports/${slug}/chart-data.json`;
  const checkedInstitutionCount = changeRecords.filter(
    (record) => record.lastCheckedAt
  ).length;
  const changedInstitutionCount = changeRecords.filter(
    (record) => record.lastChangedAt
  ).length;
  const reviewedClaimCount = changeRecords.reduce(
    (total, record) => total + record.reviewedClaimCount,
    0
  );
  const candidateClaimCount = changeRecords.reduce(
    (total, record) => total + record.candidateClaimCount,
    0
  );
  const examples = [...changeRecords]
    .sort(compareReportExamples)
    .slice(0, 8);
  const title = "University AI Policy Dataset Baseline Report: May 2026";
  const description =
    "A citation-ready baseline report for the May 2026 University AI Policy Tracker public dataset release, including source-backed coverage, review states, public artifacts, and methodology links.";

  return {
    slug,
    title,
    description,
    canonicalPath,
    canonicalUrl: getAbsoluteSiteUrl(canonicalPath),
    chartDataPath,
    chartDataUrl: getAbsoluteSiteUrl(chartDataPath),
    feedPath: "/feeds/reports.xml",
    feedUrl: getAbsoluteSiteUrl("/feeds/reports.xml"),
    ogImagePath: `${canonicalPath}/opengraph-image`,
    ogImageUrl: getAbsoluteSiteUrl(`${canonicalPath}/opengraph-image`),
    releaseId: manifest.releaseId,
    releasePeriod: manifest.releasePeriod,
    publishedAt: manifest.publishedAt,
    license: TRACKER_METADATA_LICENSE,
    limitations: manifest.limitations.length
      ? manifest.limitations
      : [NO_ADVICE_BOUNDARY],
    metrics: {
      publicUniversityCount: manifest.counts.universities,
      checkedInstitutionCount,
      changedInstitutionCount,
      claimCount: manifest.counts.claims,
      reviewedClaimCount,
      candidateClaimCount,
      sourceCount: manifest.counts.sources,
      evidenceRecordCount: manifest.counts.evidenceRecords,
      datasetArtifactCount: manifest.artifacts.length
    },
    metricCards: [
      {
        label: "public university records",
        value: manifest.counts.universities.toLocaleString("en-US")
      },
      {
        label: "records checked in release",
        value: checkedInstitutionCount.toLocaleString("en-US")
      },
      {
        label: "records with changed dates",
        value: changedInstitutionCount.toLocaleString("en-US")
      },
      {
        label: "source-backed claims",
        value: manifest.counts.claims.toLocaleString("en-US")
      },
      {
        label: "evidence records",
        value: manifest.counts.evidenceRecords.toLocaleString("en-US")
      }
    ],
    sourceLanguageChart: toChartData(manifest.counts.sourceLanguages),
    reviewStateChart: toChartData(manifest.counts.reviewStates),
    examples,
    summaryBullets: [
      `This is a baseline release for ${manifest.releasePeriod}, not a longitudinal trend claim.`,
      `${checkedInstitutionCount.toLocaleString("en-US")} public university records include checked dates and ${changedInstitutionCount.toLocaleString("en-US")} currently expose changed dates.`,
      `${reviewedClaimCount.toLocaleString("en-US")} claims are marked as reviewed by an agent or human review state; ${candidateClaimCount.toLocaleString("en-US")} claims remain candidate or otherwise not reviewed.`,
      "Original-language evidence snippets remain canonical. Localized display text is only a helper layer.",
      "The tracker publishes metadata and evidence bindings; it does not provide legal advice or academic integrity advice."
    ],
    dataLinks: [
      {
        label: "Reports index",
        description:
          "Machine-readable report index with report URLs, metrics, data links, feed links, and outreach discovery.",
        path: `/api/public/${PUBLIC_API_VERSION}/reports/index.json`,
        url: getAbsoluteSiteUrl(
          `/api/public/${PUBLIC_API_VERSION}/reports/index.json`
        )
      },
      {
        label: "Dataset release manifest",
        description:
          "Release metadata, counts, artifacts, checksums, citation, limitations, and source-rights caveats.",
        path: `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`,
        url: getAbsoluteSiteUrl(
          `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`
        )
      },
      {
        label: "Universities JSONL",
        description: "One public university policy record per JSONL row.",
        path: `/api/public/${PUBLIC_API_VERSION}/datasets/universities.jsonl`,
        url: getAbsoluteSiteUrl(
          `/api/public/${PUBLIC_API_VERSION}/datasets/universities.jsonl`
        )
      },
      {
        label: "Claims JSONL",
        description: "Claim-level records with review states and evidence arrays.",
        path: `/api/public/${PUBLIC_API_VERSION}/datasets/claims.jsonl`,
        url: getAbsoluteSiteUrl(
          `/api/public/${PUBLIC_API_VERSION}/datasets/claims.jsonl`
        )
      },
      {
        label: "Recent changes JSON",
        description: "Current recent-changes feed used by the public change pages.",
        path: `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`,
        url: getAbsoluteSiteUrl(
          `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`
        )
      },
      {
        label: "Report chart data",
        description:
          "Small JSON chart payload for source-language and review-state distribution.",
        path: chartDataPath,
        url: getAbsoluteSiteUrl(chartDataPath)
      },
      {
        label: "Outreach package JSON",
        description:
          "Machine-readable media, newsletter, researcher-email, and social copy with use boundaries.",
        path: `/api/public/${PUBLIC_API_VERSION}/reports/outreach.json`,
        url: getAbsoluteSiteUrl(
          `/api/public/${PUBLIC_API_VERSION}/reports/outreach.json`
        )
      }
    ],
    methodologyLinks: [
      {
        label: "Methodology",
        description:
          "How source discovery, snapshots, claim extraction, review states, and limitations work.",
        path: "/methodology",
        url: getAbsoluteSiteUrl("/methodology")
      },
      {
        label: "Citation policy",
        description:
          "Suggested citation formats and the fields needed for reuse.",
        path: "/citation",
        url: getAbsoluteSiteUrl("/citation")
      },
      {
        label: "Datasets",
        description:
          "Public API, release artifacts, rights caveats, and checksums.",
        path: "/datasets",
        url: getAbsoluteSiteUrl("/datasets")
      },
      {
        label: "Outreach package",
        description:
          "Short blurbs and email copy for researchers, newsletters, and media citation.",
        path: "/reports/outreach",
        url: getAbsoluteSiteUrl("/reports/outreach")
      }
    ]
  };
}

export async function getReportsIndex(): Promise<MonthlyReport[]> {
  const report = await getMonthlyReport();

  return report ? [report] : [];
}

export async function getOutreachPackage(): Promise<OutreachPackage> {
  const report = await getMonthlyReport();
  const reportUrl = report?.canonicalUrl ?? getAbsoluteSiteUrl("/reports");
  const datasetUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`
  );
  const methodologyUrl = getAbsoluteSiteUrl("/methodology");
  const citationUrl = getAbsoluteSiteUrl("/citation");

  return {
    title: "Outreach Package | University AI Policy Tracker",
    description:
      "Reusable, citation-safe copy for researchers, newsletters, teaching centers, library guides, and education media.",
    canonicalPath: "/reports/outreach",
    canonicalUrl: getAbsoluteSiteUrl("/reports/outreach"),
    assets: [
      {
        label: "One-sentence positioning",
        body:
          "University AI Policy Tracker is an open, evidence-backed database of university AI policy records, with source URLs, review states, change history, and versioned public JSON."
      },
      {
        label: "Newsletter blurb",
        body: `University AI Policy Tracker has published a May 2026 baseline release for university AI policy records. The project is built as a public evidence database rather than a blog: each record is tied to official source URLs, source-language evidence snippets, review-state labels, citation guidance, and versioned public JSON. Report: ${reportUrl} Dataset manifest: ${datasetUrl}`
      },
      {
        label: "Researcher email",
        body: `Hi [Name],\n\nI am building University AI Policy Tracker, an open evidence database for university AI policies. The project keeps policy claims separate from their source evidence, preserves original-language snippets as canonical evidence, and exposes versioned public JSON for reuse.\n\nThe May 2026 baseline report is here: ${reportUrl}\nMethodology: ${methodologyUrl}\nCitation guidance: ${citationUrl}\n\nFeedback on missing sources, methodology, or data fields would be very welcome.`
      },
      {
        label: "Social post",
        body: `New baseline release: University AI Policy Tracker is publishing source-backed university AI policy records with review states, change logs, public JSON, and citation guidance.\n\nReport: ${reportUrl}\nDataset: ${datasetUrl}\n\nNot legal advice or academic integrity advice; original university sources remain canonical.`
      }
    ]
  };
}

export function formatReportDate(value: string | undefined): string {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function compareReportExamples(
  left: ChangeRecord,
  right: ChangeRecord
): number {
  return (
    right.reviewedClaimCount - left.reviewedClaimCount ||
    right.claimCount - left.claimCount ||
    right.sourceCount - left.sourceCount ||
    left.name.localeCompare(right.name)
  );
}

function toChartData(record: Record<string, number>): ReportChartDatum[] {
  return Object.entries(record)
    .map(([label, value]) => ({ label, value }))
    .sort(
      (left, right) =>
        right.value - left.value || left.label.localeCompare(right.label)
    );
}
