import scope from "../../../data/index-sitemap-removal-scope.json";

const removals = new Map(Object.entries(scope.sections).map(([section, urls]) => [section, new Set(urls)]));

/** Keep the main runtime's exact sitemap entries and dates; remove only reviewed members. */
export function applyIndexSitemapOverlay(xml: string, section: string): string {
  const excluded = removals.get(section);
  if (!excluded || !/<urlset\b/.test(xml) || !/<\/urlset>/.test(xml)) {
    throw new Error("Unexpected sitemap section or XML envelope");
  }
  return xml.replace(/<url\b[^>]*>[\s\S]*?<\/url>/g, entry => {
    const url = /<loc>([^<]+)<\/loc>/.exec(entry)?.[1];
    if (!url) throw new Error("Sitemap entry has no URL");
    return excluded.has(url) ? "" : entry;
  });
}
