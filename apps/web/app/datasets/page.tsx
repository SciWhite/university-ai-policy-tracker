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
  const latestDatasetManifestPath = `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`;
  const exampleSlug =
    summaries.find((summary) => summary.entity.slug === "anu")
      ?.entity.slug ??
    summaries[0]?.entity.slug ??
    universities[0]?.slug ??
    "anu";
  const exampleUniversityPath = `/api/public/${PUBLIC_API_VERSION}/universities/${exampleSlug}.json`;
  const recentChangesPath = `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`;
  const reportChartDataPath = `/api/public/${PUBLIC_API_VERSION}/reports/2026-05/chart-data.json`;
  const widgetIndexPath = `/api/public/${PUBLIC_API_VERSION}/widgets/index.json`;
  const mcpManifestPath = `/api/public/${PUBLIC_API_VERSION}/mcp/manifest.json`;
  const contributionIndexPath = `/api/public/${PUBLIC_API_VERSION}/contributions/index.json`;
  const reviewPolicyPath = `/api/public/${PUBLIC_API_VERSION}/contributions/review-policy.json`;
  const apiIndexUrl = getAbsoluteSiteUrl(apiIndexPath);
  const universitiesJsonUrl = getAbsoluteSiteUrl(universitiesJsonPath);
  const latestDatasetManifestUrl = getAbsoluteSiteUrl(
    latestDatasetManifestPath
  );
  const exampleUniversityUrl = getAbsoluteSiteUrl(exampleUniversityPath);
  const recentChangesUrl = getAbsoluteSiteUrl(recentChangesPath);
  const reportChartDataUrl = getAbsoluteSiteUrl(reportChartDataPath);
  const widgetIndexUrl = getAbsoluteSiteUrl(widgetIndexPath);
  const mcpManifestUrl = getAbsoluteSiteUrl(mcpManifestPath);
  const contributionIndexUrl = getAbsoluteSiteUrl(contributionIndexPath);
  const reviewPolicyUrl = getAbsoluteSiteUrl(reviewPolicyPath);

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
              name: "University record JSON example",
              encodingFormat: "application/json",
              contentUrl: exampleUniversityUrl
            },
            {
              "@type": "DataDownload",
              name: "Recent changes JSON",
              encodingFormat: "application/json",
              contentUrl: recentChangesUrl
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
              name: "Read-only MCP alpha manifest",
              encodingFormat: "application/json",
              contentUrl: mcpManifestUrl
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
          description="Example university-level record with claims, evidence, official sources, and citation fields."
          label="Per-university JSON example"
          path={exampleUniversityPath}
          url={exampleUniversityUrl}
        />
        <ApiEndpointRow
          description="Freshness feed for checked and changed public records."
          label="Recent changes JSON"
          path={recentChangesPath}
          url={recentChangesUrl}
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
          description="Read-only MCP alpha design manifest for agent integrations."
          label="MCP alpha manifest"
          path={mcpManifestPath}
          url={mcpManifestUrl}
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
