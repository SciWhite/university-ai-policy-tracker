import {GET as load} from "../../../../web/app/sitemaps/[section]/route";
import {readIndexSitemapOverlay} from "@/lib/index-sitemap-overlay";
export const dynamic="force-dynamic";
export async function GET(request: Request, context: {params: Promise<{section: string}>}) {
  if (!["core.xml", "universities.xml", "changes.xml", "zh.xml", "fr.xml", "pl.xml"].includes((await context.params).section)) return new Response("Not Found", {status:404});
  if (process.env.UAPT_INDEX_SOURCE_BASE_URL) return readIndexSitemapOverlay((await context.params).section, process.env.UAPT_INDEX_SOURCE_BASE_URL);
  return load(request, context);
}
