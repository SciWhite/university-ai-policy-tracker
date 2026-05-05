import Link from "next/link";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE
} from "@uapt/shared";
import { JsonLd } from "@/components/json-ld";
import { getCatalogUniversities } from "@/lib/catalog";
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
  const universityCount = universities.length;
  const sourceCount = universities.reduce(
    (total, university) => total + university.sources.length,
    0
  );
  const datasetsUrl = getAbsoluteSiteUrl("/datasets");
  const harvardJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/universities/harvard.json`
  );
  const recentChangesUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`
  );

  return (
    <main className="page-shell">
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
              name: "University record JSON example",
              encodingFormat: "application/json",
              contentUrl: harvardJsonUrl
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
        <h1>Public JSON first, dataset releases next</h1>
        <p className="lead">
          The current data surface is versioned public JSON under{" "}
          <code>/api/public/{PUBLIC_API_VERSION}</code>. Bulk JSONL exports,
          checksums, and release identifiers will come after review workflows and
          source-change history are stable.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Current dataset coverage">
        <div>
          <span>{universityCount}</span>
          <p>seed universities</p>
        </div>
        <div>
          <span>{sourceCount}</span>
          <p>seed policy sources</p>
        </div>
        <div>
          <span>{PUBLIC_API_VERSION}</span>
          <p>public JSON schema version</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Versioned JSON endpoints</h2>
          <p>Live read-only routes in the public web app</p>
        </div>
        <ul className="source-list">
          <li>
            <a href={harvardJsonUrl}>
              /api/public/{PUBLIC_API_VERSION}/universities/harvard.json
            </a>
          </li>
          <li>
            <a href={recentChangesUrl}>
              /api/public/{PUBLIC_API_VERSION}/recent-changes.json
            </a>
          </li>
        </ul>
        <p className="muted">
          Additional bulk exports and dataset snapshots are planned, but this page
          does not advertise endpoints that are not live.
        </p>
      </section>

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
