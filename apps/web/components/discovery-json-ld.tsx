import { JsonLd } from "./json-ld";
import { localizeHref, type SupportedLocale } from "@/lib/i18n";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import type { DiscoveryPageData } from "@/lib/rankings-view-data";
export function DiscoveryJsonLd({
  data,
  locale,
  pathname,
  title,
}: {
  data: DiscoveryPageData;
  locale: SupportedLocale;
  pathname: string;
  title: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        url: getAbsoluteSiteUrl(localizeHref(pathname, locale)),
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: data.total,
          itemListElement: data.rows.map((row, index) => ({
            "@type": "ListItem",
            position: (data.query.page - 1) * data.query.size + index + 1,
            name: row.name,
            url: row.slug
              ? getAbsoluteSiteUrl(
                  localizeHref(`/universities/${row.slug}`, locale),
                )
              : row.sourceUrl,
          })),
        },
      }}
    />
  );
}
