import { notFound } from "next/navigation";
import { createLocalizedReportImage, localizedReportImageSize } from "@/components/localized-report-opengraph";
import { isMonthlyReportSlug } from "@/lib/monthly-report-registry";
import { isSupportedLocale } from "@/lib/i18n";

export const alt = "University AI Policy Tracker localized monthly report";
export const contentType = "image/png";
// Node runtime: the report registry is read from the active content release.
// Rendered per request, as the former edge route was; months are content.
export const dynamic = "force-dynamic";
export const size = localizedReportImageSize;

export default async function Image({
  params
}: {
  params: Promise<{ locale: string; month: string }>;
}) {
  const { locale, month } = await params;
  if (!isSupportedLocale(locale) || locale === "en") notFound();
  if (!isMonthlyReportSlug(month)) notFound();
  return createLocalizedReportImage(locale, month);
}
