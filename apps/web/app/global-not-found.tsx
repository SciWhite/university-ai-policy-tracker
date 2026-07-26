import "./globals.css";
import { ThemeScript } from "@/components/theme-script";

// Branded catch-all 404 (experimental.globalNotFound): served for unmatched
// URLs, unsupported locale segments, and notFound() thrown from statically
// optimized routes, which bypasses the group-level not-found boundaries.
// Rendered once at build with no request pathname, so it must avoid
// usePathname-dependent shell components or the body prerenders empty;
// the group-level not-found boundaries still provide the localized version
// on client-side navigations.
export const metadata = {
  title: "Page not found | University AI Policy Tracker",
  robots: {
    index: false
  }
};

export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <header className="site-header">
          <div className="site-header__top">
            <div className="site-brand">
              <a className="brand-link" href="/">
                University AI Policy Tracker
              </a>
            </div>
          </div>
        </header>
        <main className="page-shell">
          <section className="hero">
            <p className="kicker">404</p>
            <h1>Page not found</h1>
            <p className="lead">
              This page does not exist or the record has moved. Search the
              public records or browse the university index instead.
            </p>
            <div className="tag-row hero-actions">
              <a className="site-action" href="/search">
                Search records
              </a>
              <a className="site-action" href="/universities">
                Browse universities
              </a>
              <a className="site-action" href="/">
                Home
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
