import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { NON_DEFAULT_LOCALES, isSupportedLocale } from "@/lib/i18n";

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

  return children;
}
