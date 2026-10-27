import type { ReactNode } from "react";
interface LayoutProps {
  header: ReactNode;
  editions: ReactNode;
  search: ReactNode;
  filters: ReactNode;
  toolbar: ReactNode;
  results: ReactNode;
  footer: ReactNode;
  scopeNote: ReactNode;
  ready: boolean;
  busy: boolean;
  onResultClick: (event: React.MouseEvent<HTMLElement>) => void;
}
export function UniversityDirectoryLayout(p: LayoutProps) {
  return (
    <main
      className="discovery-page university-mockup-page discovery-browser directory-browser-page"
      data-discovery-page="universities"
      data-discovery-ready={p.ready}
      data-i18n="preserve"
      aria-busy={p.busy}
      onClickCapture={p.onResultClick}
      onAuxClickCapture={p.onResultClick}
    >
      {p.header}
      <div className="directory-browser-layout">
        <aside className="directory-browser-sidebar">
          {p.filters}
          {p.editions}
        </aside>
        <section className="directory-browser-main">
          {p.search}
          {p.toolbar}
          {p.results}
          {p.footer}
        </section>
      </div>
    </main>
  );
}
export function RankingsBrowserLayout(p: LayoutProps) {
  return (
    <main
      className="discovery-page rankings-v6-page rankings-v6-page--mockup discovery-browser ranking-browser-page"
      data-discovery-page="rankings"
      data-discovery-ready={p.ready}
      data-i18n="preserve"
      aria-busy={p.busy}
      onClickCapture={p.onResultClick}
      onAuxClickCapture={p.onResultClick}
    >
      {p.header}
      {p.editions}
      <section className="ranking-browser-filter-surface">
        {p.search}
        {p.filters}
      </section>
      {p.scopeNote}
      {p.toolbar}
      {p.results}
      {p.footer}
    </main>
  );
}
