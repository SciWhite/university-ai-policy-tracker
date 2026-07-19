import { permanentRedirect } from "next/navigation";
import { withLocalePrefix, normalizeLocale } from "@/lib/i18n";

export default async function LocalizedCoverageDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  permanentRedirect(withLocalePrefix("/coverage", normalizeLocale(locale)));
}
