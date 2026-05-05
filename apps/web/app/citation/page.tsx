import Link from "next/link";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE
} from "@uapt/shared";
import { CitationCopyActions } from "@/components/citation-copy-actions";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Citation | University AI Policy Tracker";
const description =
  "Citation formats, source attribution rules, public JSON fields, rights caveats, and advice boundaries for University AI Policy Tracker.";

const exampleUniversitySlug = "harvard";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/citation");

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

export default function CitationPage() {
  const universityCanonicalUrl = getAbsoluteSiteUrl(
    `/universities/${exampleUniversitySlug}`
  );
  const universityJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/universities/${exampleUniversitySlug}.json`
  );
  const datasetsUrl = getAbsoluteSiteUrl("/datasets");
  const recentChangesUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`
  );
  const changesUrl = getAbsoluteSiteUrl("/changes");

  const universityCitation =
    "Harvard University AI Policy Tracker record. University AI Policy Tracker. Last checked 2026-05-03. " +
    universityCanonicalUrl;
  const datasetCitation =
    "University AI Policy Tracker public JSON dataset. University AI Policy Tracker. Version v1. " +
    datasetsUrl;
  const changesCitation =
    "University AI Policy Tracker recent changes. University AI Policy Tracker. Version v1. " +
    changesUrl;

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Citation</p>
        <h1>Cite tracker metadata and official sources separately</h1>
        <p className="lead">
          Public records are designed for citation, but tracker metadata does not
          relicense official university documents or replace official policy text.
          Keep the canonical page, public JSON, source URL, snapshot hash, and
          original evidence together when citing a claim.
        </p>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Suggested formats</h2>
          <p>Copy-ready examples for common references</p>
        </div>
        <div className="detail-grid">
          <article className="policy-card">
            <h3>University policy page</h3>
            <p>{universityCitation}</p>
            <CitationCopyActions
              canonicalUrl={universityCanonicalUrl}
              citationText={universityCitation}
              publicJsonUrl={universityJsonUrl}
            />
          </article>
          <article className="policy-card">
            <h3>Dataset snapshot</h3>
            <p>{datasetCitation}</p>
            <CitationCopyActions
              canonicalUrl={datasetsUrl}
              citationText={datasetCitation}
              publicJsonUrl={recentChangesUrl}
            />
          </article>
          <article className="policy-card">
            <h3>Monthly report or change page</h3>
            <p>{changesCitation}</p>
            <CitationCopyActions
              canonicalUrl={changesUrl}
              citationText={changesCitation}
              publicJsonUrl={recentChangesUrl}
            />
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Citation fields</h2>
          <p>Fields to retain when reusing a public record</p>
        </div>
        <div className="detail-grid">
          <article className="policy-card">
            <h3>Page and data identity</h3>
            <ul className="compact-list">
              <li>Canonical URL for the visible public page.</li>
              <li>Versioned public JSON URL under <code>/api/public/{PUBLIC_API_VERSION}</code>.</li>
              <li>Schema version, currently <code>{PUBLIC_API_VERSION}</code>.</li>
            </ul>
          </article>
          <article className="policy-card">
            <h3>Freshness and review</h3>
            <ul className="compact-list">
              <li>Last checked date, when the source was most recently checked.</li>
              <li>Last changed date, when a tracked source or claim last changed.</li>
              <li>Review state, which is separate from machine confidence.</li>
            </ul>
          </article>
          <article className="policy-card">
            <h3>Source evidence</h3>
            <ul className="compact-list">
              <li>Official or clearly labeled source URLs.</li>
              <li>Source snapshot hashes for change and citation traceability.</li>
              <li>Short original-language evidence snippets and source language.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Public JSON examples</h2>
          <p>Versioned, source-backed records</p>
        </div>
        <ul className="source-list">
          <li>
            <a href={universityJsonUrl}>
              /api/public/{PUBLIC_API_VERSION}/universities/{exampleUniversitySlug}.json
            </a>
          </li>
          <li>
            <a href={recentChangesUrl}>
              /api/public/{PUBLIC_API_VERSION}/recent-changes.json
            </a>
          </li>
        </ul>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Rights and boundaries</h2>
          <p>{TRACKER_METADATA_LICENSE} tracker metadata</p>
        </div>
        <ul className="compact-list">
          <li>{OFFICIAL_SOURCE_RIGHTS_CAVEAT}</li>
          <li>{NO_ADVICE_BOUNDARY}</li>
          <li>
            Original-language evidence is canonical. Translations or localized
            summaries are display aids only and must not overwrite source evidence.
          </li>
        </ul>
      </section>

      <section className="section">
        <p>
          Browse <Link href="/universities">university records</Link>, read the{" "}
          <Link href="/methodology">methodology</Link>, or review{" "}
          <Link href="/datasets">dataset access</Link>.
        </p>
      </section>
    </main>
  );
}
