import { DocumentLink as Link } from "@/components/document-link";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE
} from "@uapt/shared";
import type { PublicEntitySummary } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import {
  getCatalogUniversities,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { getDatasetRelease } from "@/lib/dataset-release";
import { getPolicyAnalysisProfiles } from "@/lib/policy-analysis";
import { getCurrentPublicReleaseManifest } from "@/lib/staged-public-data";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";
import { getPageCopy } from "@/lib/page-copy";

const githubRepositoryUrl =
  "https://github.com/SciWhite/university-ai-policy-tracker";

const githubTrustAssets = [
  {
    label: "README.md",
    href: `${githubRepositoryUrl}#readme`,
    description:
      "Project positioning, public data surfaces, local development, and validation commands."
  },
  {
    label: "DATA_DICTIONARY.md",
    href: `${githubRepositoryUrl}/blob/main/DATA_DICTIONARY.md`,
    description:
      "Field-level explanation for public JSON, claims, evidence, sources, changes, and multilingual display rules."
  },
  {
    label: "CITATION.cff",
    href: `${githubRepositoryUrl}/blob/main/CITATION.cff`,
    description:
      "Machine-readable citation metadata for GitHub and research workflows."
  },
  {
    label: "CONTRIBUTING.md",
    href: `${githubRepositoryUrl}/blob/main/CONTRIBUTING.md`,
    description:
      "Contribution rules for source URLs, staged OpenClaw artifacts, review boundaries, and pull requests."
  }
] as const;

const rankingSourceBoundaries = [
  "QS 2026 currently remains the main crawl batching source for expanding coverage.",
  "THE 2026, ARWU 2025, U.S. News 2025-2026, and CWTS Leiden 2025 are supported as ranking, index, and filter sources.",
  "CWTS Leiden 2025 is a derived metric order, not an overall global university rank.",
  "Different ranking years are not presented as one unified 2026 ranking."
] as const;

interface DatasetsPageProps {
  params?: Promise<{
    locale?: string;
  }>;
}

export async function generateMetadata({
  params
}: DatasetsPageProps = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).datasets;
  const alternates = getLocalizedAlternates("/datasets", locale);
  const canonical = String(alternates.canonical);

  return {
    title: copy.title,
    description: copy.description,
    alternates,
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function DatasetsPage({ params }: DatasetsPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).datasets;
  const universities = await getCatalogUniversities();
  const summaries = (
    await Promise.all(
      universities.map((university) =>
        getPublicUniversitySummaryBySlug(university.slug)
      )
    )
  ).filter((summary): summary is PublicEntitySummary => Boolean(summary));
  const manifest = await getCurrentPublicReleaseManifest();
  const datasetRelease = await getDatasetRelease();
  const analysisProfiles = await getPolicyAnalysisProfiles();
  const datasetReleaseManifest = datasetRelease.manifest;
  const universityCount = summaries.length || universities.length;
  const sourceCount = summaries.length
    ? summaries.reduce(
        (total, summary) => total + summary.officialSources.length,
        0
      )
    : universities.reduce(
        (total, university) => total + university.sources.length,
        0
      );
  const claimCount = summaries.reduce(
    (total, summary) => total + summary.claims.length,
    0
  );
  const datasetsUrl = getAbsoluteSiteUrl("/datasets");
  const apiIndexPath = `/api/public/${PUBLIC_API_VERSION}/index.json`;
  const universitiesJsonPath = `/api/public/${PUBLIC_API_VERSION}/universities.json`;
  const searchJsonPath = `/api/public/${PUBLIC_API_VERSION}/search.json?q=mit`;
  const searchIndexPath = `/api/public/${PUBLIC_API_VERSION}/search/index.json`;
  const entityIndexPath = `/api/public/${PUBLIC_API_VERSION}/entities/index.json`;
  const latestDatasetManifestPath = `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`;
  const exampleSlug =
    summaries.find((summary) => summary.entity.slug === "anu")
      ?.entity.slug ??
    summaries[0]?.entity.slug ??
    universities[0]?.slug ??
    "anu";
  const exampleUniversityPath = `/api/public/${PUBLIC_API_VERSION}/universities/${exampleSlug}.json`;
  const exampleClaimsPath = `/api/public/${PUBLIC_API_VERSION}/claims/${exampleSlug}.json`;
  const recentChangesPath = `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`;
  const analysisIndexPath = `/api/public/${PUBLIC_API_VERSION}/analysis/index.json`;
  const exampleAnalysisPath = `/api/public/${PUBLIC_API_VERSION}/analysis/universities/${exampleSlug}.json`;
  const analysisCoverageScoresPath = `/api/public/${PUBLIC_API_VERSION}/analysis/coverage-scores.json`;
  const analysisPageQualityPath = `/api/public/${PUBLIC_API_VERSION}/analysis/page-quality.json`;
  const reportsIndexPath = `/api/public/${PUBLIC_API_VERSION}/reports/index.json`;
  const reportChartDataPath = `/api/public/${PUBLIC_API_VERSION}/reports/monthly/2026-06/chart-data.json`;
  const reportOutreachPath = `/api/public/${PUBLIC_API_VERSION}/reports/outreach.json`;
  const widgetIndexPath = `/api/public/${PUBLIC_API_VERSION}/widgets/index.json`;
  const policyCoverageWidgetPath = `/api/public/${PUBLIC_API_VERSION}/widgets/policy-coverage/${exampleSlug}.json`;
  const sourceFreshnessWidgetPath = `/api/public/${PUBLIC_API_VERSION}/widgets/source-freshness/${exampleSlug}.json`;
  const reviewStateWidgetPath = `/api/public/${PUBLIC_API_VERSION}/widgets/review-state/${exampleSlug}.json`;
  const mcpManifestPath = `/api/public/${PUBLIC_API_VERSION}/mcp/manifest.json`;
  const mcpToolCatalogPath = `/api/public/${PUBLIC_API_VERSION}/mcp/tool-catalog.json`;
  const citationMetadataPath = `/api/public/${PUBLIC_API_VERSION}/citation.json`;
  const contributionIndexPath = `/api/public/${PUBLIC_API_VERSION}/contributions/index.json`;
  const reviewPolicyPath = `/api/public/${PUBLIC_API_VERSION}/contributions/review-policy.json`;
  const qsCoveragePath = `/api/public/${PUBLIC_API_VERSION}/coverage/qs-2026.json`;
  const sourceHealthPath = `/api/public/${PUBLIC_API_VERSION}/source-health.json`;
  const reviewQueuePath = `/api/public/${PUBLIC_API_VERSION}/review/queue.json`;
  const apiIndexUrl = getAbsoluteSiteUrl(apiIndexPath);
  const universitiesJsonUrl = getAbsoluteSiteUrl(universitiesJsonPath);
  const searchJsonUrl = getAbsoluteSiteUrl(searchJsonPath);
  const searchIndexUrl = getAbsoluteSiteUrl(searchIndexPath);
  const entityIndexUrl = getAbsoluteSiteUrl(entityIndexPath);
  const latestDatasetManifestUrl = getAbsoluteSiteUrl(
    latestDatasetManifestPath
  );
  const exampleUniversityUrl = getAbsoluteSiteUrl(exampleUniversityPath);
  const exampleClaimsUrl = getAbsoluteSiteUrl(exampleClaimsPath);
  const recentChangesUrl = getAbsoluteSiteUrl(recentChangesPath);
  const analysisIndexUrl = getAbsoluteSiteUrl(analysisIndexPath);
  const exampleAnalysisUrl = getAbsoluteSiteUrl(exampleAnalysisPath);
  const analysisCoverageScoresUrl = getAbsoluteSiteUrl(
    analysisCoverageScoresPath
  );
  const analysisPageQualityUrl = getAbsoluteSiteUrl(analysisPageQualityPath);
  const reportsIndexUrl = getAbsoluteSiteUrl(reportsIndexPath);
  const reportChartDataUrl = getAbsoluteSiteUrl(reportChartDataPath);
  const reportOutreachUrl = getAbsoluteSiteUrl(reportOutreachPath);
  const widgetIndexUrl = getAbsoluteSiteUrl(widgetIndexPath);
  const policyCoverageWidgetUrl = getAbsoluteSiteUrl(policyCoverageWidgetPath);
  const sourceFreshnessWidgetUrl = getAbsoluteSiteUrl(sourceFreshnessWidgetPath);
  const reviewStateWidgetUrl = getAbsoluteSiteUrl(reviewStateWidgetPath);
  const mcpManifestUrl = getAbsoluteSiteUrl(mcpManifestPath);
  const mcpToolCatalogUrl = getAbsoluteSiteUrl(mcpToolCatalogPath);
  const citationMetadataUrl = getAbsoluteSiteUrl(citationMetadataPath);
  const contributionIndexUrl = getAbsoluteSiteUrl(contributionIndexPath);
  const reviewPolicyUrl = getAbsoluteSiteUrl(reviewPolicyPath);
  const qsCoverageUrl = getAbsoluteSiteUrl(qsCoveragePath);
  const sourceHealthUrl = getAbsoluteSiteUrl(sourceHealthPath);
  const reviewQueueUrl = getAbsoluteSiteUrl(reviewQueuePath);

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "University AI Policy Tracker public JSON dataset",
          description: copy.description,
          url: datasetsUrl,
          license: "https://creativecommons.org/licenses/by/4.0/",
          isAccessibleForFree: true,
          creator: {
            "@type": "Organization",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          includedInDataCatalog: {
            "@type": "DataCatalog",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          distribution: [
            {
              "@type": "DataDownload",
              name: "Public API index JSON",
              encodingFormat: "application/json",
              contentUrl: apiIndexUrl
            },
            {
              "@type": "DataDownload",
              name: "Universities list JSON",
              encodingFormat: "application/json",
              contentUrl: universitiesJsonUrl
            },
            {
              "@type": "DataDownload",
              name: "Entity search JSON example",
              encodingFormat: "application/json",
              contentUrl: searchJsonUrl
            },
            {
              "@type": "DataDownload",
              name: "Safe search index JSON",
              encodingFormat: "application/json",
              contentUrl: searchIndexUrl
            },
            {
              "@type": "DataDownload",
              name: "Entity resolution index JSON",
              encodingFormat: "application/json",
              contentUrl: entityIndexUrl
            },
            {
              "@type": "DataDownload",
              name: "University record JSON example",
              encodingFormat: "application/json",
              contentUrl: exampleUniversityUrl
            },
            {
              "@type": "DataDownload",
              name: "University claims JSON example",
              encodingFormat: "application/json",
              contentUrl: exampleClaimsUrl
            },
            {
              "@type": "DataDownload",
              name: "Recent changes JSON",
              encodingFormat: "application/json",
              contentUrl: recentChangesUrl
            },
            {
              "@type": "DataDownload",
              name: "Policy analysis API index",
              encodingFormat: "application/json",
              contentUrl: analysisIndexUrl
            },
            {
              "@type": "DataDownload",
              name: "University policy analysis JSON example",
              encodingFormat: "application/json",
              contentUrl: exampleAnalysisUrl
            },
            {
              "@type": "DataDownload",
              name: "Policy coverage scores JSON",
              encodingFormat: "application/json",
              contentUrl: analysisCoverageScoresUrl
            },
            {
              "@type": "DataDownload",
              name: "Analysis page quality JSON",
              encodingFormat: "application/json",
              contentUrl: analysisPageQualityUrl
            },
            {
              "@type": "DataDownload",
              name: "Reports index JSON",
              encodingFormat: "application/json",
              contentUrl: reportsIndexUrl
            },
            {
              "@type": "DataDownload",
              name: "Reports outreach package JSON",
              encodingFormat: "application/json",
              contentUrl: reportOutreachUrl
            },
            {
              "@type": "DataDownload",
              name: "QS 2026 coverage JSON",
              encodingFormat: "application/json",
              contentUrl: qsCoverageUrl
            },
            {
              "@type": "DataDownload",
              name: "Source health JSON",
              encodingFormat: "application/json",
              contentUrl: sourceHealthUrl
            },
            {
              "@type": "DataDownload",
              name: "Review queue JSON",
              encodingFormat: "application/json",
              contentUrl: reviewQueueUrl
            },
            {
              "@type": "DataDownload",
              name: "Dataset release manifest",
              encodingFormat: "application/json",
              contentUrl: latestDatasetManifestUrl
            },
            {
              "@type": "DataDownload",
              name: "June 2026 monthly report chart data",
              encodingFormat: "application/json",
              contentUrl: reportChartDataUrl
            },
            {
              "@type": "DataDownload",
              name: "Widget discovery JSON",
              encodingFormat: "application/json",
              contentUrl: widgetIndexUrl
            },
            {
              "@type": "DataDownload",
              name: "Policy coverage widget JSON example",
              encodingFormat: "application/json",
              contentUrl: policyCoverageWidgetUrl
            },
            {
              "@type": "DataDownload",
              name: "Source freshness widget JSON example",
              encodingFormat: "application/json",
              contentUrl: sourceFreshnessWidgetUrl
            },
            {
              "@type": "DataDownload",
              name: "Review-state widget JSON example",
              encodingFormat: "application/json",
              contentUrl: reviewStateWidgetUrl
            },
            {
              "@type": "DataDownload",
              name: "Read-only MCP alpha manifest",
              encodingFormat: "application/json",
              contentUrl: mcpManifestUrl
            },
            {
              "@type": "DataDownload",
              name: "MCP tool catalog",
              encodingFormat: "application/json",
              contentUrl: mcpToolCatalogUrl
            },
            {
              "@type": "DataDownload",
              name: "Citation metadata",
              encodingFormat: "application/json",
              contentUrl: citationMetadataUrl
            },
            {
              "@type": "DataDownload",
              name: "Contribution workflow metadata",
              encodingFormat: "application/json",
              contentUrl: contributionIndexUrl
            },
            {
              "@type": "DataDownload",
              name: "Contribution review policy metadata",
              encodingFormat: "application/json",
              contentUrl: reviewPolicyUrl
            },
            ...datasetReleaseManifest.artifacts.map((artifact) => ({
              "@type": "DataDownload",
              name: artifact.label,
              encodingFormat: artifact.mediaType,
              contentUrl: artifact.url,
              contentSize: artifact.byteLength
            }))
          ]
        }}
      />

      <section className="hero">
        <p className="kicker">{copy.kicker}</p>
        <h1>{copy.heading}</h1>
        <p className="lead">
          {copy.leadPrefix} <code>/api/public/{PUBLIC_API_VERSION}</code>,{" "}
          {copy.leadSuffix}
        </p>
      </section>

      <section className="metrics-grid" aria-label={copy.coverageLabel}>
        <div>
          <span>{universityCount}</span>
          <p>{copy.publicUniversityRecords}</p>
        </div>
        <div>
          <span>{claimCount}</span>
          <p>{copy.sourceBackedClaims}</p>
        </div>
        <div>
          <span>{sourceCount}</span>
          <p>{copy.officialSourceAttributions}</p>
        </div>
        <div>
          <span>{PUBLIC_API_VERSION}</span>
          <p>{copy.publicJsonSchemaVersion}</p>
        </div>
        <div>
          <span>{datasetReleaseManifest.artifacts.length}</span>
          <p>{copy.releaseDownloadArtifacts}</p>
        </div>
        <div>
          <span>{analysisProfiles.length}</span>
          <p>{copy.analysisProfiles}</p>
        </div>
      </section>

      <section className="answer-strip" aria-label={copy.answersLabel}>
        <article className="answer-card">
          <h2>{copy.whatReusableTitle}</h2>
          <p>{copy.whatReusableText}</p>
        </article>
        <article className="answer-card">
          <h2>{copy.externalTitle}</h2>
          <p>{copy.externalText}</p>
        </article>
        <article className="answer-card">
          <h2>{copy.retrieveTitle}</h2>
          <p>{copy.retrieveText}</p>
        </article>
      </section>

      <ReferenceBox
        description={copy.versionedJsonDescription}
        title={copy.versionedJsonTitle}
      >
        <div className="endpoint-group-grid">
          <section className="endpoint-group">
            <h3>{copy.coreRecords}</h3>
            <ApiEndpointRow
              description="Endpoint discovery and trust links."
              label="API index JSON"
              path={apiIndexPath}
              url={apiIndexUrl}
            />
            <ApiEndpointRow
              description="University records with review state, dates, and JSON URLs."
              label="Universities JSON"
              path={universitiesJsonPath}
              url={universitiesJsonUrl}
            />
            <ApiEndpointRow
              description="Example public university record."
              label="Per-university JSON"
              path={exampleUniversityPath}
              url={exampleUniversityUrl}
            />
            <ApiEndpointRow
              description="Example claim/evidence rows."
              label="Claims JSON"
              path={exampleClaimsPath}
              url={exampleClaimsUrl}
            />
            <ApiEndpointRow
              description="Checked and changed records."
              label="Recent changes JSON"
              path={recentChangesPath}
              url={recentChangesUrl}
            />
            <ApiEndpointRow
              description="Release artifacts, row counts, sizes, and checksums."
              label="Dataset manifest"
              path={latestDatasetManifestPath}
              url={latestDatasetManifestUrl}
            />
          </section>

          <section className="endpoint-group">
            <h3>{copy.searchAnalysis}</h3>
            <ApiEndpointRow
              description="Entity search over promoted public records."
              label="Search JSON"
              path={searchJsonPath}
              url={searchJsonUrl}
            />
            <ApiEndpointRow
              description="Safe search index; no raw snapshots or staging artifacts."
              label="Search index"
              path={searchIndexPath}
              url={searchIndexUrl}
            />
            <ApiEndpointRow
              description="Canonical aliases and retrieval hints."
              label="Entity aliases"
              path={entityIndexPath}
              url={entityIndexUrl}
            />
            <ApiEndpointRow
              description="Policy analysis dimension manifest."
              label="Analysis index"
              path={analysisIndexPath}
              url={analysisIndexUrl}
            />
            <ApiEndpointRow
              description="Example per-university analysis profile."
              label="Analysis profile"
              path={exampleAnalysisPath}
              url={exampleAnalysisUrl}
            />
            <ApiEndpointRow
              description="Coverage breadth scores, not policy quality."
              label="Coverage scores"
              path={analysisCoverageScoresPath}
              url={analysisCoverageScoresUrl}
            />
            <ApiEndpointRow
              description="Public analysis page gates."
              label="Analysis page quality"
              path={analysisPageQualityPath}
              url={analysisPageQualityUrl}
            />
          </section>

          <section className="endpoint-group">
            <h3>{copy.reportsEmbeds}</h3>
            <ApiEndpointRow
              description="Public report index."
              label="Reports index"
              path={reportsIndexPath}
              url={reportsIndexUrl}
            />
            <ApiEndpointRow
              description="Media and newsletter copy with boundaries."
              label="Outreach package"
              path={reportOutreachPath}
              url={reportOutreachUrl}
            />
            <ApiEndpointRow
              description="June 2026 monthly report chart data."
              label="Report chart data"
              path={reportChartDataPath}
              url={reportChartDataUrl}
            />
            <ApiEndpointRow
              description="Widget discovery."
              label="Widget index"
              path={widgetIndexPath}
              url={widgetIndexUrl}
            />
            <ApiEndpointRow
              description="Example coverage widget."
              label="Policy coverage widget"
              path={policyCoverageWidgetPath}
              url={policyCoverageWidgetUrl}
            />
            <ApiEndpointRow
              description="Example source freshness widget."
              label="Source freshness widget"
              path={sourceFreshnessWidgetPath}
              url={sourceFreshnessWidgetUrl}
            />
            <ApiEndpointRow
              description="Example review-state widget."
              label="Review-state widget"
              path={reviewStateWidgetPath}
              url={reviewStateWidgetUrl}
            />
          </section>

          <section className="endpoint-group">
            <h3>{copy.reviewIntegrations}</h3>
            <ApiEndpointRow
              description="QS 2026 collection coverage."
              label="QS coverage"
              path={qsCoveragePath}
              url={qsCoverageUrl}
            />
            <ApiEndpointRow
              description="Source status for repair and recrawl planning."
              label="Source health"
              path={sourceHealthPath}
              url={sourceHealthUrl}
            />
            <ApiEndpointRow
              description="Unpromoted staging run queue metadata."
              label="Review queue"
              path={reviewQueuePath}
              url={reviewQueueUrl}
            />
            <ApiEndpointRow
              description="Read-only MCP alpha manifest."
              label="MCP manifest"
              path={mcpManifestPath}
              url={mcpManifestUrl}
            />
            <ApiEndpointRow
              description="Read-only MCP tool catalog."
              label="MCP tool catalog"
              path={mcpToolCatalogPath}
              url={mcpToolCatalogUrl}
            />
            <ApiEndpointRow
              description="Citation templates and reuse rules."
              label="Citation metadata"
              path={citationMetadataPath}
              url={citationMetadataUrl}
            />
            <ApiEndpointRow
              description="Contribution workflow metadata."
              label="Contribution index"
              path={contributionIndexPath}
              url={contributionIndexUrl}
            />
            <ApiEndpointRow
              description="Contribution review policy."
              label="Review policy"
              path={reviewPolicyPath}
              url={reviewPolicyUrl}
            />
          </section>
        </div>
      </ReferenceBox>

      <ReferenceBox
        description={copy.releaseDownloadsDescription}
        title={copy.releaseDownloadsTitle}
      >
        <div className="tag-row">
          <MetaLabel label={copy.release}>{datasetReleaseManifest.releaseId}</MetaLabel>
          <MetaLabel label={copy.period}>
            {datasetReleaseManifest.releasePeriod}
          </MetaLabel>
          <MetaLabel label={copy.published}>
            {formatDate(datasetReleaseManifest.publishedAt)}
          </MetaLabel>
        </div>
        {datasetReleaseManifest.artifacts.map((artifact) => (
          <ApiEndpointRow
            description={`${artifact.description} SHA-256: ${artifact.sha256.slice(
              0,
              16
            )}...`}
            key={artifact.id}
            label={artifact.label}
            path={artifact.path}
            status={formatArtifactStatus(artifact)}
            url={artifact.url}
          />
        ))}
      </ReferenceBox>

      <ReferenceBox
        className="compact-reference-box"
        description={copy.rankingDescription}
        title={copy.rankingTitle}
      >
        <ul className="compact-list">
          {rankingSourceBoundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ul>
      </ReferenceBox>

      <ReferenceBox
        className="compact-reference-box"
        description={copy.githubDescription}
        title={copy.githubTitle}
      >
        <ul className="compact-list">
          {githubTrustAssets.map((asset) => (
            <li key={asset.label}>
              <a href={asset.href}>{asset.label}</a>: {asset.description}
            </li>
          ))}
        </ul>
      </ReferenceBox>

      {manifest ? (
        <ReferenceBox
          description={manifest.description}
          title={copy.manifestTitle}
        >
          <div className="tag-row">
            <MetaLabel label={copy.release}>{manifest.releaseId}</MetaLabel>
            <MetaLabel label={copy.published}>
              {formatDate(manifest.publishedAt)}
            </MetaLabel>
            <MetaLabel label={copy.promotedRuns}>
              {manifest.includeStagedArtifactDirectories.length}
            </MetaLabel>
          </div>
          <p className="muted">
            {copy.manifestText}
          </p>
          {manifest.notes?.length ? (
            <ul className="compact-list">
              {manifest.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </ReferenceBox>
      ) : null}

      <section className="section">
        <div className="section-heading">
          <h2>{copy.conceptsTitle}</h2>
          <p>{copy.conceptsLead}</p>
        </div>
        <div className="detail-grid">
          {copy.concepts.map((concept) => (
            <article className="policy-card" key={concept.name}>
              <h3>{concept.name}</h3>
              <div className="tag-row">
                <span className="pill">{concept.status}</span>
              </div>
              <p>{concept.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>{copy.licenseTitle}</h2>
          <p>{TRACKER_METADATA_LICENSE} {copy.trackerMetadata}</p>
        </div>
        <div className="detail-grid">
          <article className="policy-card">
            <h3>{copy.trackerMetadataTitle}</h3>
            <p>
              Tracker metadata, including normalized entities, claim records,
              review states, and public JSON fields, is intended for{" "}
              {TRACKER_METADATA_LICENSE} reuse with attribution.
            </p>
          </article>
          <article className="policy-card">
            <h3>{copy.officialRightsTitle}</h3>
            <p>{OFFICIAL_SOURCE_RIGHTS_CAVEAT}</p>
          </article>
          <article className="policy-card">
            <h3>{copy.citationExpectationsTitle}</h3>
            <p>{copy.citationExpectationsText}</p>
          </article>
        </div>
      </section>

      <section className="section">
        <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
        <p>
          {copy.citationRulesPrefix} <Link href="/citation">/citation</Link>.
          {" "}{copy.recentFreshnessPrefix} <Link href="/changes">/changes</Link>.
        </p>
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatArtifactStatus(artifact: {
  byteLength: number;
  mediaType: string;
  rowCount?: number;
}): string {
  const rowText =
    artifact.rowCount === undefined ? "" : `${artifact.rowCount} rows / `;

  return `${rowText}${formatBytes(artifact.byteLength)} / ${artifact.mediaType}`;
}

function formatBytes(byteLength: number): string {
  if (byteLength < 1024) return `${byteLength} B`;
  if (byteLength < 1024 * 1024) return `${(byteLength / 1024).toFixed(1)} KB`;

  return `${(byteLength / 1024 / 1024).toFixed(2)} MB`;
}
