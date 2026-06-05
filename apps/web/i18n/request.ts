import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages: (await import(`../messages/${DEFAULT_LOCALE}.json`)).default
}));
