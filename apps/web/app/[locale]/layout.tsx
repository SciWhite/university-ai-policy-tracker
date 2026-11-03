import "../globals.css";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { RootDocument } from "../root-document";
import { legacyLocale, normalizeReadingLocale } from "@/lib/i18n";
import { isReadingLocale } from "@/lib/language-catalog";
import { getSiteBaseUrl } from "@/lib/site-url";
import { getSiteOgImageUrl } from "@/components/site-opengraph";
import { getEnglishShellTextSources } from "@/lib/i18n-messages";
import { getReadingSharedUiText } from "@/lib/reading-translations";

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

// Localized paths are generated on demand and cached by Next. Enumerating every
// locale here multiplies all report, history and utility pages during builds.
export const dynamicParams = true;

export function generateStaticParams(): Array<{ locale: string }> {
  return [];
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

  const sharedUiText = await getReadingSharedUiText(locale, getEnglishShellTextSources());
  return <RootDocument locale={locale} sharedUiText={sharedUiText}>{children}</RootDocument>;
}
