import "../globals.css";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { RootDocument } from "../root-document";
import { NON_DEFAULT_LOCALES, isSupportedLocale } from "@/lib/i18n";
import { getSiteBaseUrl } from "@/lib/site-url";

export const metadata = {
  metadataBase: new URL(getSiteBaseUrl())
};

export function generateStaticParams() {
  return NON_DEFAULT_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isSupportedLocale(locale) || locale === "en") {
    notFound();
  }

  return <RootDocument locale={locale}>{children}</RootDocument>;
}
