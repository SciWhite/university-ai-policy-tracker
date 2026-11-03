import { permanentRedirect } from "next/navigation";
import { withLocalePrefix, normalizeReadingLocale } from "@/lib/i18n";

export default async function LocalizedQsCoverageDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  permanentRedirect(withLocalePrefix("/coverage/qs-2026", normalizeReadingLocale(locale)));
}
