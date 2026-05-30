import { DocumentLink as Link } from "@/components/document-link";
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
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";
import { getPageCopy } from "@/lib/page-copy";

const exampleUniversitySlug = "anu";

interface CitationPageProps {
  params?: Promise<{
    locale?: string;
  }>;
}

export async function generateMetadata({
  params
}: CitationPageProps = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).citation;
  const alternates = getLocalizedAlternates("/citation", locale);
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

export default async function CitationPage({ params }: CitationPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).citation;
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
          mainEntity: copy.answers.map((answer) => ({
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
        <p className="kicker">{copy.kicker}</p>
        <h1>{copy.heading}</h1>
        <p className="lead">{copy.lead}</p>
      </section>

      <section className="answer-strip" aria-label={copy.answersLabel}>
        {copy.answers.map((answer) => (
          <article className="answer-card" key={answer.title}>
            <h2>{answer.title}</h2>
            <p>{answer.text}</p>
          </article>
        ))}
      </section>

      <div className="docs-layout">
        <aside className="docs-toc" aria-label={copy.tocLabel}>
          <a href="#formats">{copy.toc.formats}</a>
          <a href="#fields">{copy.toc.fields}</a>
          <a href="#json">{copy.toc.json}</a>
          <a href="#ranking-sources">{copy.toc.ranking}</a>
          <a href="#rights">{copy.toc.rights}</a>
        </aside>

        <div className="docs-content">
          <ReferenceBox
            description={copy.formatsDescription}
            id="formats"
            title={copy.toc.formats}
          >
            <article className="citation-example">
              <h3>{copy.universityPolicyRecord}</h3>
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
              <h3>{copy.datasetSurface}</h3>
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
              <h3>{copy.changesFeed}</h3>
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
            description={copy.fieldsDescription}
            id="fields"
            title={copy.toc.fields}
          >
            <div className="docs-grid">
              <section>
                <h3>{copy.pageDataIdentity}</h3>
                <ul className="compact-list">
                  {copy.identityRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>{copy.freshnessReview}</h3>
                <ul className="compact-list">
                  {copy.freshnessRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>{copy.sourceEvidence}</h3>
                <ul className="compact-list">
                  {copy.evidenceRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </section>
            </div>
          </ReferenceBox>

          <ReferenceBox
            description={copy.jsonDescription}
            id="json"
            title={copy.toc.json}
          >
            <ApiEndpointRow
              description="API discovery document with endpoint and trust-page links."
              label={copy.apiIndex}
              path={apiIndexPath}
              url={apiIndexUrl}
            />
            <ApiEndpointRow
              description="University list with canonical page and JSON URLs."
              label={copy.universitiesList}
              path={universitiesJsonPath}
              url={universitiesJsonUrl}
            />
            <ApiEndpointRow
              description="Claim/evidence/citation record for one university."
              label={copy.universityRecord}
              path={universityJsonPath}
              url={universityJsonUrl}
            />
            <ApiEndpointRow
              description="Recent checked and changed records."
              label={copy.recentChanges}
              path={recentChangesPath}
              url={recentChangesUrl}
            />
          </ReferenceBox>

          <ReferenceBox
            className="compact-reference-box"
            description={copy.rankingDescription}
            id="ranking-sources"
            title={copy.toc.ranking}
          >
            <ul className="compact-list">
              {copy.rankingRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </ReferenceBox>

          <ReferenceBox
            description={`${TRACKER_METADATA_LICENSE} ${copy.rightsDescription}`}
            id="rights"
            title={copy.toc.rights}
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
              {copy.browsePrefix}{" "}
              <Link href="/universities">{copy.universityRecords}</Link>,{" "}
              {copy.readPrefix} <Link href="/methodology">{copy.methodology}</Link>,{" "}
              {copy.reviewPrefix} <Link href="/datasets">{copy.datasetAccess}</Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
