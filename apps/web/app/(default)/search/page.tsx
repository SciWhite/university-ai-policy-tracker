import {getDiscoveryTopicKeys} from "@/lib/discovery-topic-groups";
import { JsonLd } from "@/components/json-ld";
import { DocumentLink as Link } from "@/components/document-link";
import { DiscoverySearch } from "@/components/discovery-search";
import { getSearchIndexRecords, searchIndexRecords } from "@/lib/entity-search";
import { getStagedPublicDataset } from "@/lib/staged-public-data";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n";
import { discoveryCopy } from "@/lib/discovery-copy";
import type { DiscoveryEvidence } from "@/lib/discovery-types";

const searchCopy = Object.fromEntries(
  (["en", "zh", "fr", "pl", "es", "nl", "ms"] as SupportedLocale[]).map(
    (locale) => {
      const c = discoveryCopy(locale);
      return [locale, { title: c.searchTitle, description: c.searchLead }];
    },
  ),
) as Record<SupportedLocale, { title: string; description: string }>;

interface SearchPageProps {
  params?: Promise<{
    locale?: string;
  }>;
  searchParams: Promise<{
    q?: string;
  }>;
}

export async function generateMetadata({
  params,
}: Pick<SearchPageProps, "params">) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = searchCopy[locale];
  const alternates = getLocalizedAlternates("/search", locale);
  const canonical = String(alternates.canonical);

  return {
    title: `${copy.title} | University AI Policy Tracker`,
    description: copy.description,
    alternates,
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      type: "website",
    },
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: SearchPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = discoveryCopy(locale);
  const resolved = await searchParams;
  const query =
    typeof resolved.q === "string" ? resolved.q.trim().slice(0, 300) : "";
  const [index, dataset] = await Promise.all([
    getSearchIndexRecords(),
    getStagedPublicDataset(),
  ]);
  const matched = query
    ? searchIndexRecords(index, query, { limit: 50 })
    : [...index]
        .sort(
          (a, b) =>
            b.claimCount - a.claimCount || b.sourceCount - a.sourceCount,
        )
        .slice(0, 8)
        .map((r) => ({
          entitySlug: r.entitySlug,
          score: 0,
          sourceBackedSnippet: r.fields.summary,
        }));
  const bySlug = new Map(
    dataset.publicSummaries.map((r) => [r.entity.slug, r]),
  );
  const indexBySlug = new Map(index.map((r) => [r.entitySlug, r]));
  const records = matched.map((result) => {
    const record = indexBySlug.get(result.entitySlug)!;
    const summary = bySlug.get(result.entitySlug);
    return {
      slug: record.entitySlug,
      name: record.entityName,
      country: record.country,
      region: record.region,
      lastCheckedAt: record.lastCheckedAt,
      summary: result.sourceBackedSnippet,
      topics: [...new Set(summary?.claims.flatMap(getDiscoveryTopicKeys) ?? [])],
      relevance: result.score,
    };
  });
  const evidence: DiscoveryEvidence[] = [];
  if (query)
    for (const result of matched) {
      const summary = bySlug.get(result.entitySlug);
      if (!summary) continue;
      const term = query.toLocaleLowerCase();
      const claims = [...summary.claims].sort(
        (a, b) =>
          Number(b.claimText.toLocaleLowerCase().includes(term)) -
          Number(a.claimText.toLocaleLowerCase().includes(term)),
      );
      for (const claim of claims.slice(0, 2)) {
        const source = claim.evidence[0];
        if (!source) continue;
        const ordinal = summary.claims.indexOf(claim);
        evidence.push({
          id: result.entitySlug + ":" + (claim.id ?? ordinal),
          slug: result.entitySlug,
          universityName: summary.entity.name,
          country: indexBySlug.get(result.entitySlug)?.country,
          topic: claim.claimType,
          topics: getDiscoveryTopicKeys(claim),
          claimText: claim.claimText,
          snippet: source.evidenceSnippet,
          official: source.attribution.official !== false,
          sourceUrl: source.sourceUrl,
          sourceTitle: source.attribution.citationTitle,
          sourceLanguage: source.sourceLanguage,
          claimUrl: `/universities/${result.entitySlug}#${claim.id ? `claim-${claim.id}` : "claims"}`,
        });
      }
    }
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SearchResultsPage",
          name: copy.searchTitle,
          description: copy.searchLead,
          url: getAbsoluteSiteUrl(
            query ? `/search?q=${encodeURIComponent(query)}` : "/search",
          ),
        }}
      />
      <DiscoverySearch
        locale={locale}
        query={query}
        records={records}
        evidence={evidence}
      >
        <ul className="compact-link-list">
          <li>
            <a
              href={`/api/public/v1/search.json?q=${encodeURIComponent(query || "mit")}`}
            >
              {copy.search} JSON
            </a>
          </li>
          <li>
            <a href="/api/public/v1/search/index.json">
              {copy.universities} JSON
            </a>
          </li>
          <li>
            <Link href="/api-reference">API</Link>
          </li>
        </ul>
      </DiscoverySearch>
    </>
  );
}
