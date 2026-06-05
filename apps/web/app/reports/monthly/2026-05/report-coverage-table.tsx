import Link from "next/link";
import type { MonthlyReportMacroRegionGroup } from "@/lib/reports";
import { formatReportDate } from "@/lib/reports";

interface ReportCoverageTableProps {
  group: MonthlyReportMacroRegionGroup;
}

export function ReportCoverageTable({ group }: ReportCoverageTableProps) {
  return (
    <div className="coverage-region-list">
      <section className="coverage-region" id={group.anchorId}>
        <h2>{group.macroRegion}</h2>
        <p className="table-summary">
          {group.universityCount.toLocaleString("en-US")} university records
          across {group.countryCount.toLocaleString("en-US")} country or region
          labels.
        </p>
        {group.cityGroups.map((cityGroup) => (
          <section
            className="coverage-city"
            id={cityGroup.anchorId}
            key={`${group.macroRegion}-${cityGroup.cityCampusRegion}`}
          >
            <h3>{cityGroup.cityCampusRegion}</h3>
            <p className="table-summary">
              {cityGroup.universityCount.toLocaleString("en-US")} records across{" "}
              {cityGroup.countryCount.toLocaleString("en-US")} country or region
              labels.
            </p>
            <div className="reference-table-wrap">
              <table className="reference-table report-coverage-table">
                <thead>
                  <tr>
                    <th scope="col">University</th>
                    <th scope="col">Country/region</th>
                    <th scope="col">Ranking label</th>
                    <th scope="col">Claims</th>
                    <th scope="col">Sources</th>
                    <th scope="col">Last checked</th>
                    <th scope="col">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {cityGroup.rows.map((row) => (
                    <tr key={row.slug}>
                      <td>
                        <Link className="table-record-title" href={row.recordUrl}>
                          {row.name}
                        </Link>
                      </td>
                      <td>{row.countryOrRegion}</td>
                      <td>{row.rankingLabel}</td>
                      <td>{row.claimCount}</td>
                      <td>{row.sourceCount}</td>
                      <td>{formatReportDate(row.lastCheckedAt)}</td>
                      <td>
                        <span className="table-record-meta">
                          <Link href={row.recordUrl}>Record</Link>
                          <a href={row.publicJsonUrl}>JSON</a>
                          <Link href={row.changeUrl}>Changes</Link>
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
