import { notFound } from "next/navigation";
import { DocumentLink as Link } from "./document-link";
import { JsonLd } from "./json-ld";
import { RankingRecordsView } from "./ranking-records-view";
import { getRankingsDirectoryData } from "@/lib/rankings-view-data";
import { rankingsCopy } from "@/lib/rankings-copy";
import { mockupCopy } from "@/lib/mockup-copy";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { localizeHref, type SupportedLocale } from "@/lib/i18n";
export async function RankingEditionView({
  locale,
  slug,
  pathname = `/rankings/${slug}`,
}: {
  locale: SupportedLocale;
  slug: string;
  pathname?: string;
}) {
  const copy = rankingsCopy(locale),
    design = mockupCopy(locale);
  const directory = await getRankingsDirectoryData();
  const data = directory.find((x) => x.spec.slug === slug);
  if (!data) notFound();
  const { spec, rows } = data;
  return (
    <main
      className="discovery-page rankings-v6-page rankings-v6-page--mockup"
      data-i18n="preserve"
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${spec.label} ${copy.heading}`,
          description: design.rankingLead,
          url: getAbsoluteSiteUrl(localizeHref(pathname, locale)),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: rows.length,
            itemListElement: rows.slice(0, 50).map((row, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: row.name,
              url: getAbsoluteSiteUrl(
                localizeHref(`/universities/${row.slug}`, locale),
              ),
            })),
          },
        }}
      />
      <header className="discovery-header">
        <div>
          <Link
            className="mockup-eyebrow"
            href="/universities"
            localeOverride={locale}
          >
            {design.directory}
          </Link>
          <h1>{spec.label.replace("2025-2026", "2025–2026")}</h1>
          <p>{design.rankingLead}</p>
          <p className="ranking-v6-boundary">
            ⓘ {spec.systemId === "cwts" ? copy.cwts : design.rankingBoundary}
          </p>
        </div>
      </header>
      <RankingRecordsView
        key={`${slug}-${locale}`}
        rows={rows}
        locale={locale}
        derived={spec.systemId === "cwts"}
        currentSlug={slug}
        editions={directory.map((x) => ({
          slug: x.spec.slug,
          label: x.spec.label,
        }))}
      />
      <details className="discovery-technical">
        <summary>{copy.details}</summary>
        <p>
          {copy.source}: {spec.label}. {copy.year}: {spec.yearLabel}.
        </p>
        <p>{copy.boundary}</p>
        <div data-i18n="preserve" lang="en">
          <p>{spec.sourceRole}</p>
          <p>{spec.rankTypeNote}</p>
          <p>{spec.caveat}</p>
        </div>
        <Link href="/api/public/v1/universities.json">JSON</Link>
      </details>
    </main>
  );
}
