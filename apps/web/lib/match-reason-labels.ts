import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";

// Every match reason lib/entity-search.ts can emit. A reason added there
// without a translation here falls back to the English source string at
// render time instead of failing, so search never breaks on a new reason.
type MatchReason =
  | "Exact canonical slug match."
  | "Exact canonical name match."
  | "Canonical name contains the query."
  | "Exact entity alias match."
  | "Entity alias contains the query."
  | "Public record summary contains the query."
  | "Promoted official source title contains the query."
  | "Public source-backed claim text contains the query."
  | "Analysis dimension label contains the query."
  | "Token match in public record metadata."
  | "Fuzzy token match in public record metadata.";

const matchReasonLabels: Record<
  SupportedLocale,
  Record<MatchReason, string>
> = {
  en: {
    "Exact canonical slug match.": "Exact canonical slug match.",
    "Exact canonical name match.": "Exact canonical name match.",
    "Canonical name contains the query.": "Canonical name contains the query.",
    "Exact entity alias match.": "Exact entity alias match.",
    "Entity alias contains the query.": "Entity alias contains the query.",
    "Public record summary contains the query.":
      "Public record summary contains the query.",
    "Promoted official source title contains the query.":
      "Promoted official source title contains the query.",
    "Public source-backed claim text contains the query.":
      "Public source-backed claim text contains the query.",
    "Analysis dimension label contains the query.":
      "Analysis dimension label contains the query.",
    "Token match in public record metadata.":
      "Token match in public record metadata.",
    "Fuzzy token match in public record metadata.":
      "Fuzzy token match in public record metadata."
  },
  zh: {
    "Exact canonical slug match.": "规范 slug 完全匹配。",
    "Exact canonical name match.": "规范名称完全匹配。",
    "Canonical name contains the query.": "规范名称包含查询词。",
    "Exact entity alias match.": "实体别名完全匹配。",
    "Entity alias contains the query.": "实体别名包含查询词。",
    "Public record summary contains the query.": "公开记录摘要包含查询词。",
    "Promoted official source title contains the query.":
      "已发布官方来源标题包含查询词。",
    "Public source-backed claim text contains the query.":
      "有来源支撑的公开声明文本包含查询词。",
    "Analysis dimension label contains the query.":
      "分析维度标签包含查询词。",
    "Token match in public record metadata.":
      "公开记录元数据中的词元匹配。",
    "Fuzzy token match in public record metadata.":
      "公开记录元数据中的模糊词元匹配。"
  },
  fr: {
    "Exact canonical slug match.":
      "Correspondance exacte avec le slug canonique.",
    "Exact canonical name match.":
      "Correspondance exacte avec le nom canonique.",
    "Canonical name contains the query.":
      "Le nom canonique contient la requête.",
    "Exact entity alias match.":
      "Correspondance exacte avec un alias de l’entité.",
    "Entity alias contains the query.":
      "Un alias de l’entité contient la requête.",
    "Public record summary contains the query.":
      "Le résumé du dossier public contient la requête.",
    "Promoted official source title contains the query.":
      "Le titre de la source officielle promue contient la requête.",
    "Public source-backed claim text contains the query.":
      "Le texte d’affirmation publique étayé par des sources contient la requête.",
    "Analysis dimension label contains the query.":
      "Le libellé de dimension d’analyse contient la requête.",
    "Token match in public record metadata.":
      "Correspondance de jetons dans les métadonnées du dossier public.",
    "Fuzzy token match in public record metadata.":
      "Correspondance floue de jetons dans les métadonnées du dossier public."
  },
  pl: {
    "Exact canonical slug match.":
      "Dokładne dopasowanie kanonicznego identyfikatora (slug).",
    "Exact canonical name match.": "Dokładne dopasowanie nazwy kanonicznej.",
    "Canonical name contains the query.":
      "Nazwa kanoniczna zawiera zapytanie.",
    "Exact entity alias match.": "Dokładne dopasowanie aliasu podmiotu.",
    "Entity alias contains the query.": "Alias podmiotu zawiera zapytanie.",
    "Public record summary contains the query.":
      "Podsumowanie publicznego rekordu zawiera zapytanie.",
    "Promoted official source title contains the query.":
      "Tytuł promowanego oficjalnego źródła zawiera zapytanie.",
    "Public source-backed claim text contains the query.":
      "Publiczny tekst twierdzenia poparty źródłami zawiera zapytanie.",
    "Analysis dimension label contains the query.":
      "Etykieta wymiaru analizy zawiera zapytanie.",
    "Token match in public record metadata.":
      "Dopasowanie tokenów w metadanych publicznego rekordu.",
    "Fuzzy token match in public record metadata.":
      "Rozmyte dopasowanie tokenów w metadanych publicznego rekordu."
  },
  es: {
    "Exact canonical slug match.":
      "Coincidencia exacta del slug canónico.",
    "Exact canonical name match.":
      "Coincidencia exacta del nombre canónico.",
    "Canonical name contains the query.":
      "El nombre canónico contiene la consulta.",
    "Exact entity alias match.":
      "Coincidencia exacta de un alias de la entidad.",
    "Entity alias contains the query.":
      "Un alias de la entidad contiene la consulta.",
    "Public record summary contains the query.":
      "El resumen del registro público contiene la consulta.",
    "Promoted official source title contains the query.":
      "El título de la fuente oficial promovida contiene la consulta.",
    "Public source-backed claim text contains the query.":
      "El texto de afirmación pública respaldado por fuentes contiene la consulta.",
    "Analysis dimension label contains the query.":
      "La etiqueta de dimensión de análisis contiene la consulta.",
    "Token match in public record metadata.":
      "Coincidencia de tokens en los metadatos del registro público.",
    "Fuzzy token match in public record metadata.":
      "Coincidencia difusa de tokens en los metadatos del registro público."
  },
  nl: {
    "Exact canonical slug match.":
      "Exacte overeenkomst met de canonieke slug.",
    "Exact canonical name match.":
      "Exacte overeenkomst met de canonieke naam.",
    "Canonical name contains the query.":
      "De canonieke naam bevat de zoekopdracht.",
    "Exact entity alias match.":
      "Exacte overeenkomst met een alias van de entiteit.",
    "Entity alias contains the query.":
      "Een alias van de entiteit bevat de zoekopdracht.",
    "Public record summary contains the query.":
      "De samenvatting van het openbare record bevat de zoekopdracht.",
    "Promoted official source title contains the query.":
      "De titel van de gepromote officiële bron bevat de zoekopdracht.",
    "Public source-backed claim text contains the query.":
      "De openbare claimtekst met bronvermelding bevat de zoekopdracht.",
    "Analysis dimension label contains the query.":
      "Het label van de analysedimensie bevat de zoekopdracht.",
    "Token match in public record metadata.":
      "Tokenovereenkomst in de metadata van het openbare record.",
    "Fuzzy token match in public record metadata.":
      "Vage tokenovereenkomst in de metadata van het openbare record."
  },
  ms: {
    "Exact canonical slug match.": "Padanan tepat slug kanonik.",
    "Exact canonical name match.": "Padanan tepat nama kanonik.",
    "Canonical name contains the query.":
      "Nama kanonik mengandungi pertanyaan.",
    "Exact entity alias match.": "Padanan tepat alias entiti.",
    "Entity alias contains the query.":
      "Alias entiti mengandungi pertanyaan.",
    "Public record summary contains the query.":
      "Ringkasan rekod awam mengandungi pertanyaan.",
    "Promoted official source title contains the query.":
      "Tajuk sumber rasmi yang dipromosikan mengandungi pertanyaan.",
    "Public source-backed claim text contains the query.":
      "Teks tuntutan awam yang disokong sumber mengandungi pertanyaan.",
    "Analysis dimension label contains the query.":
      "Label dimensi analisis mengandungi pertanyaan.",
    "Token match in public record metadata.":
      "Padanan token dalam metadata rekod awam.",
    "Fuzzy token match in public record metadata.":
      "Padanan token kabur dalam metadata rekod awam."
  }
};

export function localizeMatchReason(
  reason: string,
  locale: SupportedLocale = DEFAULT_LOCALE
): string {
  const labels = matchReasonLabels[locale];
  return Object.prototype.hasOwnProperty.call(labels, reason)
    ? labels[reason as MatchReason]
    : reason;
}
