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
import { formatDateMedium } from "@/lib/format-date";

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

type DatasetsCopy = ReturnType<typeof getPageCopy>["datasets"];

interface DatasetEndpoint {
  copyKey: keyof DatasetsCopy["apiGroups"];
  jsonLdName: string;
  label: string;
  path: string;
}

interface DatasetEndpointGroup {
  endpoints: DatasetEndpoint[];
  headingKey: "coreRecords" | "searchAnalysis" | "reportsEmbeds" | "reviewIntegrations";
}

// Single source for the public endpoint directory: the JSON-LD distribution
// list and the visible endpoint groups are both derived from this catalog.
function buildEndpointGroups(exampleSlug: string): DatasetEndpointGroup[] {
  const api = `/api/public/${PUBLIC_API_VERSION}`;

  return [
    {
      headingKey: "coreRecords",
      endpoints: [
        { copyKey: "apiIndex", jsonLdName: "Public API index JSON", label: "API index JSON", path: `${api}/index.json` },
        { copyKey: "universities", jsonLdName: "Universities list JSON", label: "Universities JSON", path: `${api}/universities.json` },
        { copyKey: "perUniversity", jsonLdName: "University record JSON example", label: "Per-university JSON", path: `${api}/universities/${exampleSlug}.json` },
        { copyKey: "claims", jsonLdName: "University claims JSON example", label: "Claims JSON", path: `${api}/claims/${exampleSlug}.json` },
        { copyKey: "recentChanges", jsonLdName: "Recent changes JSON", label: "Recent changes JSON", path: `${api}/recent-changes.json` },
        { copyKey: "manifest", jsonLdName: "Dataset release manifest", label: "Dataset manifest", path: `${api}/datasets/latest.json` }
      ]
    },
    {
      headingKey: "searchAnalysis",
      endpoints: [
        { copyKey: "searchJson", jsonLdName: "Entity search JSON example", label: "Search JSON", path: `${api}/search.json?q=mit` },
        { copyKey: "searchIndex", jsonLdName: "Safe search index JSON", label: "Search index", path: `${api}/search/index.json` },
        { copyKey: "entityAliases", jsonLdName: "Entity resolution index JSON", label: "Entity aliases", path: `${api}/entities/index.json` },
        { copyKey: "analysisIndex", jsonLdName: "Policy analysis API index", label: "Analysis index", path: `${api}/analysis/index.json` },
        { copyKey: "analysisProfile", jsonLdName: "University policy analysis JSON example", label: "Analysis profile", path: `${api}/analysis/universities/${exampleSlug}.json` },
        { copyKey: "coverageScores", jsonLdName: "Policy coverage scores JSON", label: "Coverage scores", path: `${api}/analysis/coverage-scores.json` },
        { copyKey: "analysisQuality", jsonLdName: "Analysis page quality JSON", label: "Analysis page quality", path: `${api}/analysis/page-quality.json` }
      ]
    },
    {
      headingKey: "reportsEmbeds",
      endpoints: [
        { copyKey: "reportsIndex", jsonLdName: "Reports index JSON", label: "Reports index", path: `${api}/reports/index.json` },
        { copyKey: "outreach", jsonLdName: "Reports outreach package JSON", label: "Outreach package", path: `${api}/reports/outreach.json` },
        { copyKey: "chartData", jsonLdName: "July 2026 monthly report chart data", label: "Report chart data", path: `${api}/reports/monthly/2026-07/chart-data.json` },
        { copyKey: "widgetIndex", jsonLdName: "Widget discovery JSON", label: "Widget index", path: `${api}/widgets/index.json` },
        { copyKey: "policyCoverageWidget", jsonLdName: "Policy coverage widget JSON example", label: "Policy coverage widget", path: `${api}/widgets/policy-coverage/${exampleSlug}.json` },
        { copyKey: "sourceFreshnessWidget", jsonLdName: "Source freshness widget JSON example", label: "Source freshness widget", path: `${api}/widgets/source-freshness/${exampleSlug}.json` },
        { copyKey: "reviewStateWidget", jsonLdName: "Review-state widget JSON example", label: "Review-state widget", path: `${api}/widgets/review-state/${exampleSlug}.json` }
      ]
    },
    {
      headingKey: "reviewIntegrations",
      endpoints: [
        { copyKey: "qsCoverage", jsonLdName: "QS 2026 coverage JSON", label: "QS coverage", path: `${api}/coverage/qs-2026.json` },
        { copyKey: "sourceHealth", jsonLdName: "Source health JSON", label: "Source health", path: `${api}/source-health.json` },
        { copyKey: "reviewQueue", jsonLdName: "Review queue JSON", label: "Review queue", path: `${api}/review/queue.json` },
        { copyKey: "mcpManifest", jsonLdName: "Read-only MCP alpha manifest", label: "MCP manifest", path: `${api}/mcp/manifest.json` },
        { copyKey: "mcpToolCatalog", jsonLdName: "MCP tool catalog", label: "MCP tool catalog", path: `${api}/mcp/tool-catalog.json` },
        { copyKey: "citationMetadata", jsonLdName: "Citation metadata", label: "Citation metadata", path: `${api}/citation.json` },
        { copyKey: "contributionIndex", jsonLdName: "Contribution workflow metadata", label: "Contribution index", path: `${api}/contributions/index.json` },
        { copyKey: "reviewPolicy", jsonLdName: "Contribution review policy metadata", label: "Review policy", path: `${api}/contributions/review-policy.json` }
      ]
    }
  ];
}

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
  const exampleSlug =
    summaries.find((summary) => summary.entity.slug === "anu")
      ?.entity.slug ??
    summaries[0]?.entity.slug ??
    universities[0]?.slug ??
    "anu";
  const endpointGroups = buildEndpointGroups(exampleSlug);
  const allEndpoints = endpointGroups.flatMap((group) => group.endpoints);

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
            ...allEndpoints.map((endpoint) => ({
              "@type": "DataDownload",
              name: endpoint.jsonLdName,
              encodingFormat: "application/json",
              contentUrl: getAbsoluteSiteUrl(endpoint.path)
            })),
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
          {endpointGroups.map((group) => (
            <section className="endpoint-group" key={group.headingKey}>
              <h3>{copy[group.headingKey]}</h3>
              {group.endpoints.map((endpoint) => (
                <ApiEndpointRow
                  description={copy.apiGroups[endpoint.copyKey]}
                  key={endpoint.path}
                  label={endpoint.label}
                  path={endpoint.path}
                  url={getAbsoluteSiteUrl(endpoint.path)}
                />
              ))}
            </section>
          ))}
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
            {formatDateMedium(datasetReleaseManifest.publishedAt, locale)}
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
              {formatDateMedium(manifest.publishedAt, locale)}
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
