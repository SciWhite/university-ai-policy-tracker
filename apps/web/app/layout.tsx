import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "University AI Policy Tracker",
  description:
    "Source-backed university AI policy changes, historical snapshots, and public reports."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand-link" href="/">
            University AI Policy Tracker
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/universities">Universities</Link>
            <Link href="/changes">Changes</Link>
            <Link href="/datasets">Datasets</Link>
            <Link href="/methodology">Methodology</Link>
            <Link href="/citation">Citation</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>
            Open, evidence-backed tracker metadata. Not legal advice, not
            academic integrity advice, and not an official university statement.
          </p>
          <nav aria-label="Trust and reference links">
            <Link href="/methodology">Methodology</Link>
            <Link href="/citation">Citation</Link>
            <Link href="/datasets">Datasets</Link>
            <Link href="/changes">Changes</Link>
            <Link href="/llms.txt">llms.txt</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
