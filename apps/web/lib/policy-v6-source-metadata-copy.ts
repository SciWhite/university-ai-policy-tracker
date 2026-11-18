import type { SupportedLocale } from "./i18n";
import type { V6SourceDocument } from "@uapt/shared";

type DocType = V6SourceDocument["docType"];
type DateKind = V6SourceDocument["displayDate"]["kind"];
type Copy = {
  docType: Record<DocType, string>;
  date: Record<DateKind, string>;
  issuer: string; approvedBy: string; updated: string; draft: string; version: string; scope: string;
  details: string; note: string; captured: string;
};

const en: Copy = {
  docType: { policy: "Policy", procedure: "Procedure", guideline: "Guideline", guidance_page: "Guidance page", faq: "FAQ", committee_report: "Committee report", announcement: "Announcement", course_statement: "Course statement", form_or_template: "Form or template", tool_listing: "Tool listing", other: "Document" },
  date: { effective: "Effective", approved: "Approved", adopted: "Adopted", issued_or_published: "Published", revised: "Revised", reviewed: "Reviewed", last_updated_page: "Page updated", next_review: "Next review", verified: "Last checked by us" },
  issuer: "Issued by", approvedBy: "Approved by", updated: "Updated", draft: "Draft", version: "Version", scope: "Scope",
  details: "Document details and quotes",
  note: "Extracted from the official page and checked by AI agents; not confirmed by the university. Dates and bodies are only those the page states.",
  captured: "Captured page SHA-256",
};

const COPY: Record<SupportedLocale, Copy> = {
  en,
  zh: {
    docType: { policy: "政策", procedure: "程序", guideline: "指引", guidance_page: "指导页面", faq: "常见问题", committee_report: "委员会报告", announcement: "公告", course_statement: "课程说明", form_or_template: "表格或模板", tool_listing: "工具列表", other: "文件" },
    date: { effective: "生效", approved: "批准", adopted: "采纳", issued_or_published: "发布", revised: "修订", reviewed: "复审", last_updated_page: "页面更新", next_review: "下次复审", verified: "本站最近核实" },
    issuer: "发布机构", approvedBy: "批准机构", updated: "更新", draft: "草案", version: "版本", scope: "适用范围",
    details: "文件信息与原文引文",
    note: "由 AI agent 从官方页面提取并核对，未经学校确认。日期和机构仅限页面明确写出的内容。",
    captured: "捕获页面 SHA-256",
  },
  es: {
    docType: { policy: "Política", procedure: "Procedimiento", guideline: "Directriz", guidance_page: "Página de orientación", faq: "Preguntas frecuentes", committee_report: "Informe de comité", announcement: "Anuncio", course_statement: "Declaración de curso", form_or_template: "Formulario o plantilla", tool_listing: "Lista de herramientas", other: "Documento" },
    date: { effective: "En vigor", approved: "Aprobado", adopted: "Adoptado", issued_or_published: "Publicado", revised: "Revisado", reviewed: "Revisión", last_updated_page: "Página actualizada", next_review: "Próxima revisión", verified: "Última comprobación nuestra" },
    issuer: "Emitido por", approvedBy: "Aprobado por", updated: "Actualizado", draft: "Borrador", version: "Versión", scope: "Ámbito",
    details: "Detalles del documento y citas",
    note: "Extraído de la página oficial y comprobado por agentes de IA; no confirmado por la universidad. Solo se indican las fechas y órganos que la página declara.",
    captured: "SHA-256 de la página capturada",
  },
  fr: {
    docType: { policy: "Politique", procedure: "Procédure", guideline: "Ligne directrice", guidance_page: "Page d’orientation", faq: "FAQ", committee_report: "Rapport de comité", announcement: "Annonce", course_statement: "Déclaration de cours", form_or_template: "Formulaire ou modèle", tool_listing: "Liste d’outils", other: "Document" },
    date: { effective: "En vigueur", approved: "Approuvé", adopted: "Adopté", issued_or_published: "Publié", revised: "Révisé", reviewed: "Réexaminé", last_updated_page: "Page mise à jour", next_review: "Prochain réexamen", verified: "Dernière vérification par nos soins" },
    issuer: "Émis par", approvedBy: "Approuvé par", updated: "Mis à jour", draft: "Projet", version: "Version", scope: "Portée",
    details: "Détails du document et citations",
    note: "Extrait de la page officielle et vérifié par des agents d’IA ; non confirmé par l’université. Seules les dates et instances indiquées par la page figurent ici.",
    captured: "SHA-256 de la page capturée",
  },
  ms: {
    docType: { policy: "Dasar", procedure: "Prosedur", guideline: "Garis panduan", guidance_page: "Halaman panduan", faq: "Soalan lazim", committee_report: "Laporan jawatankuasa", announcement: "Pengumuman", course_statement: "Kenyataan kursus", form_or_template: "Borang atau templat", tool_listing: "Senarai alat", other: "Dokumen" },
    date: { effective: "Berkuat kuasa", approved: "Diluluskan", adopted: "Diterima pakai", issued_or_published: "Diterbitkan", revised: "Disemak semula", reviewed: "Dikaji semula", last_updated_page: "Halaman dikemas kini", next_review: "Kajian semula seterusnya", verified: "Semakan terakhir kami" },
    issuer: "Dikeluarkan oleh", approvedBy: "Diluluskan oleh", updated: "Dikemas kini", draft: "Draf", version: "Versi", scope: "Skop",
    details: "Butiran dokumen dan petikan",
    note: "Diekstrak daripada halaman rasmi dan disemak oleh ejen AI; tidak disahkan oleh universiti. Hanya tarikh dan badan yang dinyatakan pada halaman.",
    captured: "SHA-256 halaman yang ditangkap",
  },
  nl: {
    docType: { policy: "Beleid", procedure: "Procedure", guideline: "Richtlijn", guidance_page: "Informatiepagina", faq: "Veelgestelde vragen", committee_report: "Commissierapport", announcement: "Aankondiging", course_statement: "Cursusverklaring", form_or_template: "Formulier of sjabloon", tool_listing: "Lijst met tools", other: "Document" },
    date: { effective: "Van kracht", approved: "Goedgekeurd", adopted: "Vastgesteld", issued_or_published: "Gepubliceerd", revised: "Herzien", reviewed: "Beoordeeld", last_updated_page: "Pagina bijgewerkt", next_review: "Volgende beoordeling", verified: "Laatst door ons gecontroleerd" },
    issuer: "Uitgegeven door", approvedBy: "Goedgekeurd door", updated: "Bijgewerkt", draft: "Concept", version: "Versie", scope: "Reikwijdte",
    details: "Documentgegevens en citaten",
    note: "Uit de officiële pagina gehaald en gecontroleerd door AI-agents; niet bevestigd door de universiteit. Alleen data en organen die de pagina noemt.",
    captured: "SHA-256 van de vastgelegde pagina",
  },
  pl: {
    docType: { policy: "Polityka", procedure: "Procedura", guideline: "Wytyczne", guidance_page: "Strona z poradami", faq: "FAQ", committee_report: "Raport komisji", announcement: "Ogłoszenie", course_statement: "Oświadczenie kursu", form_or_template: "Formularz lub szablon", tool_listing: "Lista narzędzi", other: "Dokument" },
    date: { effective: "Obowiązuje od", approved: "Zatwierdzono", adopted: "Przyjęto", issued_or_published: "Opublikowano", revised: "Zmieniono", reviewed: "Przejrzano", last_updated_page: "Aktualizacja strony", next_review: "Następny przegląd", verified: "Ostatnio sprawdzone przez nas" },
    issuer: "Wydane przez", approvedBy: "Zatwierdzone przez", updated: "Zaktualizowano", draft: "Projekt", version: "Wersja", scope: "Zakres",
    details: "Szczegóły dokumentu i cytaty",
    note: "Wyodrębnione z oficjalnej strony i sprawdzone przez agentów AI; niepotwierdzone przez uczelnię. Podano tylko daty i organy wskazane na stronie.",
    captured: "SHA-256 zarejestrowanej strony",
  },
};

export function policyV6SourceMetadataCopy(locale: SupportedLocale): Copy {
  return COPY[locale] ?? en;
}

const INTL: Record<SupportedLocale, string> = { en: "en-GB", zh: "zh-CN", es: "es-ES", fr: "fr-FR", ms: "ms-MY", nl: "nl-NL", pl: "pl-PL" };

/** Formats a stated date at its own precision; never invents a day or month. */
export function formatSourceDate(value: string, precision: "day" | "month" | "year", locale: SupportedLocale): string {
  const [y, m, d] = value.split("-").map(Number);
  if (precision === "year" || !m) return String(y);
  const date = new Date(Date.UTC(y, m - 1, precision === "day" && d ? d : 1));
  const options: Intl.DateTimeFormatOptions = precision === "day" ? { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" } : { year: "numeric", month: "long", timeZone: "UTC" };
  try { return new Intl.DateTimeFormat(INTL[locale] ?? "en-GB", options).format(date); } catch { return value; }
}
