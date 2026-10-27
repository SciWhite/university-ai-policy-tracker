import type { SupportedLocale } from "./i18n";
interface ReaderCopy {
  scope: string; version: string; unknownVersion: string; claimLocation: string;
  sourceNavigation: string; sources: (n: number) => string; bindings: (n: number) => string;
}
const copies: Record<SupportedLocale, ReaderCopy> = {
  en: { scope: "Status & scope", version: "Source version", unknownVersion: "Version not recorded; quotations kept separate", claimLocation: "Claim & location details", sourceNavigation: "Jump to a source", sources: n => `${n} sources · Jump to a source`, bindings: n => `Referenced by ${n} claim records` },
  zh: { scope: "状态与适用范围", version: "来源版本", unknownVersion: "版本未记录；引文分别展示", claimLocation: "主张与定位详情", sourceNavigation: "跳转到来源", sources: n => `${n} 个来源 · 跳转`, bindings: n => `对应 ${n} 条主张记录` },
  fr: { scope: "Statut et portée", version: "Version de la source", unknownVersion: "Version non consignée ; citations conservées séparément", claimLocation: "Détails de l’énoncé et du repère", sourceNavigation: "Accéder à une source", sources: n => `${n} sources · Accéder à une source`, bindings: n => `Cité dans ${n} énoncés` },
  pl: { scope: "Status i zakres", version: "Wersja źródła", unknownVersion: "Wersja nieodnotowana; cytaty pozostają oddzielne", claimLocation: "Szczegóły stwierdzenia i lokalizacji", sourceNavigation: "Przejdź do źródła", sources: n => `${n} źródeł · Przejdź do źródła`, bindings: n => `Powiązane stwierdzenia: ${n}` },
  es: { scope: "Estado y alcance", version: "Versión de la fuente", unknownVersion: "Versión no registrada; las citas se mantienen separadas", claimLocation: "Detalles de la afirmación y su ubicación", sourceNavigation: "Ir a una fuente", sources: n => `${n} fuentes · Ir a una fuente`, bindings: n => `Citada en ${n} afirmaciones` },
  nl: { scope: "Status en toepassingsgebied", version: "Bronversie", unknownVersion: "Versie niet vastgelegd; citaten blijven afzonderlijk", claimLocation: "Details van uitspraak en vindplaats", sourceNavigation: "Naar een bron", sources: n => `${n} bronnen · Naar een bron`, bindings: n => `Gekoppeld aan ${n} uitspraken` },
  ms: { scope: "Status dan skop", version: "Versi sumber", unknownVersion: "Versi tidak direkodkan; petikan dikekalkan berasingan", claimLocation: "Butiran pernyataan dan lokasi", sourceNavigation: "Pergi ke sumber", sources: n => `${n} sumber · Pergi ke sumber`, bindings: n => `Dirujuk oleh ${n} rekod pernyataan` },
};
export const policyV6ReaderCopy = (locale: SupportedLocale) => copies[locale];
