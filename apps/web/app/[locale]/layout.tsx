import "../globals.css";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { RootDocument } from "../root-document";
import { legacyLocale, normalizeReadingLocale } from "@/lib/i18n";
import { isReadingLocale } from "@/lib/language-catalog";
import { getSiteBaseUrl } from "@/lib/site-url";
import { getSiteOgImageUrl } from "@/components/site-opengraph";
import { getEnglishShellTextSources } from "@/lib/i18n-messages";
import { getPublicReadingUiText } from "@/lib/public-ui-translations";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return {
    metadataBase: new URL(getSiteBaseUrl()),
    openGraph: {
      images: [getSiteOgImageUrl(legacyLocale(normalizeReadingLocale(locale)))],
      siteName: "University AI Policy Tracker",
      type: "website" as const
    }
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isReadingLocale(locale) || locale === "en") {
    notFound();
  }

  const sharedUiText = await getPublicReadingUiText(locale, getEnglishShellTextSources());
  return <RootDocument locale={locale} sharedUiText={sharedUiText}>{children}</RootDocument>;
}
