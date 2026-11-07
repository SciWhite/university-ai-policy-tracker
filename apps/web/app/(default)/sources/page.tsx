import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { CatalogSourceRecord } from "@uapt/shared";
import { getCatalogSources } from "@/lib/catalog";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";

export const PAGE_SIZE = 100;

export interface SourcesPageProps {
  params?: Promise<Record<string, string | undefined>>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export function sortCatalogSources(sources: CatalogSourceRecord[]): CatalogSourceRecord[] {
  return [...sources].sort((a, b) => {
    const slugCmp = a.universitySlug.localeCompare(b.universitySlug);
    if (slugCmp !== 0) return slugCmp;
    const urlCmp = a.url.localeCompare(b.url);
    if (urlCmp !== 0) return urlCmp;
    return a.title.localeCompare(b.title);
  });
}

export function parsePageNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  const pageStr = Array.isArray(value) ? value[0] : typeof value === "string" ? value : undefined;
  const n = pageStr ? parseInt(pageStr, 10) : 1;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

export function getSourcesPagePath(page: number): string {
  return page > 1 ? `/sources?page=${page}` : "/sources";
}

export async function generateMetadata(props: SourcesPageProps): Promise<Metadata> {
  const params = (await props.params) ?? {};
  const searchParams = (await props.searchParams) ?? {};
  const locale = normalizeLocale(params.locale);
  const page = parsePageNumber(searchParams.page);
  const pagePath = getSourcesPagePath(page);
  const alternates = getLocalizedAlternates(pagePath, locale);
  const pageSuffix = page > 1 ? ` (Page ${page})` : "";
  const title = `Sources${pageSuffix} | University AI Policy Tracker`;
  const description =
    "Official source pages and documents behind the public university AI policy records.";

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: String(alternates.canonical),
      type: "website"
    }
  };
}

export const metadata: Metadata = {
  title: "Sources | University AI Policy Tracker",
  description:
    "Official source pages and documents behind the public university AI policy records.",
  alternates: getLocalizedAlternates("/sources", "en"),
  openGraph: {
    title: "Sources | University AI Policy Tracker",
    description:
      "Official source pages and documents behind the public university AI policy records.",
    url: String(getLocalizedAlternates("/sources", "en").canonical),
    type: "website"
  }
};

export default async function SourcesPage(props: SourcesPageProps) {
  const searchParams = (await props.searchParams) ?? {};
  const rawSources = await getCatalogSources();
  const sorted = sortCatalogSources(rawSources);
  const totalSources = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalSources / PAGE_SIZE));
  const requestedPage = parsePageNumber(searchParams.page);
  const currentPage = Math.min(requestedPage, totalPages);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedSources = sorted.slice(startIndex, startIndex + PAGE_SIZE);

  const prevHref =
    currentPage > 1
      ? currentPage === 2
        ? "/sources"
        : `/sources?page=${currentPage - 1}`
      : null;
  const nextHref = currentPage < totalPages ? `/sources?page=${currentPage + 1}` : null;

  return (
    <main className="page-shell">
      {prevHref && <link rel="prev" href={prevHref} />}
      {nextHref && <link rel="next" href={nextHref} />}

      <section className="hero">
        <p className="kicker">Catalog read path</p>
        <h1>Sources</h1>
        <p className="lead">
          Minimal source index for policy pages and documents. Full source
          snapshots and diffs will build on this catalog read path.
        </p>
      </section>

      <section className="section">
        <div className="card-grid">
          {paginatedSources.map((source) => (
            <article className="policy-card" key={`${source.universitySlug}:${source.url}`}>
              <div>
                <h2 data-i18n="preserve">{source.title}</h2>
                <p>
                  <Link href={`/universities/${source.universitySlug}`}>
                    {source.universityName}
                  </Link>
                </p>
              </div>
              <div className="tag-row">
                <span className="pill">{source.documentStatus}</span>
                <span className="pill">{source.serviceTreatment}</span>
                <span className="pill">{source.reviewState}</span>
              </div>
              <ul className="source-list">
                <li>
                  <a href={source.url}>{source.url}</a>
                </li>
              </ul>
            </article>
          ))}
        </div>

        <nav className="pagination" aria-label="Pagination">
          <div className="pagination-summary">
            Showing {totalSources === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, totalSources)} of {totalSources} sources
          </div>
          <div className="pagination-controls">
            {prevHref ? (
              <Link href={prevHref} rel="prev" className="pagination-link">
                Previous
              </Link>
            ) : (
              <span className="pagination-link disabled" aria-disabled="true">
                Previous
              </span>
            )}
            <span className="pagination-status" aria-current="page">
              Page {currentPage} of {totalPages}
            </span>
            {nextHref ? (
              <Link href={nextHref} rel="next" className="pagination-link">
                Next
              </Link>
            ) : (
              <span className="pagination-link disabled" aria-disabled="true">
                Next
              </span>
            )}
          </div>
        </nav>
      </section>
    </main>
  );
}
