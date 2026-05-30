import { getRequestConfig } from "next-intl/server";
import { normalizeLocale } from "@/lib/i18n";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = normalizeLocale(await requestLocale);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
