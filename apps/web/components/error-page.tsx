"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DocumentLink as Link } from "@/components/document-link";
import { getLocaleFromPathname, type SupportedLocale } from "@/lib/i18n";

const errorCopy: Record<SupportedLocale, {
  heading: string;
  homeAction: string;
  lead: string;
  retryAction: string;
}> = {
  en: {
    heading: "Something went wrong",
    homeAction: "Home",
    lead: "An unexpected error occurred while loading this page. Try again, or return to the homepage.",
    retryAction: "Try again"
  },
  zh: {
    heading: "出错了",
    homeAction: "首页",
    lead: "加载此页面时出现意外错误。请重试，或返回首页。",
    retryAction: "重试"
  },
  fr: {
    heading: "Une erreur est survenue",
    homeAction: "Accueil",
    lead: "Une erreur inattendue s'est produite lors du chargement de cette page. Réessayez ou revenez à l'accueil.",
    retryAction: "Réessayer"
  },
  pl: {
    heading: "Coś poszło nie tak",
    homeAction: "Strona główna",
    lead: "Podczas wczytywania tej strony wystąpił nieoczekiwany błąd. Spróbuj ponownie lub wróć na stronę główną.",
    retryAction: "Spróbuj ponownie"
  },
  es: {
    heading: "Algo salió mal",
    homeAction: "Inicio",
    lead: "Se produjo un error inesperado al cargar esta página. Inténtalo de nuevo o vuelve a la página de inicio.",
    retryAction: "Inténtalo de nuevo"
  },
  nl: {
    heading: "Er is iets misgegaan",
    homeAction: "Startpagina",
    lead: "Er is een onverwachte fout opgetreden bij het laden van deze pagina. Probeer het opnieuw of ga terug naar de startpagina.",
    retryAction: "Opnieuw proberen"
  },
  ms: {
    heading: "Berlaku ralat",
    homeAction: "Laman utama",
    lead: "Ralat tidak dijangka berlaku semasa memuatkan halaman ini. Cuba lagi atau kembali ke laman utama.",
    retryAction: "Cuba lagi"
  }
};

interface ErrorPageProps {
  error: Error & { digest?: string };
  onRetry: () => void;
}

// Shared branded error boundary body for both root layout groups.
export function ErrorPage({ error, onRetry }: ErrorPageProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const copy = errorCopy[locale];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Error</p>
        <h1>{copy.heading}</h1>
        <p className="lead">{copy.lead}</p>
        <div className="tag-row hero-actions">
          <button className="site-action" onClick={onRetry} type="button">
            {copy.retryAction}
          </button>
          <Link className="site-action" href="/">
            {copy.homeAction}
          </Link>
        </div>
      </section>
    </main>
  );
}
