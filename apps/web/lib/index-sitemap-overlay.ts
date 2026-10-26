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

export async function readIndexSitemapOverlay(section: string, sourceBase: string): Promise<Response> {
  // Never allow the public host or this zone to recurse back into its own route.
  if (sourceBase !== "http://127.0.0.1:3100" || !removals.has(section)) {
    throw new Error("Sitemap overlay requires the unchanged canonical main runtime");
  }
  const source = await fetch(`${sourceBase}/sitemaps/${section}`, {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
    headers: {"user-agent": "UAPT-Monitor/1.0", host: "eduaipolicy.org"}
  });
  if (!source.ok) return new Response("Sitemap source unavailable", {status: 503, headers: {"Cache-Control": "no-store"}});
  const xml = applyIndexSitemapOverlay(await source.text(), section);
  return new Response(xml, {headers: {"Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store, no-transform"}});
}
