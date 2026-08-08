import { ImageResponse } from "next/og";
import type { SupportedLocale } from "@/lib/i18n";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export const siteOgImageSize = { height: 630, width: 1200 };

const copy = {
  en: {
    eyebrow: "University AI Policy Tracker",
    title: "From a university question to the official source",
    description: "Search source-backed records, see the relevant rules, and open the university source.",
    steps: ["Find", "Role", "Rules", "Source"]
  },
  zh: {
    eyebrow: "University AI Policy Tracker",
    title: "从高校问题到官方来源",
    description: "搜索有来源证据的记录，查看相关规则，并打开高校官方来源。",
    steps: ["查找", "身份", "规则", "来源"]
  },
  fr: {
    eyebrow: "University AI Policy Tracker",
    title: "De la question universitaire à la source officielle",
    description: "Recherchez les dossiers sourcés, consultez les règles et ouvrez la source universitaire.",
    steps: ["Trouver", "Rôle", "Règles", "Source"]
  },
  pl: {
    eyebrow: "University AI Policy Tracker",
    title: "Od pytania o uczelnię do oficjalnego źródła",
    description: "Znajdź rekordy ze źródłami, zobacz zasady i otwórz źródło uczelni.",
    steps: ["Znajdź", "Rola", "Zasady", "Źródło"]
  },
  es: {
    eyebrow: "University AI Policy Tracker",
    title: "De una pregunta universitaria a la fuente oficial",
    description: "Busca registros con fuentes, consulta las reglas y abre la fuente de la universidad.",
    steps: ["Buscar", "Rol", "Reglas", "Fuente"]
  },
  nl: {
    eyebrow: "University AI Policy Tracker",
    title: "Van een universiteitsvraag naar de officiële bron",
    description: "Zoek records met bronnen, bekijk de regels en open de universiteitsbron.",
    steps: ["Vind", "Rol", "Regels", "Bron"]
  },
  ms: {
    eyebrow: "University AI Policy Tracker",
    title: "Daripada soalan universiti ke sumber rasmi",
    description: "Cari rekod bersumber, lihat peraturan dan buka sumber universiti.",
    steps: ["Cari", "Peranan", "Peraturan", "Sumber"]
  }
} satisfies Record<SupportedLocale, { eyebrow: string; title: string; description: string; steps: string[] }>;

export function getSiteOgImageUrl(locale: SupportedLocale): string {
  return getAbsoluteSiteUrl(
    locale === "en" ? "/opengraph-image" : `/${locale}/opengraph-image`
  );
}

export function createSiteOgImage(locale: SupportedLocale = "en") {
  const strings = copy[locale];

  return new ImageResponse(
    (
      <div
        style={{
          background: "#f6f8fa",
          border: "1px solid #d0d7de",
          color: "#24292f",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: 64,
          width: "100%"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ color: "#57606a", fontSize: 28, fontWeight: 700 }}>
            {strings.eyebrow}
          </div>
          <div
            style={{
              fontSize: 66,
              fontWeight: 800,
              lineHeight: 1.06,
              maxWidth: 1000
            }}
          >
            {strings.title}
          </div>
          <div
            style={{
              color: "#57606a",
              fontSize: 30,
              lineHeight: 1.35,
              maxWidth: 900
            }}
          >
            {strings.description}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, height: 6 }}>
            {strings.steps.map((step, index) => (
              <div
                key={step}
                style={{
                  background: index === strings.steps.length - 1 ? "#0969da" : "#1f6feb",
                  borderRadius: 3,
                  flex: 1,
                  opacity: index === 1 ? 0.72 : 1
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 38 }}>
            {strings.steps.map((step) => (
              <div
                key={step}
                style={{ color: "#57606a", flex: 1, fontSize: 25, fontWeight: 700 }}
              >
                {step}
              </div>
            ))}
          </div>
          <div style={{ color: "#57606a", fontSize: 24 }}>
            {getAbsoluteSiteUrl("/").replace(/^https?:\/\//, "")}
          </div>
        </div>
      </div>
    ),
    siteOgImageSize
  );
}
