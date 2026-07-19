import { ImageResponse } from "next/og";
import type { SupportedLocale } from "@/lib/i18n";

export const localizedReportImageSize = { height: 630, width: 1200 };

const copy = {
  zh: {
    badge: "公共月报",
    description: "有来源证据的高校 AI 政策记录、来源 URL、审查状态、变更日志和全量高校 GEO 覆盖。",
    may: "2026 年 5 月基线月报",
    june: "2026 年 6 月月末报告"
  },
  fr: {
    badge: "Rapport mensuel public",
    description: "Dossiers universitaires sur l’IA étayés par des sources, URL, états de revue, journaux de modifications et couverture GEO complète.",
    may: "Rapport mensuel de référence — mai 2026",
    june: "Rapport de fin de mois — juin 2026"
  },
  pl: {
    badge: "Publiczny raport miesięczny",
    description: "Rekordy polityk AI uczelni poparte źródłami, adresy URL, stany przeglądu, dzienniki zmian i pełne pokrycie GEO.",
    may: "Miesięczny raport bazowy — maj 2026",
    june: "Raport na koniec miesiąca — czerwiec 2026"
  },
  es: {
    badge: "Informe mensual público",
    description: "Registros universitarios de políticas de IA respaldados por fuentes, URL, estados de revisión, cambios y cobertura GEO completa.",
    may: "Informe mensual de referencia — mayo de 2026",
    june: "Informe de cierre mensual — junio de 2026"
  },
  nl: {
    badge: "Openbaar maandrapport",
    description: "Brononderbouwde universitaire AI-beleidsrecords, bron-URL’s, beoordelingsstatussen, wijzigingslogboeken en volledige GEO-dekking.",
    may: "Maandelijks nulrapport — mei 2026",
    june: "Maandeindrapport — juni 2026"
  },
  ms: {
    badge: "Laporan bulanan awam",
    description: "Rekod dasar AI universiti bersumber, URL sumber, status semakan, log perubahan dan liputan GEO semua universiti.",
    may: "Laporan garis dasar bulanan — Mei 2026",
    june: "Laporan akhir bulan — Jun 2026"
  }
} as const;

export function createLocalizedReportImage(
  locale: Exclude<SupportedLocale, "en">,
  month: "2026-05" | "2026-06"
) {
  const strings = copy[locale];
  const title = month === "2026-05" ? strings.may : strings.june;
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
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: "#57606a", fontSize: 28, fontWeight: 700 }}>
            University AI Policy Tracker
          </div>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.06, maxWidth: 1000 }}>
            {title}
          </div>
          <div style={{ color: "#57606a", fontSize: 31, lineHeight: 1.35, maxWidth: 1000 }}>
            {strings.description}
          </div>
        </div>
        <div style={{ alignItems: "center", display: "flex", gap: 20, justifyContent: "space-between" }}>
          <div style={{ color: "#57606a", fontSize: 27 }}>
            eduaipolicy.org/{locale}/reports/monthly/{month}
          </div>
          <div style={{ background: "#0969da", borderRadius: 8, color: "#ffffff", fontSize: 27, fontWeight: 700, padding: "14px 20px" }}>
            {strings.badge}
          </div>
        </div>
      </div>
    ),
    localizedReportImageSize
  );
}
