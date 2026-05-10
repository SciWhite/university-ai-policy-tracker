import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  formatClaimType,
  formatDate,
  getPublicReferenceRecords,
  getThemeLandingSpec,
  getThemeRecords,
  publicJsonPaths,
  referencePageCaveats,
  themeLandingSpecs
} from "@/lib/reference-pages";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface ThemePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export function generateStaticParams() {
  return themeLandingSpecs.map((spec) => ({ slug: spec.slug }));
}

export async function generateMetadata({ params }: ThemePageProps) {
  const { slug } = await params;
  const spec = getThemeLandingSpec(slug);
  const canonical = getAbsoluteSiteUrl(`/themes/${slug}`);

  return {
    title: spec
      ? `${spec.label} | University AI Policy Tracker`
      : "Theme not found",
    description: spec?.description ?? "Theme not found.",
    alternates: { canonical },
    openGraph: {
      title: spec?.title ?? "Theme not found",
      description: spec?.description ?? "Theme not found.",
      url: canonical,
      type: "website"
    }
  };
}

export default async function ThemePage({ params }: ThemePageProps) {
  const { slug } = await params;
  const spec = getThemeLandingSpec(slug);

  if (!spec) notFound();

  const records = getThemeRecords(await getPublicReferenceRecords(), slug);
  const claimCount = records.reduce(
    (total, item) => total + item.claims.length,
    0
  );
  const sourceCount = records.reduce(
    (total, item) => total + item.record.sourceCount,
    0
  );
  const evidenceCount = records.reduce(
    (total, item) =>
      total +
      item.claims.reduce((claimTotal, claim) => claimTotal + claim.evidence.length, 0),
    0
  );
  const canonical = getAbsoluteSiteUrl(`/themes/${slug}`);

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
            name: `${spec.label} claim records`,
            numberOfItems: records.length,
            itemListElement: records.slice(0, 50).map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: getAbsoluteSiteUrl(`/universities/${item.record.slug}`),
              name: item.record.name
            }))
          }
        }}
      />

      <section className="hero">
        <p className="kicker">Theme</p>
        <h1>{spec.title}</h1>
        <p className="lead">
          {spec.description} This page surfaces existing public claim text and
          evidence context. It does not add new policy claims or infer rules that
          are not visible in the linked records.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Theme">{spec.label}</MetaLabel>
          <MetaLabel label="Public JSON">{publicJsonPaths.universities}</MetaLabel>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Theme page coverage">
        <div>
          <span>{records.length}</span>
          <p>matching university records</p>
        </div>
        <div>
          <span>{claimCount}</span>
          <p>matching source-backed claims</p>
        </div>
        <div>
          <span>{evidenceCount}</span>
          <p>evidence records</p>
        </div>
        <div>
          <span>{sourceCount}</span>
          <p>official sources on matching records</p>
        </div>
      </section>

      <ReferenceBox
        description="Visible claim and source context from public university records."
        title="Matching claim records"
      >
        <div className="reference-record-list">
          {records.map(({ record, claims }) => (
            <article className="reference-record-row theme-record-row" key={record.slug}>
              <div>
                <h2>
                  <Link href={`/universities/${record.slug}`}>{record.name}</Link>
                </h2>
                <p>
                  {claims.length} matching claim{claims.length === 1 ? "" : "s"}{" "}
                  from {record.sourceCount} official source
                  {record.sourceCount === 1 ? "" : "s"}.
                </p>
                <div className="tag-row">
                  <MetaLabel label="Last checked">
                    {formatDate(record.lastCheckedAt)}
                  </MetaLabel>
                  {record.reviewState ? (
                    <StateLabel reviewState={record.reviewState} />
                  ) : null}
                  <a href={record.publicJsonUrl}>Public JSON</a>
                </div>
              </div>
              <div className="theme-claim-stack">
                {claims.slice(0, 3).map((claim) => (
                  <section
                    className="theme-claim-summary"
                    key={claim.id ?? claim.claimText}
                  >
                    <div className="tag-row">
                      <MetaLabel label="Claim type">
                        {formatClaimType(claim.claimType)}
                      </MetaLabel>
                      <StateLabel reviewState={claim.reviewState} />
                    </div>
                    <p>{claim.claimText}</p>
                    <p className="muted">
                      Evidence records: {claim.evidence.length}. Original
                      evidence remains canonical on the linked university record
                      and public JSON.
                    </p>
                  </section>
                ))}
              </div>
            </article>
          ))}
        </div>
      </ReferenceBox>

      <ReferenceBox
        description="Theme pages expose index slices, not new conclusions."
        title="Data and advice boundaries"
      >
        <ul className="compact-list">
          {referencePageCaveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
          <li>
            Theme matching is based on visible public claim and evidence text; it
            is not a new review decision.
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
