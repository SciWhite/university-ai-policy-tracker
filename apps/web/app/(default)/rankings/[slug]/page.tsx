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
  getRankingLandingSpec,
  getSelectedRanking,
  publicJsonPaths,
  rankingLandingSpecs,
  referencePageCaveats
} from "@/lib/reference-pages";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { normalizeLocale } from "@/lib/i18n";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";

interface RankingPageProps {
  params: Promise<{
    locale?: string;
    slug: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export function generateStaticParams() {
  return rankingLandingSpecs.map((spec) => ({ slug: spec.slug }));
}

export async function generateMetadata({ params }: RankingPageProps) {
  const { slug } = await params;
  const spec = getRankingLandingSpec(slug);
  const canonical = getAbsoluteSiteUrl(`/rankings/${slug}`);

  return {
    title: spec
      ? `${spec.label} | University AI Policy Tracker`
      : "Ranking index not found",
    description: spec?.description ?? "Ranking index not found.",
    alternates: getLocalizedAlternates(`/rankings/${slug}`, "en"),
    openGraph: {
      title: spec?.title ?? "Ranking index not found",
      description: spec?.description ?? "Ranking index not found.",
      url: canonical,
      type: "website"
    }
  };
}

export default async function RankingPage({ params }: RankingPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const spec = getRankingLandingSpec(slug);

  if (!spec) notFound();

  const records = await getPublicReferenceRecords();
  const rankedRecords = records
    .map((record) => ({
      record,
      ranking: getSelectedRanking(record, spec.systemId)
    }))
    .filter((item) => item.ranking)
    .sort(
      (left, right) =>
        (left.ranking?.rankNumber ?? Number.MAX_SAFE_INTEGER) -
        (right.ranking?.rankNumber ?? Number.MAX_SAFE_INTEGER)
    );
  const claimCount = rankedRecords.reduce(
    (total, item) => total + item.record.claimCount,
    0
  );
  const sourceCount = rankedRecords.reduce(
    (total, item) => total + item.record.sourceCount,
    0
  );
  const reviewedClaimCount = rankedRecords.reduce(
    (total, item) => total + countReviewedClaims(item.record),
    0
  );
  const canonical = getAbsoluteSiteUrl(`/rankings/${slug}`);

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
            numberOfItems: rankedRecords.length,
            itemListElement: rankedRecords.slice(0, 50).map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: getAbsoluteSiteUrl(`/universities/${item.record.slug}`),
              name: item.record.name
            }))
          }
        }}
      />

      <section className="hero">
        <p className="kicker">Ranking index</p>
        <h1>{spec.title}</h1>
        <p className="lead">
          {spec.description} Ranking rows are used for discovery, filtering, and
          reference navigation. They are not university AI policy conclusions.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Ranking source">{spec.label}</MetaLabel>
          <MetaLabel label="Source year">{spec.yearLabel}</MetaLabel>
          <MetaLabel label="Public JSON">{publicJsonPaths.universities}</MetaLabel>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Ranking page coverage">
        <div>
          <span>{rankedRecords.length}</span>
          <p>indexed public records</p>
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
        description="Ranking data boundaries for this reference page."
        title="Ranking caveats"
      >
        <ul className="compact-list">
          <li>{spec.sourceRole}</li>
          <li>{spec.rankTypeNote}</li>
          <li>{spec.caveat}</li>
          <li>
            THE 2026, ARWU 2025, U.S. News 2025-2026, and CWTS Leiden 2025 are
            supported as ranking, index, and filter sources.
          </li>
          <li>
            Different ranking years are not presented as one unified 2026
            ranking.
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox
        description="Linked university records with policy evidence counts and public JSON references."
        title="Indexed university records"
      >
        <div className="reference-table-wrap">
          <table className="reference-table">
            <thead>
              <tr>
                <th>Rank row</th>
                <th>University record</th>
                <th>Claims</th>
                <th>Sources</th>
                <th>Freshness</th>
              </tr>
            </thead>
            <tbody>
              {rankedRecords.map(({ record, ranking }) => (
                <tr key={record.slug}>
                  <td>
                    <span className="ranking-cell">
                      <strong>{ranking?.rankText}</strong>
                      <span>
                        {ranking?.systemName} {ranking?.rankingYear}
                        {ranking?.rankType === "derived_metric_order"
                          ? " / derived order"
                          : ""}
                      </span>
                    </span>
                  </td>
                  <td>
                    <Link className="table-record-title" href={`/universities/${record.slug}`}>
                      <span data-i18n="preserve">{record.name}</span>
                    </Link>
                    <p className="table-record-subtitle">
                      {record.country} / {record.region}
                    </p>
                    <div className="table-record-meta">
                      {record.reviewState ? (
                        <StateLabel reviewState={record.reviewState} />
                      ) : null}
                      <a href={record.publicJsonUrl}>Public JSON</a>
                    </div>
                  </td>
                  <td>
                    {record.claimCount} total
                    <br />
                    <span className="table-muted">
                      {countReviewedClaims(record)} reviewed /{" "}
                      {countCandidateClaims(record)} candidate
                    </span>
                  </td>
                  <td>{record.sourceCount}</td>
                  <td>
                    <span className="table-muted">
                      Checked {formatDate(record.lastCheckedAt, locale)}
                      <br />
                      Changed {formatDate(record.lastChangedAt, locale)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReferenceBox>

      <ReferenceBox
        description="Public pages and API records share the same promoted public dataset."
        title="Data and advice boundaries"
      >
        <ul className="compact-list">
          {referencePageCaveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
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
