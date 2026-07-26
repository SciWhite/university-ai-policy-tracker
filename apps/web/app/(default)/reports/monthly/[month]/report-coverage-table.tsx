import Link from "next/link";
import type { MonthlyReportMacroRegionGroup } from "@/lib/reports";
import { formatReportDate } from "@/lib/reports";
import { DEFAULT_LOCALE, localizeHref, type SupportedLocale } from "@/lib/i18n";
import { translateSurfaceText } from "@/lib/surface-localization";

interface ReportCoverageTableProps {
  group: MonthlyReportMacroRegionGroup;
  locale?: SupportedLocale;
}

export function ReportCoverageTable({ group, locale = DEFAULT_LOCALE }: ReportCoverageTableProps) {
  const t = (value: string) => translateSurfaceText(value, locale);
  return (
    <div className="coverage-region-list">
      <section className="coverage-region" id={group.anchorId}>
        <h2>{group.macroRegion}</h2>
        <p className="table-summary">
          {t("{0} university records across {1} country or region labels.")
            .replace("{0}", group.universityCount.toLocaleString(locale))
            .replace("{1}", group.countryCount.toLocaleString(locale))}
        </p>
        {group.cityGroups.map((cityGroup) => (
          <section
            className="coverage-city"
            id={cityGroup.anchorId}
            key={`${group.macroRegion}-${cityGroup.cityCampusRegion}`}
          >
            <h3>{cityGroup.cityCampusRegion}</h3>
            <p className="table-summary">
              {t("{0} records across {1} country or region labels.")
                .replace("{0}", cityGroup.universityCount.toLocaleString(locale))
                .replace("{1}", cityGroup.countryCount.toLocaleString(locale))}
            </p>
            <div className="reference-table-wrap">
              <table className="reference-table report-coverage-table">
                <thead>
                  <tr>
                    <th scope="col">{t("University")}</th>
                    <th scope="col">{t("Country/region")}</th>
                    <th scope="col">{t("Ranking label")}</th>
                    <th scope="col">{t("Claims")}</th>
                    <th scope="col">{t("Sources")}</th>
                    <th scope="col">{t("Last checked")}</th>
                    <th scope="col">{t("Links")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cityGroup.rows.map((row) => (
                    <tr key={row.slug}>
                      <td>
                        <Link className="table-record-title" href={localizeHref(row.recordUrl, locale)}>
                          {row.name}
                        </Link>
                      </td>
                      <td>{row.countryOrRegion}</td>
                      <td>{row.rankingLabel}</td>
                      <td>{row.claimCount}</td>
                      <td>{row.sourceCount}</td>
                      <td>{formatReportDate(row.lastCheckedAt, locale)}</td>
                      <td>
                        <span className="table-record-meta">
                          <Link href={localizeHref(row.recordUrl, locale)}>{t("Record")}</Link>
                          <a href={row.publicJsonUrl}>JSON</a>
                          <Link href={localizeHref(row.changeUrl, locale)}>{t("Changes")}</Link>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}
