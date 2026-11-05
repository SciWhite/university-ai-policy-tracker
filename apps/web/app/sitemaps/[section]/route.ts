import { xmlEscape, xmlResponse } from "@/lib/feed";
import { uniqueSitemapEntries } from "@/lib/sitemap-entries";
import {
  buildSitemapSection,
  isSitemapSectionId
} from "@/lib/sitemap-sections";
import { tagContent } from "@/lib/content-cache-tags";

export const dynamic = "force-static";
export const dynamicParams = true;

export function generateStaticParams() {
  // First-request caching keeps each verified language sitemap available
  // without repeating the full university eligibility scan during builds.
  return [];
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

  await tagContent("sitemap", "catalog");
  const entries = await buildSitemapSection(sectionId);
  const urls = uniqueSitemapEntries(entries)
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
