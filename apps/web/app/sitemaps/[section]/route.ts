import { xmlEscape, xmlResponse } from "@/lib/feed";
import {
  SITEMAP_SECTION_IDS,
  buildSitemapSection,
  isSitemapSectionId
} from "@/lib/sitemap-sections";

export const dynamic = "force-static";

export function generateStaticParams() {
  return SITEMAP_SECTION_IDS.map((section) => ({ section: `${section}.xml` }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ section: string }> }
) {
  const { section } = await params;
  const sectionId = section.endsWith(".xml") ? section.slice(0, -4) : "";

  if (!isSitemapSectionId(sectionId)) {
    return new Response("Not Found", { status: 404 });
  }

  const entries = await buildSitemapSection(sectionId);
  const urls = entries
    .map(
      (entry) => `<url>
  <loc>${xmlEscape(entry.url)}</loc>
  <lastmod>${xmlEscape(entry.lastModified.toISOString())}</lastmod>
</url>`
    )
    .join("\n");

  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`);
}
