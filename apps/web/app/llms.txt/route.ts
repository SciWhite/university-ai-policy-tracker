import { tagContent } from "@/lib/content-cache-tags";
import { renderLlmsText } from "@/lib/llms-text";
import { currentMonthlyReportSlug } from "@/lib/monthly-report-registry";

export const dynamic = "force-static";

export async function GET() {
  await tagContent("reports");
  return new Response(renderLlmsText(currentMonthlyReportSlug()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
