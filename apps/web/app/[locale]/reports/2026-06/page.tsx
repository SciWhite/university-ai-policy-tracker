import { permanentRedirect } from "next/navigation";
import { withLocalePrefix, normalizeReadingLocale } from "@/lib/i18n";

export default async function LocalizedLegacyJuneReport({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  permanentRedirect(withLocalePrefix("/reports/monthly/2026-06", normalizeReadingLocale(locale)));
}
