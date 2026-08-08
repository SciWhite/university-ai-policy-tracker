import { notFound } from "next/navigation";
import { createSiteOgImage, siteOgImageSize } from "@/components/site-opengraph";
import { isSupportedLocale, type SupportedLocale } from "@/lib/i18n";

export const alt = "University AI Policy Tracker: from question to official source";
export const contentType = "image/png";
export const runtime = "edge";
export const size = siteOgImageSize;

export default async function Image({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale) || locale === "en") notFound();

  return createSiteOgImage(locale as SupportedLocale);
}
