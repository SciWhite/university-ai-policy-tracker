import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  countCandidateClaims,
  countReviewedClaims,
  formatDate,
  getPublicReferenceRecords,
  getRegionLandingSpec,
  publicJsonPaths,
  referencePageCaveats,
  regionLandingSpecs
} from "@/lib/reference-pages";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { normalizeLocale } from "@/lib/i18n";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";

interface RegionPageProps {
  params: Promise<{
    locale?: string;
    slug: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export function generateStaticParams() {
  return regionLandingSpecs.map((spec) => ({ slug: spec.slug }));
}

export async function generateMetadata({ params }: RegionPageProps) {
  const { slug } = await params;
  const spec = getRegionLandingSpec(slug);
  const canonical = getAbsoluteSiteUrl(`/regions/${slug}`);

  return {
    title: spec
      ? `${spec.label} | University AI Policy Tracker`
      : "Region not found",
    description: spec?.description ?? "Region not found.",
    alternates: getLocalizedAlternates(`/regions/${slug}`, "en"),
    openGraph: {
      title: spec?.title ?? "Region not found",
      description: spec?.description ?? "Region not found.",
      url: canonical,
      type: "website"
    }
  };
}

export default async function RegionPage({ params }: RegionPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const spec = getRegionLandingSpec(slug);

  if (!spec) notFound();

  const countrySet = new Set(
    spec.countries.map((country) => country.toLowerCase())
  );
  const records = (await getPublicReferenceRecords())
    .filter((record) => countrySet.has(record.country.toLowerCase()))
    .sort((left, right) => left.name.localeCompare(right.name));
  const claimCount = records.reduce(
    (total, record) => total + record.claimCount,
    0
  );
  const sourceCount = records.reduce(
    (total, record) => total + record.sourceCount,
    0
  );
  const reviewedClaimCount = records.reduce(
    (total, record) => total + countReviewedClaims(record),
    0
  );
  const canonical = getAbsoluteSiteUrl(`/regions/${slug}`);

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: spec.title,
          description: spec.description,
          url: canonical,
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          mainEntity: {
            "@type": "ItemList",
            name: `${spec.label} university AI policy records`,
            numberOfItems: records.length,
            itemListElement: records.slice(0, 50).map((record, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: getAbsoluteSiteUrl(`/universities/${record.slug}`),
              name: record.name
            }))
          }
        }}
      />

      <section className="hero">
        <p className="kicker">Region</p>
        <h1>{spec.title}</h1>
        <p className="lead">
          {spec.description} This page links to crawlable university records,
          official sources, claim counts, review state, and versioned public
          JSON.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Region">{spec.label}</MetaLabel>
          <MetaLabel label="Public JSON">{publicJsonPaths.universities}</MetaLabel>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Region page coverage">
        <div>
          <span>{records.length}</span>
          <p>public university records</p>
        </div>
        <div>
          <span>{claimCount}</span>
          <p>source-backed claims</p>
        </div>
        <div>
          <span>{reviewedClaimCount}</span>
          <p>reviewed claims</p>
        </div>
        <div>
          <span>{sourceCount}</span>
          <p>official sources</p>
        </div>
      </section>

      <ReferenceBox
        description="Linked records from the same public dataset used by /universities."
        title="University records"
      >
        <div className="reference-record-list">
          {records.map((record) => (
            <article className="reference-record-row" key={record.slug}>
              <div>
                <h2>
                  <Link data-i18n="preserve" href={`/universities/${record.slug}`}>{record.name}</Link>
                </h2>
                <p>
                  {record.summary ??
                    "Public record with source-backed claims and official sources."}
                </p>
                <div className="tag-row">
                  <MetaLabel label="Claims">{record.claimCount}</MetaLabel>
                  <MetaLabel label="Reviewed">
                    {countReviewedClaims(record)}
                  </MetaLabel>
                  <MetaLabel label="Candidate">
                    {countCandidateClaims(record)}
                  </MetaLabel>
                  <MetaLabel label="Sources">{record.sourceCount}</MetaLabel>
                  {record.reviewState ? (
                    <StateLabel reviewState={record.reviewState} />
                  ) : null}
                </div>
              </div>
              <dl className="reference-record-row__meta">
                <div>
                  <dt>Last checked</dt>
                  <dd>{formatDate(record.lastCheckedAt, locale)}</dd>
                </div>
                <div>
                  <dt>Last changed</dt>
                  <dd>{formatDate(record.lastChangedAt, locale)}</dd>
                </div>
                <div>
                  <dt>Public JSON</dt>
                  <dd>
                    <a href={record.publicJsonUrl}>Open record JSON</a>
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </ReferenceBox>

      <ReferenceBox
        description="Reference boundaries for regional aggregation."
        title="Data and advice boundaries"
      >
        <ul className="compact-list">
          {referencePageCaveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
          <li>
            Region pages aggregate existing source-backed records. They do not
            infer a regional policy rule.
          </li>
        </ul>
        <p>
          Browse all records at <Link href="/universities">/universities</Link>{" "}
          or inspect the dataset at{" "}
          <a href={publicJsonPaths.universities}>{publicJsonPaths.universities}</a>.
        </p>
      </ReferenceBox>
    </main>
  );
}
