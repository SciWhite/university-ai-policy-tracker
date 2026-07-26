"use client";

import { usePathname } from "next/navigation";
import { DocumentLink as Link } from "@/components/document-link";
import { getLocaleFromPathname, type SupportedLocale } from "@/lib/i18n";

const notFoundCopy: Record<SupportedLocale, {
  heading: string;
  homeAction: string;
  lead: string;
  searchAction: string;
  universitiesAction: string;
}> = {
  en: {
    heading: "Page not found",
    homeAction: "Home",
    lead: "This page does not exist or the record has moved. Search the public records or browse the university index instead.",
    searchAction: "Search records",
    universitiesAction: "Browse universities"
  },
  zh: {
    heading: "页面未找到",
    homeAction: "首页",
    lead: "该页面不存在，或记录已迁移。可搜索公共记录或浏览高校索引。",
    searchAction: "搜索记录",
    universitiesAction: "浏览高校"
  },
  fr: {
    heading: "Page introuvable",
    homeAction: "Accueil",
    lead: "Cette page n'existe pas ou le dossier a été déplacé. Recherchez les dossiers publics ou parcourez l'index des universités.",
    searchAction: "Rechercher les dossiers",
    universitiesAction: "Parcourir les universités"
  },
  pl: {
    heading: "Nie znaleziono strony",
    homeAction: "Strona główna",
    lead: "Ta strona nie istnieje lub rekord został przeniesiony. Wyszukaj publiczne rekordy lub przeglądaj indeks uczelni.",
    searchAction: "Szukaj rekordów",
    universitiesAction: "Przeglądaj uczelnie"
  },
  es: {
    heading: "Página no encontrada",
    homeAction: "Inicio",
    lead: "Esta página no existe o el registro se ha movido. Busca los registros públicos o explora el índice de universidades.",
    searchAction: "Buscar registros",
    universitiesAction: "Explorar universidades"
  },
  nl: {
    heading: "Pagina niet gevonden",
    homeAction: "Startpagina",
    lead: "Deze pagina bestaat niet of het record is verplaatst. Doorzoek de openbare records of blader door de universiteitenindex.",
    searchAction: "Records doorzoeken",
    universitiesAction: "Universiteiten bekijken"
  },
  ms: {
    heading: "Halaman tidak ditemui",
    homeAction: "Laman utama",
    lead: "Halaman ini tidak wujud atau rekod telah dipindahkan. Cari rekod awam atau semak indeks universiti.",
    searchAction: "Cari rekod",
    universitiesAction: "Semak imbas universiti"
  }
};

// Shared branded 404 body for both root layout groups; locale comes from the
// pathname because not-found boundaries receive no params.
export function NotFoundPage() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const copy = notFoundCopy[locale];

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">404</p>
        <h1>{copy.heading}</h1>
        <p className="lead">{copy.lead}</p>
        <div className="tag-row hero-actions">
          <Link className="site-action" href="/search">
            {copy.searchAction}
          </Link>
          <Link className="site-action" href="/universities">
            {copy.universitiesAction}
          </Link>
          <Link className="site-action" href="/">
            {copy.homeAction}
          </Link>
        </div>
      </section>
    </main>
  );
}
