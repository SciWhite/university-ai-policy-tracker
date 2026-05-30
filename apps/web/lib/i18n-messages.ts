import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import ms from "@/messages/ms.json";
import nl from "@/messages/nl.json";
import pl from "@/messages/pl.json";
import zh from "@/messages/zh.json";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";

const messagesByLocale = {
  en,
  zh,
  fr,
  pl,
  es,
  nl,
  ms
} as const;

export type ShellMessages = (typeof messagesByLocale)[SupportedLocale]["Shell"];

export function getShellMessages(locale: SupportedLocale): ShellMessages {
  return messagesByLocale[locale]?.Shell ?? messagesByLocale[DEFAULT_LOCALE].Shell;
}

export function interpolate(
  template: string,
  values: Record<string, string>
): string {
  return Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{${key}}`, value),
    template
  );
}
