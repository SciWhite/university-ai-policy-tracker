import Link from "next/link";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE
} from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { CitationCopyActions } from "@/components/citation-copy-actions";
import { JsonLd } from "@/components/json-ld";
import { ReferenceBox } from "@/components/reference-box";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Citation | University AI Policy Tracker";
const description =
  "Citation formats, source attribution rules, public JSON fields, rights caveats, and advice boundaries for University AI Policy Tracker.";

const exampleUniversitySlug = "anu";
const citationAnswers = [
  {
    title: "How to cite a university record",
    text:
      "Cite the canonical visible record page and the matching public JSON URL together, then preserve source URL, review state, confidence, and last checked date."
  },
  {
    title: "How to cite claim evidence",
    text:
      "For claim-level reuse, include claim text, original-language evidence snippet, source language, source URL, snapshot hash, confidence, and review state."
  },
  {
    title: "What not to cite as official",
    text:
      "University AI Policy Tracker metadata is not an official university statement; cite linked official sources separately for institutional policy wording."
  }
] as const;

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
  const universityJsonPath = `/api/public/${PUBLIC_API_VERSION}/universities/${exampleUniversitySlug}.json`;
  const universityJsonUrl = getAbsoluteSiteUrl(universityJsonPath);
  const datasetsUrl = getAbsoluteSiteUrl("/datasets");
  const changesUrl = getAbsoluteSiteUrl("/changes");
  const apiIndexPath = `/api/public/${PUBLIC_API_VERSION}/index.json`;
  const universitiesJsonPath = `/api/public/${PUBLIC_API_VERSION}/universities.json`;
  const recentChangesPath = `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`;
  const apiIndexUrl = getAbsoluteSiteUrl(apiIndexPath);
  const universitiesJsonUrl = getAbsoluteSiteUrl(universitiesJsonPath);
  const recentChangesUrl = getAbsoluteSiteUrl(recentChangesPath);

  const universityCitation =
    "Australian National University AI Policy Tracker record. University AI Policy Tracker. Version v1. " +
    universityCanonicalUrl;
  const datasetCitation =
    "University AI Policy Tracker public JSON dataset. University AI Policy Tracker. Version v1. " +
    datasetsUrl;
  const changesCitation =
    "University AI Policy Tracker recent changes. University AI Policy Tracker. Version v1. " +
    changesUrl;

  return (
    <main className="page-shell">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: citationAnswers.map((answer) => ({
            "@type": "Question",
            name: answer.title,
            acceptedAnswer: {
              "@type": "Answer",
              text: answer.text
            }
          }))
        }}
      />
      <section className="hero">
        <p className="kicker">Citation</p>
        <h1>Cite tracker metadata and official sources separately</h1>
        <p className="lead">
          Keep the canonical page, public JSON, source URL, snapshot hash, review
          state, confidence, and original evidence together.
        </p>
      </section>

      <section className="answer-strip" aria-label="Citation answer blocks">
        {citationAnswers.map((answer) => (
          <article className="answer-card" key={answer.title}>
            <h2>{answer.title}</h2>
            <p>{answer.text}</p>
          </article>
        ))}
      </section>

      <div className="docs-layout">
        <aside className="docs-toc" aria-label="Citation sections">
          <a href="#formats">Suggested formats</a>
          <a href="#fields">Citation fields</a>
          <a href="#json">Public JSON</a>
          <a href="#ranking-sources">Ranking sources</a>
          <a href="#rights">Rights and boundaries</a>
        </aside>

        <div className="docs-content">
          <ReferenceBox
            description="Copy-ready examples."
            id="formats"
            title="Suggested formats"
          >
            <article className="citation-example">
              <h3>University policy record</h3>
              <pre>
                <code>{universityCitation}</code>
              </pre>
              <CitationCopyActions
                canonicalUrl={universityCanonicalUrl}
                citationText={universityCitation}
                publicJsonUrl={universityJsonUrl}
              />
            </article>
            <article className="citation-example">
              <h3>Dataset surface</h3>
              <pre>
                <code>{datasetCitation}</code>
              </pre>
              <CitationCopyActions
                canonicalUrl={datasetsUrl}
                citationText={datasetCitation}
                publicJsonUrl={universitiesJsonUrl}
              />
            </article>
            <article className="citation-example">
              <h3>Changes feed or report</h3>
              <pre>
                <code>{changesCitation}</code>
              </pre>
              <CitationCopyActions
                canonicalUrl={changesUrl}
                citationText={changesCitation}
                publicJsonUrl={recentChangesUrl}
              />
            </article>
          </ReferenceBox>

          <ReferenceBox
            description="Retain these fields."
            id="fields"
            title="Citation fields"
          >
            <div className="docs-grid">
              <section>
                <h3>Page and data identity</h3>
                <ul className="compact-list">
                  <li>Canonical URL for the visible public page.</li>
                  <li>
                    Versioned public JSON URL under{" "}
                    <code>/api/public/{PUBLIC_API_VERSION}</code>.
                  </li>
                  <li>
                    Public pages and public JSON should describe the same
                    promoted public release record.
                  </li>
                  <li>Schema version, currently <code>{PUBLIC_API_VERSION}</code>.</li>
                </ul>
              </section>
              <section>
                <h3>Freshness and review</h3>
                <ul className="compact-list">
                  <li>Last checked date, when the source was most recently checked.</li>
                  <li>Last changed date, when a tracked source or claim changed.</li>
                  <li>Review state, which is separate from machine confidence.</li>
                </ul>
              </section>
              <section>
                <h3>Source evidence</h3>
                <ul className="compact-list">
                  <li>Official or clearly labeled source URLs.</li>
                  <li>Source snapshot hashes for change and citation traceability.</li>
                  <li>Short original-language evidence snippets and source language.</li>
                </ul>
              </section>
            </div>
          </ReferenceBox>

          <ReferenceBox
            description="Versioned records for reuse."
            id="json"
            title="Public JSON examples"
          >
            <ApiEndpointRow
              description="API discovery document with endpoint and trust-page links."
              label="API index"
              path={apiIndexPath}
              url={apiIndexUrl}
            />
            <ApiEndpointRow
              description="University list with canonical page and JSON URLs."
              label="Universities list"
              path={universitiesJsonPath}
              url={universitiesJsonUrl}
            />
            <ApiEndpointRow
              description="Claim/evidence/citation record for one university."
              label="University record"
              path={universityJsonPath}
              url={universityJsonUrl}
            />
            <ApiEndpointRow
              description="Recent checked and changed records."
              label="Recent changes"
              path={recentChangesPath}
              url={recentChangesUrl}
            />
          </ReferenceBox>

          <ReferenceBox
            className="compact-reference-box"
            description="Reference indexes, not policy rankings."
            id="ranking-sources"
            title="Ranking source citation boundaries"
          >
            <ul className="compact-list">
              <li>
                QS 2026 currently remains the main crawl batching source.
              </li>
              <li>
                THE 2026, ARWU 2025, U.S. News 2025-2026, and CWTS Leiden 2025
                are supported as ranking, index, and filter sources.
              </li>
              <li>
                CWTS Leiden 2025 is a derived metric order, not an overall
                global university rank.
              </li>
              <li>
                Do not cite mixed ranking years as one unified 2026 ranking.
                Cite the tracker record and public JSON for policy evidence, and
                cite the relevant ranking source separately when ranking context
                matters.
              </li>
            </ul>
          </ReferenceBox>

          <ReferenceBox
            description={`${TRACKER_METADATA_LICENSE} tracker metadata`}
            id="rights"
            title="Rights and boundaries"
          >
            <ul className="compact-list">
              <li>{OFFICIAL_SOURCE_RIGHTS_CAVEAT}</li>
              <li>{NO_ADVICE_BOUNDARY}</li>
              <li>
                Original-language evidence is canonical. Translations or
                localized summaries are display aids only and must not overwrite
                source evidence.
              </li>
            </ul>
          </ReferenceBox>

          <section className="section">
            <p>
              Browse <Link href="/universities">university records</Link>, read the{" "}
              <Link href="/methodology">methodology</Link>, or review{" "}
              <Link href="/datasets">dataset access</Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
