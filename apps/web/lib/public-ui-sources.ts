import surfaceSources from "@/messages/surfaces/en.json";
import pageSources from "@/messages/pages/en.json";
import extraSources from "@/messages/public-ui/en.json";
import { monthlyReportRegistry } from "./monthly-report-registry";
import { analysisThemeSpecs } from "./policy-analysis-pages";
import { discoveryCopy } from "./discovery-copy";
import { mockupCopy } from "./mockup-copy";
import { rankingBrowserCopy } from "./ranking-browser-copy";
import { rankingsCopy } from "./rankings-copy";
import { getHomeV4Copy } from "./home-v4-copy";
import { getProjectCopy } from "./project-copy";
import { getChangesIndexClientCopy } from "./page-copy";
import { changeHistoryCopy } from "./change-history-copy";
import { changeIndexEventsCopy } from "./change-index-events-copy";
import { changeSummaryCopy } from "./change-summary-copy";
import { changeCountTextSources } from "./change-counts-copy";
import { v6ChangesCopy, v6ChangeTopicTitle, historicalChangeTopicOrder } from "./v6-changes-copy";
import { matchReasonTextSources } from "./match-reason-labels";

/** Explicit presentation inputs only; never collect university records or evidence. */
export function presentationTextSources(...values: unknown[]): string[] {
  const sources = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      if (value.trim() && !/^https?:\/\//.test(value)) sources.add(value);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  values.forEach(visit);
  return [...sources];
}

const discoverySources = presentationTextSources(
  discoveryCopy("en"), mockupCopy("en"), rankingBrowserCopy("en"), rankingsCopy("en")
);

const commonClientSources = [
  "Citation copy actions", "Copied", "Copy", "Citation", "citation", "canonical URL", "public JSON URL", "Record sections",
  "Machine candidate", "Agent reviewed", "Human reviewed", "Institution verified", "Needs review", "Rejected", "Review",
  "Loading suggestions...", "No public records match this query.", "Suggestions are unavailable. Submit the search instead.",
  "Match", "Score", "Claims", "Sources", "{0} suggestions available. Use the up and down arrow keys to browse.",
  "Page {n} of {m}", "Showing {visible} of {total} records.",
  ...matchReasonTextSources
];
const historySources = presentationTextSources(
  changeHistoryCopy("en"), changeIndexEventsCopy("en"), changeSummaryCopy("en"), changeCountTextSources,
  v6ChangesCopy("en"), [...historicalChangeTopicOrder, "coursework", "exams", "disclosure", "privacy_data", "approved_tools", "research_publication", "admissions", "applications", "teaching_guidance", "security_procurement"].map(key => v6ChangeTopicTitle(key, "en"))
);

export const publicSurfaceTextSources = presentationTextSources(
  surfaceSources, pageSources, discoverySources, getHomeV4Copy("en"), getProjectCopy("en"), commonClientSources, historySources,
  extraSources, Object.values(monthlyReportRegistry).map(report => [report.title, report.description, report.summaryIntro]), analysisThemeSpecs
);

/** The browser gets only the copy used by its page's interactive components. */
export function publicClientTextSources(pathname: string): string[] {
  if (pathname === "/search" || pathname === "/universities" || pathname.startsWith("/rankings")) return [...commonClientSources, ...discoverySources];
  if (pathname.startsWith("/changes")) return presentationTextSources(commonClientSources, discoverySources, getChangesIndexClientCopy("en"), historySources);
  return commonClientSources;
}
