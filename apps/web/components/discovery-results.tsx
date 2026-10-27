"use client";
import { DocumentLink as Link } from "./document-link";
import { UniversityMark } from "./university-mark";
import { DiscoveryUniversityCard } from "./discovery-ui";
import { discoveryCopy } from "@/lib/discovery-copy";
import { rankingBrowserCopy } from "@/lib/ranking-browser-copy";
import { rankingsCopy } from "@/lib/rankings-copy";
import { getRankingEdition } from "@/lib/ranking-editions";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { formatDateMedium } from "@/lib/format-date";
import {
  countryLabel,
  formatDiscoveryLocation,
} from "@/lib/discovery-location";
import type { SupportedLocale } from "@/lib/i18n";
import type { RankingViewRow } from "@/lib/rankings-view-data";
export interface DiscoveryResultsProps {
  rows: RankingViewRow[];
  locale: SupportedLocale;
  edition: string;
  returnTo: string;
  compare: string[];
  onCompare: (slug: string) => void;
}
export function UniversityDirectoryResults(p: DiscoveryResultsProps) {
  const ui = discoveryCopy(p.locale),
    copy = rankingBrowserCopy(p.locale),
    edition = getRankingEdition(p.edition)!;
  return (
    <div className="directory-browser-grid">
      {p.rows.map((row) => {
        const policySummary = row.summary
          ?.replace(/^.*?\bis listed as QS \d{4} rank [^.]*\.\s*/i, "")
          .trim();
        const summary =
          policySummary &&
          !/\b(?:QS|THE|ARWU|CWTS)\s+20\d{2}/.test(policySummary)
            ? policySummary
            : `${row.claimCount} ${ui.claims} · ${row.sourceCount} ${ui.sources}`;
        const id = row.slug
          ? "result-" + row.slug
          : "result-" + row.id.replaceAll(":", "-");
        return row.slug ? (
          <div
            className="directory-browser-policy"
            id={id}
            data-result-id={row.id}
            key={row.id}
          >
            <span className="directory-browser-rank">
              {edition.label} · {row.rankText}
            </span>
            <DiscoveryUniversityCard
              record={{
                ...row,
                country: countryLabel(row.country),
                region: row.region.trim().replace(/,+$/, ""),
                summary,
              }}
              locale={p.locale}
              selected={p.compare.includes(row.slug)}
              compareDisabled={p.compare.length >= 4}
              onCompare={() => p.onCompare(row.slug)}
              returnTo={p.returnTo}
            />
          </div>
        ) : (
          <article
            className="directory-browser-source"
            id={id}
            data-result-id={row.id}
            data-source-record={row.id}
            key={row.id}
          >
            <span className="directory-browser-rank">
              {edition.label} · {row.rankText}
            </span>
            <h3>{row.name}</h3>
            <p>
              {formatDiscoveryLocation(row.region, row.country) ||
                copy.unknownCountry}
            </p>
            <p>
              {copy.noPolicy} · {copy.pending}
            </p>
            <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">
              {copy.source} ↗
            </a>
          </article>
        );
      })}
    </div>
  );
}
export function RankingTable(p: DiscoveryResultsProps) {
  const ui = discoveryCopy(p.locale),
    copy = rankingBrowserCopy(p.locale),
    rankLabel =
      getRankingEdition(p.edition)!.systemId === "cwts"
        ? rankingsCopy(p.locale).derived
        : ui.rankOrder;
  return (
    <div className="ranking-v6-table-wrap">
      <table className="ranking-v6-table">
        <thead>
          <tr>
            <th scope="col">{rankLabel}</th>
            <th scope="col">{ui.universities}</th>
            <th scope="col">{ui.country}</th>
            <th scope="col">{copy.review}</th>
            <th scope="col">{copy.scope}</th>
          </tr>
        </thead>
        <tbody>
          {p.rows.map((row) => (
            <tr
              key={row.id}
              id={"result-" + row.id.replaceAll(":", "-")}
              data-result-id={row.id}
              data-university={row.slug || undefined}
              data-source-record={!row.slug ? row.id : undefined}
            >
              <td className="ranking-v6-position" data-label={rankLabel}>
                <strong>{row.rankText}</strong>
              </td>
              <td className="ranking-v6-university">
                {row.slug ? (
                  <>
                    <UniversityMark slug={row.slug} />
                    <Link
                      href={`/universities/${row.slug}?returnTo=${encodeURIComponent(p.returnTo)}`}
                    >
                      {getLocalizedInstitutionName(
                        row.slug,
                        row.name,
                        p.locale,
                      )}
                    </Link>
                  </>
                ) : (
                  <span>{row.name}</span>
                )}
              </td>
              <td className="ranking-v6-location" data-label={ui.country}>
                {formatDiscoveryLocation(row.region, row.country) ||
                  copy.unknownCountry}
              </td>
              <td className="ranking-browser-review" data-label={copy.review}>
                {row.lastCheckedAt ? (
                  <>
                    <time dateTime={row.lastCheckedAt}>
                      {formatDateMedium(row.lastCheckedAt, p.locale)}
                    </time>
                    <small>
                      {row.reviewedClaimCount}/{row.claimCount} {ui.evidence}
                    </small>
                  </>
                ) : (
                  <span>—</span>
                )}
              </td>
              <td className="ranking-v6-row-actions">
                {row.slug ? (
                  <>
                    <Link
                      href={`/universities/${row.slug}?returnTo=${encodeURIComponent(p.returnTo)}`}
                    >
                      {row.claimCount ? ui.viewGuide : copy.linked} →
                    </Link>
                    <label>
                      <input
                        type="checkbox"
                        checked={p.compare.includes(row.slug)}
                        disabled={
                          p.compare.length >= 4 && !p.compare.includes(row.slug)
                        }
                        onChange={() => p.onCompare(row.slug)}
                        aria-label={`${ui.compare} ${row.name}`}
                      />
                      {ui.compare}
                    </label>
                  </>
                ) : (
                  <>
                    <span className="ranking-browser-status">
                      {copy.noPolicy}
                      <small>{copy.pending}</small>
                    </span>
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {copy.source} ↗
                    </a>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
