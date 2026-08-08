import { notFound, permanentRedirect } from "next/navigation";
import {
  getCatalogUniversities,
  getCatalogUniversityBySlug,
  getPublicJsonUrl,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { ClaimEvidenceCard } from "@/components/claim-evidence-card";
import { EntityHeader } from "@/components/entity-header";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { NoReviewedSnapshotState, StudentPolicySnapshot, isStrongStudentSnapshot, normalizeStudentSnapshotRole } from "@/components/student-policy-snapshot";
import { DocumentLink as Link } from "@/components/document-link";
import { normalizeLocale, withLocalePrefix } from "@/lib/i18n";
import { getCanonicalSlugForAlias } from "@/lib/entity-aliases";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getLoadedPolicySnapshotBySlug } from "@/lib/policy-snapshots";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { formatSnapshotHash } from "@/lib/snapshot-hash";
import { getSiteOgImageUrl } from "@/components/site-opengraph";

interface UniversityPageProps {
  params: Promise<{
    locale?: string;
    slug: string;
  }>;
  searchParams?: Promise<{
    for?: string | string[];
  }>;
}

type PublicUniversitySummary = NonNullable<
  Awaited<ReturnType<typeof getPublicUniversitySummaryBySlug>>
>;

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const universities = await getCatalogUniversities();
  return universities.map((university) => ({ slug: university.slug }));
}

export async function generateMetadata({ params }: UniversityPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  await redirectAliasSlug(slug, localeParam);
  const university = await getCatalogUniversityBySlug(slug);
  const publicSummary = await getPublicUniversitySummaryBySlug(slug);
  const displayName = university
    ? getLocalizedInstitutionName(university.slug, university.name, locale)
    : undefined;
  const alternates = getLocalizedAlternates(`/universities/${slug}`, locale);
  const canonical = String(alternates.canonical);
  const title = university
    ? `${displayName} AI policy | University AI Policy Tracker`
    : "University not found";
  const description = university && publicSummary
    ? `${displayName} AI policy record with reviewed claims, official sources, and a student-first policy snapshot.`
    : "University AI Policy Tracker record not found.";

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      images: [getSiteOgImageUrl(locale)],
      url: canonical,
      type: "article"
    }
  };
}

export default async function UniversityPage({
  params,
  searchParams
}: UniversityPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  await redirectAliasSlug(slug, localeParam);

  const [university, publicSummary, loadedSnapshot] = await Promise.all([
    getCatalogUniversityBySlug(slug),
    getPublicUniversitySummaryBySlug(slug),
    getLoadedPolicySnapshotBySlug(slug)
  ]);

  if (!university || !publicSummary) notFound();

  const displayName = getLocalizedInstitutionName(
    university.slug,
    university.name,
    locale
  );
  const publicJsonUrl = publicSummary.apiUrl ?? resolveUrl(
    getPublicJsonUrl(slug),
    publicSummary.canonicalUrl
  );
  const reviewedClaims = publicSummary.claims.filter((claim) =>
    isReviewedClaim(claim.reviewState)
  );
  const strongSnapshot = isStrongStudentSnapshot(loadedSnapshot);
  const role = normalizeStudentSnapshotRole((await searchParams)?.for);
  const citationReadySummary = buildCitationSummary(
    displayName,
    publicSummary,
    publicJsonUrl,
    reviewedClaims.length
  );
  const canonicalUrl = publicSummary.publicPageUrl ?? publicSummary.canonicalUrl;

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: publicSummary.citationTitle,
          description: citationReadySummary,
          url: canonicalUrl,
          dateModified: publicSummary.lastChangedAt ?? publicSummary.lastCheckedAt,
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          mainEntity: {
            "@type": "Dataset",
            name: publicSummary.citationTitle,
            description: citationReadySummary,
            url: canonicalUrl,
            license: "https://creativecommons.org/licenses/by/4.0/",
            isAccessibleForFree: true,
            creator: {
              "@type": "Organization",
              name: "University AI Policy Tracker",
              url: getAbsoluteSiteUrl("/")
            },
            distribution: {
              "@type": "DataDownload",
              name: `${publicSummary.entity.name} public JSON record`,
              encodingFormat: "application/json",
              contentUrl: publicJsonUrl
            }
          }
        }}
      />

      <EntityHeader
        eyebrow={`${university.region}, ${university.country}`}
        metadata={
          <>
            <MetaLabel label="Ranking">
              {formatRanking(university.rankings)}
            </MetaLabel>
            <MetaLabel label="Updated">
              {formatDate(
                publicSummary.lastChangedAt ?? publicSummary.lastCheckedAt,
                locale
              )}
            </MetaLabel>
          </>
        }
        title={<span data-i18n="preserve">{displayName}</span>}
      />

      {strongSnapshot ? (
        <StudentPolicySnapshot
          claims={reviewedClaims}
          entitySlug={slug}
          locale={locale}
          role={role}
          snapshot={loadedSnapshot.snapshot}
        />
      ) : (
        <NoReviewedSnapshotState />
      )}

      <section className="student-record-section" id="claims">
        <div className="section-heading">
          <div>
            <p className="student-policy__eyebrow">Reviewed record</p>
            <h2>Reviewed claims</h2>
          </div>
          <p>{reviewedClaims.length} reviewed claim{reviewedClaims.length === 1 ? "" : "s"}</p>
        </div>
        {reviewedClaims.length ? (
          <div className="claim-list">
            {reviewedClaims.map((claim) => (
              <ClaimEvidenceCard
                claim={claim}
                entitySlug={slug}
                id={claim.id ? `claim-${claim.id}` : undefined}
                key={claim.id ?? claim.claimText}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <p className="notice-card">No reviewed claims are published for this record yet.</p>
        )}
      </section>

      <section className="student-record-section" id="sources">
        <div className="section-heading">
          <div>
            <p className="student-policy__eyebrow">Source record</p>
            <h2>Official sources</h2>
          </div>
          <p>{publicSummary.officialSources.length} source{publicSummary.officialSources.length === 1 ? "" : "s"}</p>
        </div>
        <div className="student-source-attribution-list">
          {publicSummary.officialSources.map((source) => (
            <article
              className="student-source-attribution"
              key={`${source.sourceUrl}:${source.snapshotHash}`}
            >
              <div>
                <h3>{source.citationTitle}</h3>
                <p className="muted">{source.publisher ?? "Official university source"}</p>
              </div>
              <dl>
                <div>
                  <dt>Source URL</dt>
                  <dd>
                    <a
                      data-analytics-entity-slug={slug}
                      data-analytics-event="official_source_click"
                      data-analytics-source-domain={getSourceDomain(source.sourceUrl)}
                      href={source.sourceUrl}
                    >
                      {source.sourceUrl}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Snapshot hash</dt>
                  <dd className="hash-value" title={source.snapshotHash}>
                    {formatSnapshotHash(source.snapshotHash)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="student-record-info" id="record-info">
        <details>
          <summary>Record information, JSON &amp; citation</summary>
          <div className="student-record-info__body">
            <div className="tag-row" id="snapshot-scope">
              <MetaLabel label="Review">
                {formatReviewState(publicSummary.reviewState)}
              </MetaLabel>
              <MetaLabel label="Confidence">
                {publicSummary.confidence === undefined
                  ? "Not listed"
                  : `${Math.round(publicSummary.confidence * 100)}%`}
              </MetaLabel>
              <MetaLabel label="Snapshot status">
                {loadedSnapshot?.validation.effectiveStatus ?? "Not published"}
              </MetaLabel>
              {loadedSnapshot ? (
                <MetaLabel label="Snapshot hash">
                  <span
                    className="hash-value"
                    title={loadedSnapshot.snapshot.basisFingerprint}
                  >
                    {formatSnapshotHash(loadedSnapshot.snapshot.basisFingerprint)}
                  </span>
                </MetaLabel>
              ) : null}
              <MetaLabel label="JSON">
                <a
                  data-analytics-entity-slug={slug}
                  data-analytics-event="record_public_json_click"
                  href={publicJsonUrl}
                >
                  Public JSON
                </a>
              </MetaLabel>
            </div>
            <p className="student-record-info__citation">
              <strong>Citation:</strong> {publicSummary.suggestedCitation}
            </p>
            <p className="muted">
              Original university source language remains canonical. This tracker is not an official university statement.
            </p>
            <Link className="site-action" href={`/changes/${slug}`}>
              Open change log
            </Link>
          </div>
        </details>
      </section>
    </main>
  );
}

async function redirectAliasSlug(
  slug: string,
  localeParam: string | undefined
): Promise<void> {
  const canonicalSlug = await getCanonicalSlugForAlias(slug);
  if (canonicalSlug) {
    permanentRedirect(
      withLocalePrefix(
        `/universities/${canonicalSlug}`,
        normalizeLocale(localeParam)
      )
    );
  }
}

function isReviewedClaim(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function formatRanking(
  rankings: Array<{ systemId: string; systemName: string; rankingYear: number | string; rankText: string }>
): string {
  const ranking = rankings.find((item) => item.systemId === "qs") ?? rankings[0];
  return ranking
    ? `${ranking.systemName} ${ranking.rankingYear}: ${ranking.rankText}`
    : "Not listed";
}

function formatDate(value: string | undefined, locale: string): string {
  if (!value) return "Not listed";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatReviewState(value: string): string {
  return value.replaceAll("_", " ");
}

function resolveUrl(pathOrUrl: string, baseUrl: string): string {
  return new URL(pathOrUrl, baseUrl).toString();
}

function getSourceDomain(href: string): string | undefined {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function buildCitationSummary(
  displayName: string,
  summary: PublicUniversitySummary,
  publicJsonUrl: string,
  reviewedClaimCount: number
): string {
  const update = summary.lastCheckedAt
    ? ` Last checked ${formatDate(summary.lastCheckedAt, "en")}.`
    : "";
  return `${displayName} AI policy record with ${reviewedClaimCount} reviewed claim${reviewedClaimCount === 1 ? "" : "s"} from ${summary.officialSources.length} official source${summary.officialSources.length === 1 ? "" : "s"}.${update} Public JSON: ${publicJsonUrl}.`;
}
