import {
  NO_ADVICE_BOUNDARY,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  type CatalogUniversity,
  type CatalogUniversityRanking
} from "@uapt/shared";
import { getCatalogUniversities } from "./catalog";
import { getChangeRecords, type ChangeRecord } from "./change-records";
import { getDatasetRelease } from "./dataset-release";
import { getAbsoluteSiteUrl } from "./site-url";

export const currentMonthlyReportSlug = "2026-05";
export const currentMonthlyReportPath = `/reports/monthly/${currentMonthlyReportSlug}`;
export const currentMonthlyReportChartDataPath = `/api/public/${PUBLIC_API_VERSION}/reports/monthly/${currentMonthlyReportSlug}/chart-data.json`;

const legacyMonthlyReportPaths: Record<string, string> = {
  "2026-05": "/reports/2026-05"
};

const monthlyReportRegistry = {
  "2026-05": {
    type: "monthly",
    month: "2026-05",
    title: "University AI Policy Dataset Baseline Report: May 2026",
    description:
      "A GEO-ready monthly baseline report for the May 2026 University AI Policy Tracker public dataset release, including source-backed coverage, review states, public artifacts, citation guidance, and an all-university coverage appendix.",
    releaseLabel: "May 2026 baseline",
    summaryIntro:
      "This report is built for AI answer engines, research agents, and citation workflows. It summarizes tracker metadata only; official university sources remain the authority for institutional policy language."
  }
} as const;

const macroRegionOrder = [
  "Africa",
  "Asia",
  "Europe",
  "Latin America",
  "Middle East",
  "North America",
  "Oceania",
  "Other / Unknown"
] as const;

type MonthlyReportSlug = keyof typeof monthlyReportRegistry;
type MacroRegion = (typeof macroRegionOrder)[number];

const countryMacroRegions: Record<string, MacroRegion> = {
  Argentina: "Latin America",
  Australia: "Oceania",
  Austria: "Europe",
  Azerbaijan: "Asia",
  Bahrain: "Middle East",
  Bangladesh: "Asia",
  Belarus: "Europe",
  Belgium: "Europe",
  Brazil: "Latin America",
  Brunei: "Asia",
  Bulgaria: "Europe",
  Canada: "North America",
  Chile: "Latin America",
  "China (Mainland)": "Asia",
  Colombia: "Latin America",
  "Costa Rica": "Latin America",
  Cuba: "Latin America",
  Cyprus: "Europe",
  Czechia: "Europe",
  Denmark: "Europe",
  Ecuador: "Latin America",
  Egypt: "Africa",
  Estonia: "Europe",
  Ethiopia: "Africa",
  Finland: "Europe",
  France: "Europe",
  Germany: "Europe",
  Greece: "Europe",
  "Hong Kong SAR": "Asia",
  Hungary: "Europe",
  Iceland: "Europe",
  India: "Asia",
  Indonesia: "Asia",
  Iran: "Middle East",
  Iraq: "Middle East",
  Ireland: "Europe",
  Israel: "Middle East",
  Italy: "Europe",
  Japan: "Asia",
  Jordan: "Middle East",
  Kazakhstan: "Asia",
  Kenya: "Africa",
  Kuwait: "Middle East",
  Kyrgyzstan: "Asia",
  Latvia: "Europe",
  Lebanon: "Middle East",
  Lithuania: "Europe",
  Luxembourg: "Europe",
  "Macau SAR": "Asia",
  Malaysia: "Asia",
  Malta: "Europe",
  Mexico: "Latin America",
  Netherlands: "Europe",
  "New Zealand": "Oceania",
  Nigeria: "Africa",
  Norway: "Europe",
  Oman: "Middle East",
  Pakistan: "Asia",
  Peru: "Latin America",
  Philippines: "Asia",
  Poland: "Europe",
  Portugal: "Europe",
  Qatar: "Middle East",
  Romania: "Europe",
  Russia: "Europe",
  "Saudi Arabia": "Middle East",
  Serbia: "Europe",
  Singapore: "Asia",
  Slovakia: "Europe",
  "South Africa": "Africa",
  "South Korea": "Asia",
  Spain: "Europe",
  "Sri Lanka": "Asia",
  Sweden: "Europe",
  Switzerland: "Europe",
  Taiwan: "Asia",
  Thailand: "Asia",
  Tunisia: "Africa",
  Türkiye: "Middle East",
  Ukraine: "Europe",
  "United Arab Emirates": "Middle East",
  "United Kingdom": "Europe",
  "United States": "North America",
  Uruguay: "Latin America",
  Venezuela: "Latin America",
  Vietnam: "Asia"
};

const rankingPriority = ["qs", "the", "usnews", "arwu", "cwts"] as const;

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

export interface GeoAnswerBlock {
  answer: string;
  id: string;
  question: string;
}

export interface MonthlyReportCoverageRow {
  changeUrl: string;
  cityCampusRegion: string;
  claimCount: number;
  countryOrRegion: string;
  lastCheckedAt?: string;
  macroRegion: MacroRegion;
  name: string;
  publicJsonUrl: string;
  rankingLabel: string;
  rankingSort: number;
  rankingSystemId?: CatalogUniversityRanking["systemId"];
  rankingSystemName?: string;
  rankingYear?: number | string;
  recordUrl: string;
  slug: string;
  sourceCount: number;
}

export interface MonthlyReportCityGroup {
  anchorId: string;
  cityCampusRegion: string;
  countryCount: number;
  rows: MonthlyReportCoverageRow[];
  universityCount: number;
}

export interface MonthlyReportMacroRegionGroup {
  anchorId: string;
  cityGroups: MonthlyReportCityGroup[];
  countryCount: number;
  macroRegion: MacroRegion;
  universityCount: number;
}

export interface MonthlyReportCoverageSummary {
  cityCampusRegionCount: number;
  countryOrRegionCount: number;
  macroRegionCount: number;
  universityCount: number;
}

export interface MonthlyReportRankingCoverage {
  label: string;
  value: number;
}

export interface MonthlyReport {
  canonicalPath: string;
  canonicalUrl: string;
  chartDataPath: string;
  chartDataUrl: string;
  coverageGroups: MonthlyReportMacroRegionGroup[];
  coverageRows: MonthlyReportCoverageRow[];
  coverageSummary: MonthlyReportCoverageSummary;
  dataLinks: ReportDataLink[];
  description: string;
  examples: ChangeRecord[];
  feedPath: string;
  feedUrl: string;
  geoAnswerBlocks: GeoAnswerBlock[];
  legacyCanonicalPath?: string;
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
  month: string;
  ogImagePath: string;
  ogImageUrl: string;
  publishedAt: string;
  rankingCoverage: MonthlyReportRankingCoverage[];
  releaseId: string;
  releaseLabel: string;
  releasePeriod: string;
  reviewStateChart: ReportChartDatum[];
  slug: string;
  sourceLanguageChart: ReportChartDatum[];
  summaryBullets: string[];
  summaryIntro: string;
  title: string;
  type: "monthly";
}

export function getMonthlyReportCoverageSlug(
  group: MonthlyReportMacroRegionGroup
): string {
  return group.anchorId.replace(/^coverage-/, "");
}

export function getMonthlyReportCoveragePath(
  reportSlug: string,
  group: MonthlyReportMacroRegionGroup
): string {
  return `/reports/monthly/${reportSlug}/coverage/${getMonthlyReportCoverageSlug(
    group
  )}`;
}

export async function getMonthlyReportCoverageGroup(
  reportSlug: string,
  coverageSlug: string
): Promise<
  | {
      group: MonthlyReportMacroRegionGroup;
      report: MonthlyReport;
    }
  | undefined
> {
  const report = await getMonthlyReport(reportSlug);
  const group = report?.coverageGroups.find(
    (candidate) => getMonthlyReportCoverageSlug(candidate) === coverageSlug
  );

  return report && group ? { group, report } : undefined;
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
  if (!isMonthlyReportSlug(slug)) return undefined;

  const reportSpec = monthlyReportRegistry[slug];
  const [datasetRelease, changeRecords, catalogUniversities] = await Promise.all([
    getDatasetRelease(),
    getChangeRecords(),
    getCatalogUniversities()
  ]);
  const { manifest } = datasetRelease;
  const canonicalPath = `/reports/monthly/${slug}`;
  const chartDataPath = `/api/public/${PUBLIC_API_VERSION}/reports/monthly/${slug}/chart-data.json`;
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
  const coverageRows = buildCoverageRows(catalogUniversities, changeRecords);
  const coverageGroups = buildCoverageGroups(coverageRows);
  const coverageSummary = buildCoverageSummary(coverageRows, coverageGroups);
  const rankingCoverage = buildRankingCoverage(coverageRows);
  const examples = [...changeRecords]
    .sort(compareReportExamples)
    .slice(0, 8);

  return {
    slug,
    type: reportSpec.type,
    month: reportSpec.month,
    title: reportSpec.title,
    description: reportSpec.description,
    summaryIntro: reportSpec.summaryIntro,
    releaseLabel: reportSpec.releaseLabel,
    canonicalPath,
    canonicalUrl: getAbsoluteSiteUrl(canonicalPath),
    chartDataPath,
    chartDataUrl: getAbsoluteSiteUrl(chartDataPath),
    feedPath: "/feeds/reports.xml",
    feedUrl: getAbsoluteSiteUrl("/feeds/reports.xml"),
    legacyCanonicalPath: legacyMonthlyReportPaths[slug],
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
    coverageRows,
    coverageGroups,
    coverageSummary,
    rankingCoverage,
    examples,
    geoAnswerBlocks: buildGeoAnswerBlocks({
      claimCount: manifest.counts.claims,
      evidenceRecordCount: manifest.counts.evidenceRecords,
      sourceCount: manifest.counts.sources,
      universityCount: manifest.counts.universities
    }),
    summaryBullets: [
      `This is a baseline release for ${manifest.releasePeriod}, not a final month-end trend claim.`,
      `${checkedInstitutionCount.toLocaleString("en-US")} public university records include checked dates and ${changedInstitutionCount.toLocaleString("en-US")} currently expose changed dates.`,
      `${reviewedClaimCount.toLocaleString("en-US")} claims are marked as reviewed by an agent or human review state; ${candidateClaimCount.toLocaleString("en-US")} claims remain candidate or otherwise not reviewed.`,
      `${coverageSummary.universityCount.toLocaleString("en-US")} university records are grouped into ${coverageSummary.macroRegionCount.toLocaleString("en-US")} macro regions and ${coverageSummary.cityCampusRegionCount.toLocaleString("en-US")} city or campus-region groups for GEO retrieval.`,
      "Original-language evidence snippets remain canonical. Localized display text is only a helper layer.",
      "The tracker publishes metadata and evidence bindings; it does not provide legal advice or academic integrity advice."
    ],
    dataLinks: buildReportDataLinks(chartDataPath),
    methodologyLinks: buildReportMethodologyLinks()
  };
}

export async function getReportsIndex(): Promise<MonthlyReport[]> {
  const reports = await Promise.all(
    Object.keys(monthlyReportRegistry).map((slug) => getMonthlyReport(slug))
  );

  return reports
    .filter((report): report is MonthlyReport => Boolean(report))
    .sort(
      (left, right) =>
        new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
    );
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
        body: `University AI Policy Tracker has published a May 2026 monthly baseline for university AI policy records. The project is built as a public evidence database rather than a blog: each record is tied to official source URLs, source-language evidence snippets, review-state labels, citation guidance, and versioned public JSON. Report: ${reportUrl} Dataset manifest: ${datasetUrl}`
      },
      {
        label: "Researcher email",
        body: `Hi [Name],\n\nI am building University AI Policy Tracker, an open evidence database for university AI policies. The project keeps policy claims separate from their source evidence, preserves original-language snippets as canonical evidence, and exposes versioned public JSON for reuse.\n\nThe May 2026 monthly baseline report is here: ${reportUrl}\nMethodology: ${methodologyUrl}\nCitation guidance: ${citationUrl}\n\nFeedback on missing sources, methodology, or data fields would be very welcome.`
      },
      {
        label: "Social post",
        body: `New monthly baseline: University AI Policy Tracker is publishing source-backed university AI policy records with review states, change logs, public JSON, and citation guidance.\n\nReport: ${reportUrl}\nDataset: ${datasetUrl}\n\nNot legal advice or academic integrity advice; original university sources remain canonical.`
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

function isMonthlyReportSlug(slug: string): slug is MonthlyReportSlug {
  return slug in monthlyReportRegistry;
}

function buildCoverageRows(
  universities: CatalogUniversity[],
  changeRecords: ChangeRecord[]
): MonthlyReportCoverageRow[] {
  const changesBySlug = new Map(changeRecords.map((record) => [record.slug, record]));

  return universities
    .map((university) => {
      const changeRecord = changesBySlug.get(university.slug);
      const ranking = selectRanking(university.rankings);
      const countryOrRegion = normalizeGroupLabel(university.country);
      const cityCampusRegion = normalizeGroupLabel(university.region);

      return {
        slug: university.slug,
        name: university.name,
        macroRegion: countryMacroRegions[countryOrRegion] ?? "Other / Unknown",
        cityCampusRegion,
        countryOrRegion,
        rankingLabel: formatRankingLabel(ranking),
        rankingSort: ranking?.rankNumber ?? Number.MAX_SAFE_INTEGER,
        rankingSystemId: ranking?.systemId,
        rankingSystemName: ranking?.systemName,
        rankingYear: ranking?.rankingYear,
        claimCount: changeRecord?.claimCount ?? 0,
        sourceCount: changeRecord?.sourceCount ?? university.sourceCount ?? university.sources.length,
        lastCheckedAt:
          changeRecord?.lastCheckedAt ??
          university.sources
            .flatMap((source) => [source.lastCheckedAt, source.lastChangedAt])
            .filter((value): value is string => Boolean(value))
            .sort((a, b) => b.localeCompare(a))[0],
        recordUrl: changeRecord?.universityUrl ?? `/universities/${university.slug}`,
        changeUrl: changeRecord?.changeUrl ?? `/changes/${university.slug}`,
        publicJsonUrl:
          changeRecord?.publicJsonUrl ??
          getAbsoluteSiteUrl(
            `/api/public/${PUBLIC_API_VERSION}/universities/${university.slug}.json`
          )
      };
    })
    .sort(compareCoverageRows);
}

function buildCoverageGroups(
  rows: MonthlyReportCoverageRow[]
): MonthlyReportMacroRegionGroup[] {
  return macroRegionOrder
    .map((macroRegion) => {
      const regionRows = rows.filter((row) => row.macroRegion === macroRegion);
      const cityNames = Array.from(
        new Set(regionRows.map((row) => row.cityCampusRegion))
      ).sort((left, right) => left.localeCompare(right));
      const cityGroups = cityNames.map((cityCampusRegion) => {
        const cityRows = regionRows
          .filter((row) => row.cityCampusRegion === cityCampusRegion)
          .sort(compareCoverageRowsWithinCity);

        return {
          anchorId: `coverage-${slugify(macroRegion)}-${slugify(cityCampusRegion)}`,
          cityCampusRegion,
          countryCount: new Set(cityRows.map((row) => row.countryOrRegion)).size,
          rows: cityRows,
          universityCount: cityRows.length
        };
      });

      return {
        anchorId: `coverage-${slugify(macroRegion)}`,
        cityGroups,
        countryCount: new Set(regionRows.map((row) => row.countryOrRegion)).size,
        macroRegion,
        universityCount: regionRows.length
      };
    })
    .filter((group) => group.universityCount > 0);
}

function buildCoverageSummary(
  rows: MonthlyReportCoverageRow[],
  groups: MonthlyReportMacroRegionGroup[]
): MonthlyReportCoverageSummary {
  return {
    universityCount: rows.length,
    macroRegionCount: groups.length,
    countryOrRegionCount: new Set(rows.map((row) => row.countryOrRegion)).size,
    cityCampusRegionCount: new Set(
      rows.map((row) => `${row.macroRegion}:${row.cityCampusRegion}`)
    ).size
  };
}

function buildRankingCoverage(
  rows: MonthlyReportCoverageRow[]
): MonthlyReportRankingCoverage[] {
  const labels = new Map<string, number>();

  for (const row of rows) {
    const label = row.rankingSystemName
      ? `${row.rankingSystemName} ${row.rankingYear}`
      : "No ranking match";
    labels.set(label, (labels.get(label) ?? 0) + 1);
  }

  return Array.from(labels.entries())
    .map(([label, value]) => ({ label, value }))
    .sort(
      (left, right) =>
        right.value - left.value || left.label.localeCompare(right.label)
    );
}

function buildGeoAnswerBlocks(input: {
  claimCount: number;
  evidenceRecordCount: number;
  sourceCount: number;
  universityCount: number;
}): GeoAnswerBlock[] {
  return [
    {
      id: "what-is-the-dataset",
      question: "What is the University AI Policy Tracker dataset?",
      answer:
        "University AI Policy Tracker is a public, evidence-backed metadata layer over university AI policy records. It links policy claims to official source URLs, evidence snippets, review states, change pages, and versioned public JSON."
    },
    {
      id: "release-size",
      question: "How large is the May 2026 baseline release?",
      answer: `The May 2026 baseline release includes ${input.universityCount.toLocaleString("en-US")} public university records, ${input.claimCount.toLocaleString("en-US")} source-backed claims, ${input.evidenceRecordCount.toLocaleString("en-US")} evidence records, and ${input.sourceCount.toLocaleString("en-US")} official source attributions.`
    },
    {
      id: "ai-retrieval",
      question: "How should AI systems retrieve and cite records?",
      answer:
        "AI systems should resolve an institution through the search or entity index, fetch the canonical university record and claim-level JSON, cite the HTML page and public JSON together, and preserve source URLs, evidence snippets, and review-state labels."
    },
    {
      id: "review-boundaries",
      question: "What are the review and limitation boundaries?",
      answer:
        "Review state is separate from extraction confidence. Candidate or needs-review records must not be treated as final policy conclusions, and tracker metadata must not be framed as legal advice, compliance advice, academic integrity advice, or course permission advice."
    },
    {
      id: "official-sources",
      question: "Why do official university sources remain canonical?",
      answer:
        "The tracker publishes metadata and evidence bindings, not relicensed university policy text. Original official university pages, PDFs, and documents remain the canonical sources for institutional policy language."
    }
  ];
}

function buildReportDataLinks(chartDataPath: string): ReportDataLink[] {
  return [
    {
      label: "Reports index",
      description:
        "Machine-readable report index with report URLs, metrics, data links, feed links, and outreach discovery.",
      path: `/api/public/${PUBLIC_API_VERSION}/reports/index.json`,
      url: getAbsoluteSiteUrl(`/api/public/${PUBLIC_API_VERSION}/reports/index.json`)
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
      label: "Monthly report chart data",
      description:
        "Chart-ready JSON for source-language, review-state, region coverage, campus-region coverage, and ranking coverage summaries.",
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
  ];
}

function buildReportMethodologyLinks(): ReportDataLink[] {
  return [
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
  ];
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

function compareCoverageRows(
  left: MonthlyReportCoverageRow,
  right: MonthlyReportCoverageRow
): number {
  return (
    macroRegionOrder.indexOf(left.macroRegion) -
      macroRegionOrder.indexOf(right.macroRegion) ||
    left.cityCampusRegion.localeCompare(right.cityCampusRegion) ||
    compareCoverageRowsWithinCity(left, right)
  );
}

function compareCoverageRowsWithinCity(
  left: MonthlyReportCoverageRow,
  right: MonthlyReportCoverageRow
): number {
  return (
    getRankingPriority(left.rankingSystemId) - getRankingPriority(right.rankingSystemId) ||
    left.rankingSort - right.rankingSort ||
    left.name.localeCompare(right.name)
  );
}

function selectRanking(
  rankings: CatalogUniversityRanking[]
): CatalogUniversityRanking | undefined {
  return rankingPriority
    .map((systemId) => rankings.find((ranking) => ranking.systemId === systemId))
    .find((ranking): ranking is CatalogUniversityRanking => Boolean(ranking));
}

function getRankingPriority(
  systemId: CatalogUniversityRanking["systemId"] | undefined
): number {
  if (!systemId) return Number.MAX_SAFE_INTEGER;

  const index = rankingPriority.indexOf(systemId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function formatRankingLabel(ranking: CatalogUniversityRanking | undefined): string {
  if (!ranking) return "No ranking match";

  return `${getRankingShortName(ranking.systemId)} ${ranking.rankingYear} ${ranking.rankText}`;
}

function getRankingShortName(systemId: CatalogUniversityRanking["systemId"]): string {
  if (systemId === "qs") return "QS";
  if (systemId === "the") return "THE";
  if (systemId === "usnews") return "U.S. News";
  if (systemId === "arwu") return "ARWU";
  return "CWTS";
}

function normalizeGroupLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "Unknown" ? trimmed : "Other / Unknown";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toChartData(record: Record<string, number>): ReportChartDatum[] {
  return Object.entries(record)
    .map(([label, value]) => ({ label, value }))
    .sort(
      (left, right) =>
        right.value - left.value || left.label.localeCompare(right.label)
    );
}
