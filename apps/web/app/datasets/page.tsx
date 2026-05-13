import Link from "next/link";
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

const title = "Datasets | University AI Policy Tracker";
const description =
  "Versioned public JSON endpoints, dataset concepts, licensing, source rights caveats, and citation expectations for University AI Policy Tracker.";

const datasetConcepts = [
  {
    name: "Universities",
    status: "Available now",
    description:
      "Canonical university records are available as visible pages and per-university public JSON records."
  },
  {
    name: "Claims",
    status: "Available inside university JSON",
    description:
      "Claims include claim text, claim type, confidence, review state, dates, and evidence arrays."
  },
  {
    name: "Sources",
    status: "Available inside public records",
    description:
      "Official sources appear as source attributions and evidence source URLs with rights caveats."
  },
  {
    name: "Snapshots",
    status: "Hash metadata available now",
    description:
      "Public records expose source snapshot hashes. Raw HTML, PDFs, and screenshots are not published as tracker metadata."
  },
  {
    name: "Recent changes",
    status: "Available now",
    description:
      "The recent changes JSON feed summarizes checked and changed university records with review states."
  },
  {
    name: "Analysis profiles",
    status: "Available now",
    description:
      "Deterministic policy analysis profiles derive dimensions and coverage scores from existing public claim/evidence records."
  },
  {
    name: "Coverage dashboards",
    status: "Available now",
    description:
      "QS coverage, source-health, and review-queue metadata expose collection status and crawler/review work without publishing staging claims."
  },
  {
    name: "Entity resolution and search",
    status: "Available now",
    description:
      "Canonical entity aliases and safe search indexes improve recall without creating policy facts or exposing unpublished artifacts."
  }
] as const;

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

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/datasets");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function DatasetsPage() {
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
  const reportChartDataPath = `/api/public/${PUBLIC_API_VERSION}/reports/2026-05/chart-data.json`;
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
  const reportChartDataUrl = getAbsoluteSiteUrl(reportChartDataPath);
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
          description,
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
              name: "May 2026 report chart data",
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
        <p className="kicker">Datasets</p>
        <h1>Public JSON artifacts and release metadata</h1>
        <p className="lead">
          The current distribution layer is versioned public JSON under{" "}
          <code>/api/public/{PUBLIC_API_VERSION}</code>. Tracker metadata is open
          licensed; official source documents retain their original rights.
          Public pages and public JSON are built from the same promoted release
          dataset.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Current dataset coverage">
        <div>
          <span>{universityCount}</span>
          <p>public university records</p>
        </div>
        <div>
          <span>{claimCount}</span>
          <p>source-backed claims</p>
        </div>
        <div>
          <span>{sourceCount}</span>
          <p>official source attributions</p>
        </div>
        <div>
          <span>{PUBLIC_API_VERSION}</span>
          <p>public JSON schema version</p>
        </div>
        <div>
          <span>{datasetReleaseManifest.artifacts.length}</span>
          <p>release download artifacts</p>
        </div>
        <div>
          <span>{analysisProfiles.length}</span>
          <p>analysis profiles</p>
        </div>
      </section>

      <ReferenceBox
        description="Live read-only artifacts in the public web app."
        title="Versioned public JSON"
      >
        <ApiEndpointRow
          description="Discovery document for endpoints, trust pages, limitations, and citation rules."
          label="API index JSON"
          path={apiIndexPath}
          url={apiIndexUrl}
        />
        <ApiEndpointRow
          description="List of public university records with counts, review state, dates, and JSON URLs."
          label="Universities JSON"
          path={universitiesJsonPath}
          url={universitiesJsonUrl}
        />
        <ApiEndpointRow
          description="Search public university records by canonical name, alias, official source title, claim summary, source domain, or analysis dimension."
          label="Entity search JSON"
          path={searchJsonPath}
          url={searchJsonUrl}
        />
        <ApiEndpointRow
          description="Safe public search index that can feed a future Pagefind build without exposing raw snapshots or unpublished staging artifacts."
          label="Safe search index"
          path={searchIndexPath}
          url={searchIndexUrl}
        />
        <ApiEndpointRow
          description="Canonical entity aliases and retrieval matches. Alias matches improve recall but do not create policy facts."
          label="Entity resolution index"
          path={entityIndexPath}
          url={entityIndexUrl}
        />
        <ApiEndpointRow
          description="Example university-level record with claims, evidence, official sources, and citation fields."
          label="Per-university JSON example"
          path={exampleUniversityPath}
          url={exampleUniversityUrl}
        />
        <ApiEndpointRow
          description="Example claim/evidence rows for one public university record."
          label="Per-university claims JSON example"
          path={exampleClaimsPath}
          url={exampleClaimsUrl}
        />
        <ApiEndpointRow
          description="Freshness feed for checked and changed public records."
          label="Recent changes JSON"
          path={recentChangesPath}
          url={recentChangesUrl}
        />
        <ApiEndpointRow
          description="Manifest for deterministic policy analysis dimensions, endpoint paths, limitations, and schema version."
          label="Analysis API index"
          path={analysisIndexPath}
          url={analysisIndexUrl}
        />
        <ApiEndpointRow
          description="Example university policy analysis profile derived from public claim/evidence records."
          label="Per-university analysis JSON example"
          path={exampleAnalysisPath}
          url={exampleAnalysisUrl}
        />
        <ApiEndpointRow
          description="Coverage score list for public analysis profiles. Scores measure breadth of source-backed public coverage, not policy quality."
          label="Policy coverage scores"
          path={analysisCoverageScoresPath}
          url={analysisCoverageScoresUrl}
        />
        <ApiEndpointRow
          description="Read-only page-quality gates, indexability status, analysis review workflow, and no-advice boundaries for public analysis pages."
          label="Analysis page quality"
          path={analysisPageQualityPath}
          url={analysisPageQualityUrl}
        />
        <ApiEndpointRow
          description="QS 2026 target coverage with public, staging-only, and missing status. This is collection coverage, not policy quality."
          label="QS coverage"
          path={qsCoveragePath}
          url={qsCoverageUrl}
        />
        <ApiEndpointRow
          description="Public source snapshot metadata and staging source/fetch status rows for repair and recrawl planning."
          label="Source health"
          path={sourceHealthPath}
          url={sourceHealthUrl}
        />
        <ApiEndpointRow
          description="Unpromoted staging run queue metadata for validation, repair, and review planning."
          label="Review queue"
          path={reviewQueuePath}
          url={reviewQueueUrl}
        />
        <ApiEndpointRow
          description="Release manifest with artifact URLs, row counts, byte sizes, and SHA-256 checksums."
          label="Dataset release manifest"
          path={latestDatasetManifestPath}
          url={latestDatasetManifestUrl}
        />
        <ApiEndpointRow
          description="Chart-ready source-language and review-state distributions for the May 2026 baseline report."
          label="Report chart data"
          path={reportChartDataPath}
          url={reportChartDataUrl}
        />
        <ApiEndpointRow
          description="Discovery document for embeddable widget types, script URL, constraints, and example HTML."
          label="Widget index JSON"
          path={widgetIndexPath}
          url={widgetIndexUrl}
        />
        <ApiEndpointRow
          description="Example policy coverage widget payload. Coverage is source-backed breadth, not policy quality."
          label="Policy coverage widget JSON"
          path={policyCoverageWidgetPath}
          url={policyCoverageWidgetUrl}
        />
        <ApiEndpointRow
          description="Example source freshness widget payload with last checked date and source-health counts."
          label="Source freshness widget JSON"
          path={sourceFreshnessWidgetPath}
          url={sourceFreshnessWidgetUrl}
        />
        <ApiEndpointRow
          description="Example review-state widget payload with confidence and candidate/reviewed claim counts."
          label="Review-state widget JSON"
          path={reviewStateWidgetPath}
          url={reviewStateWidgetUrl}
        />
        <ApiEndpointRow
          description="Read-only MCP alpha design manifest for agent integrations."
          label="MCP alpha manifest"
          path={mcpManifestPath}
          url={mcpManifestUrl}
        />
        <ApiEndpointRow
          description="Read-only MCP alpha tool catalog with input schemas, required output fields, and prohibited mutations."
          label="MCP tool catalog"
          path={mcpToolCatalogPath}
          url={mcpToolCatalogUrl}
        />
        <ApiEndpointRow
          description="Machine-readable citation templates, required fields, and evidence reuse rules."
          label="Citation metadata"
          path={citationMetadataPath}
          url={citationMetadataUrl}
        />
        <ApiEndpointRow
          description="Read-only contribution workflow metadata, GitHub issue template URLs, and publication boundaries."
          label="Contribution index"
          path={contributionIndexPath}
          url={contributionIndexUrl}
        />
        <ApiEndpointRow
          description="Read-only contribution review queues, moderation safeguards, and publication gates."
          label="Review policy"
          path={reviewPolicyPath}
          url={reviewPolicyUrl}
        />
      </ReferenceBox>

      <ReferenceBox
        description="Bulk files for researchers, developers, and agents. Each artifact is versioned under /api/public/v1 and included in the release checksum file."
        title="Dataset release downloads"
      >
        <div className="tag-row">
          <MetaLabel label="Release">{datasetReleaseManifest.releaseId}</MetaLabel>
          <MetaLabel label="Period">
            {datasetReleaseManifest.releasePeriod}
          </MetaLabel>
          <MetaLabel label="Published">
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
        description="Ranking sources are discovery and filtering inputs, not policy conclusions."
        title="Ranking and index boundaries"
      >
        <ul className="compact-list">
          {rankingSourceBoundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ul>
        <p>
          Ranking rows can help users browse public records, but the evidence
          model remains claim-first: official sources, source snapshot hashes,
          original-language evidence, confidence, and review state determine what
          appears in public JSON and university pages.
        </p>
      </ReferenceBox>

      <ReferenceBox
        description="Repository-level trust assets for developers, researchers, and data consumers."
        title="GitHub trust assets"
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
          title="Current release manifest"
        >
          <div className="tag-row">
            <MetaLabel label="Release">{manifest.releaseId}</MetaLabel>
            <MetaLabel label="Published">
              {formatDate(manifest.publishedAt)}
            </MetaLabel>
            <MetaLabel label="Promoted runs">
              {manifest.includeStagedArtifactDirectories.length}
            </MetaLabel>
          </div>
          <p className="muted">
            The manifest controls which reviewed staged artifact directories are
            promoted into public pages and <code>/api/public/v1</code> JSON.
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
          <h2>Dataset concepts</h2>
          <p>What the v1 records expose today</p>
        </div>
        <div className="detail-grid">
          {datasetConcepts.map((concept) => (
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
          <h2>License, rights, and citation</h2>
          <p>{TRACKER_METADATA_LICENSE} tracker metadata</p>
        </div>
        <div className="detail-grid">
          <article className="policy-card">
            <h3>Tracker metadata</h3>
            <p>
              Tracker metadata, including normalized entities, claim records,
              review states, and public JSON fields, is intended for{" "}
              {TRACKER_METADATA_LICENSE} reuse with attribution.
            </p>
          </article>
          <article className="policy-card">
            <h3>Official source rights</h3>
            <p>{OFFICIAL_SOURCE_RIGHTS_CAVEAT}</p>
          </article>
          <article className="policy-card">
            <h3>Citation expectations</h3>
            <p>
              Cite the canonical page and public JSON together. For claim-level
              reuse, retain source URL, source language, snapshot hash, review
              state, confidence, and the original evidence snippet.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
        <p>
          Citation rules are documented at <Link href="/citation">/citation</Link>.
          Recent data freshness is visible at <Link href="/changes">/changes</Link>.
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
