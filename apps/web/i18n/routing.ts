import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/lib/i18n";

export const routing = defineRouting({
  defaultLocale: DEFAULT_LOCALE,
  localeDetection: false,
  localePrefix: "as-needed",
  locales: SUPPORTED_LOCALES
});
