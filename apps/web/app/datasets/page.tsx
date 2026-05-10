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
  const exampleSlug =
    summaries.find((summary) => summary.entity.slug === "harvard-university")
      ?.entity.slug ??
    summaries[0]?.entity.slug ??
    universities[0]?.slug ??
    "harvard-university";
  const exampleUniversityPath = `/api/public/${PUBLIC_API_VERSION}/universities/${exampleSlug}.json`;
  const recentChangesPath = `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`;
  const apiIndexUrl = getAbsoluteSiteUrl(apiIndexPath);
  const universitiesJsonUrl = getAbsoluteSiteUrl(universitiesJsonPath);
  const exampleUniversityUrl = getAbsoluteSiteUrl(exampleUniversityPath);
  const recentChangesUrl = getAbsoluteSiteUrl(recentChangesPath);

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
            }
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
