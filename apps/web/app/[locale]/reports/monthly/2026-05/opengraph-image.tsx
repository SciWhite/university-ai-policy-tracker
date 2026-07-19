import { notFound } from "next/navigation";
import { createLocalizedReportImage, localizedReportImageSize } from "@/components/localized-report-opengraph";
import { isSupportedLocale } from "@/lib/i18n";

export const alt = "University AI Policy Tracker localized May 2026 monthly report";
export const contentType = "image/png";
export const runtime = "edge";
export const size = localizedReportImageSize;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale) || locale === "en") notFound();
  return createLocalizedReportImage(locale, "2026-05");
}
