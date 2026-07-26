import { xmlEscape, xmlResponse } from "@/lib/feed";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import {
  SITEMAP_SECTION_IDS,
  getSitemapLastPublishedAt
} from "@/lib/sitemap-sections";

export const dynamic = "force-static";

export async function GET() {
  const lastPublishedAt = await getSitemapLastPublishedAt();
  const entries = SITEMAP_SECTION_IDS.map((section) => {
    const url = getAbsoluteSiteUrl(`/sitemaps/${section}.xml`);

    return `<sitemap>
  <loc>${xmlEscape(url)}</loc>
  <lastmod>${xmlEscape(lastPublishedAt.toISOString())}</lastmod>
</sitemap>`;
  }).join("\n");

  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`);
}
