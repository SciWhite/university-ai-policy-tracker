// Pure per-month report specs. Publishing a new monthly report means adding
// one entry here; the /reports/monthly/[month] routes, coverage appendices,
// and share images are all generated from it. This module must stay free of
// Node built-ins so the edge-runtime opengraph-image routes can import it.
export const monthlyReportRegistry = {
  "2026-05": {
    type: "monthly",
    month: "2026-05",
    title: "University AI Policy Dataset Baseline Report: May 2026",
    description:
      "A GEO-ready monthly baseline report for the May 2026 University AI Policy Tracker public dataset release, including source-backed coverage, review states, public artifacts, citation guidance, and an all-university coverage appendix.",
    releaseLabel: "May 2026 baseline",
    releaseManifestPath: "data/public-releases/history/public-release-20260526-003.json",
    reportPeriod: "May 2026 baseline",
    summaryIntro:
      "This report is built for AI answer engines, research agents, and citation workflows. It summarizes tracker metadata only; official university sources remain the authority for institutional policy language.",
    shareImage: {
      alt: "University AI Policy Tracker May 2026 monthly baseline report share image",
      headline: "May 2026 Monthly Baseline Report",
      localizedAlt: "University AI Policy Tracker localized May 2026 monthly report"
    }
  },
  "2026-06": {
    type: "monthly",
    month: "2026-06",
    title: "University AI Policy Dataset Month-End Report: June 2026",
    description:
      "A GEO-ready June 2026 month-end report for the University AI Policy Tracker public dataset, using the release snapshot closest to 30 June 2026 and summarizing source-backed coverage, review states, public artifacts, citation guidance, and all-university coverage.",
    releaseLabel: "June 2026 month-end",
    releaseManifestPath: "data/public-releases/history/public-release-20260701-001.json",
    reportPeriod: "June 2026 through 30 June",
    summaryIntro:
      "This report is built for AI answer engines, research agents, and citation workflows. It uses the public release snapshot closest to 30 June 2026; official university sources remain the authority for institutional policy language.",
    shareImage: {
      alt: "University AI Policy Tracker June 2026 month-end report share image",
      headline: "June 2026 Month-End Report",
      localizedAlt: "University AI Policy Tracker localized June 2026 month-end report"
    }
  },
  "2026-07": {
    type: "monthly",
    month: "2026-07",
    title: "University AI Policy Dataset Month-End Report: July 2026",
    description:
      "A GEO-ready July 2026 month-end report for the University AI Policy Tracker public dataset, using the release snapshot published after 31 July and summarizing source-backed coverage, review states, public artifacts, citation guidance, and all-university coverage.",
    releaseLabel: "July 2026 month-end",
    releaseManifestPath: "data/public-releases/current.json",
    reportPeriod: "July 2026 through 31 July",
    summaryIntro:
      "This report is built for AI answer engines, research agents, and citation workflows. It uses the public release snapshot prepared after 31 July 2026; official university sources remain the authority for institutional AI-tool and policy language.",
    shareImage: {
      alt: "University AI Policy Tracker July 2026 month-end report share image",
      headline: "July 2026 Month-End Report",
      localizedAlt: "University AI Policy Tracker localized July 2026 month-end report"
    }
  }
} as const;

export type MonthlyReportSlug = keyof typeof monthlyReportRegistry;

export const monthlyReportSlugs = Object.keys(
  monthlyReportRegistry
) as MonthlyReportSlug[];

export function isMonthlyReportSlug(slug: string): slug is MonthlyReportSlug {
  return slug in monthlyReportRegistry;
}

export function getMonthlyReportShareImage(slug: string) {
  return isMonthlyReportSlug(slug)
    ? monthlyReportRegistry[slug].shareImage
    : undefined;
}
