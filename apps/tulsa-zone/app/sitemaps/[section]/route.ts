import {GET as load} from "../../../../web/app/sitemaps/[section]/route";
export const dynamic="force-dynamic";
export async function GET(request: Request, context: {params: Promise<{section: string}>}) {
  if ((await context.params).section !== "changes.xml") return new Response("Not Found", {status:404});
  return load(request, context);
}
