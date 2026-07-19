import { permanentRedirect } from "next/navigation";
import { withLocalePrefix, normalizeLocale } from "@/lib/i18n";

export default async function LocalizedLegacyMayReport({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  permanentRedirect(withLocalePrefix("/reports/monthly/2026-05", normalizeLocale(locale)));
}
