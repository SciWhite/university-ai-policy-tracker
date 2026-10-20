import {GET as load} from "../../../../web/app/sitemaps/[section]/route";
export const dynamic="force-dynamic";
export async function GET(request: Request, context: {params: Promise<{section: string}>}) {
  if (!["core.xml", "universities.xml", "changes.xml", "zh.xml", "fr.xml", "pl.xml"].includes((await context.params).section)) return new Response("Not Found", {status:404});
  return load(request, context);
}
