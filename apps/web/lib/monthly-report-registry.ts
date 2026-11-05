import { contentScoped, readContentJson } from "./content-runtime";

// Monthly report specs are content (data/monthly-reports/registry.json in the
// active content release). Publishing a report adds one entry and moves
// `current`; the /reports/monthly/[month] routes, coverage appendices, chart
// data and share images all read it at request time, so no build is needed.

export type MonthlyReportSlug = string;

export interface MonthlyReportSpec {
  type: "monthly";
  month: string;
  title: string;
  description: string;
  releaseLabel: string;
  /** Repository-layout path of the public release manifest the report counts. */
  releaseManifestPath: string;
  reportPeriod: string;
  publishedAt?: string;
  summaryIntro: string;
  reportFindings: readonly string[];
  shareImage: { alt: string; headline: string; localizedAlt: string };
}

export interface MonthlyReportRegistry {
  schemaVersion: "uapt-monthly-report-registry-v1";
  /** Latest published report; replaces the former hard-coded slug in reports.ts. */
  current: string;
  reports: Record<string, MonthlyReportSpec>;
}

export const MONTHLY_REPORT_REGISTRY_PATH = "data/monthly-reports/registry.json";
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Structural checks shared by the runtime loader and the content validator. */
export function validateMonthlyReportRegistry(value: unknown): MonthlyReportRegistry {
  const registry = value as MonthlyReportRegistry;
  if (!registry || registry.schemaVersion !== "uapt-monthly-report-registry-v1" || !registry.reports || typeof registry.reports !== "object") {
    throw new Error("Invalid monthly report registry");
  }
  for (const [slug, spec] of Object.entries(registry.reports)) {
    const text = (field: unknown) => typeof field === "string" && field.trim().length > 0;
    if (!MONTH.test(slug) || spec.month !== slug || spec.type !== "monthly" ||
        ![spec.title, spec.description, spec.releaseLabel, spec.reportPeriod, spec.summaryIntro].every(text) ||
        !/^data\/public-releases\/(?:history\/[a-z0-9-]+|current)\.json$/.test(spec.releaseManifestPath) ||
        !Array.isArray(spec.reportFindings) || !spec.reportFindings.every(text) ||
        !spec.shareImage || ![spec.shareImage.alt, spec.shareImage.headline, spec.shareImage.localizedAlt].every(text) ||
        (spec.publishedAt !== undefined && Number.isNaN(Date.parse(spec.publishedAt)))) {
      throw new Error(`Invalid monthly report spec: ${slug}`);
    }
  }
  if (!Object.hasOwn(registry.reports, registry.current)) throw new Error("Current monthly report is not in the registry");
  return registry;
}

export function monthlyReportRegistry(): MonthlyReportRegistry {
  return contentScoped("monthly-report-registry", () =>
    validateMonthlyReportRegistry(readContentJson<MonthlyReportRegistry>(MONTHLY_REPORT_REGISTRY_PATH)));
}

export function monthlyReportSlugs(): MonthlyReportSlug[] {
  return Object.keys(monthlyReportRegistry().reports);
}

export function currentMonthlyReportSlug(): MonthlyReportSlug {
  return monthlyReportRegistry().current;
}

export function isMonthlyReportSlug(slug: string): slug is MonthlyReportSlug {
  return MONTH.test(slug) && Object.hasOwn(monthlyReportRegistry().reports, slug);
}

export function getMonthlyReportSpec(slug: string): MonthlyReportSpec | undefined {
  return isMonthlyReportSlug(slug) ? monthlyReportRegistry().reports[slug] : undefined;
}

export function getMonthlyReportShareImage(slug: string) {
  return getMonthlyReportSpec(slug)?.shareImage;
}
