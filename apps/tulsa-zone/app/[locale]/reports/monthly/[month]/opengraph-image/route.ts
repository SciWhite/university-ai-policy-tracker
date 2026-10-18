import { createLocalizedReportImage } from "@/components/localized-report-opengraph";
import { isSupportedLocale } from "@/lib/i18n";
import { isMonthlyReportSlug } from "@/lib/monthly-report-registry";

export const runtime = "edge";

// Only tested, existing monthly image paths are selected in the nginx release.
// Reuse the image renderer without moving report pages into this bounded zone.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; month: string }> }
) {
  const { locale, month } = await params;
  if (!isSupportedLocale(locale) || locale === "en" || !isMonthlyReportSlug(month)) {
    return new Response("Not Found", { status: 404 });
  }
  return createLocalizedReportImage(locale, month);
}
