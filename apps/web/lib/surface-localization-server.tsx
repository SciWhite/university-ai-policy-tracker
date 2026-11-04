import type { Metadata } from "next";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { ReadingUiTextProvider } from "@/components/reading-ui-text-provider";
import { getPublicReadingUiText } from "./public-ui-translations";
import { DEFAULT_LOCALE } from "./i18n";
import { presentationTextSources, publicClientTextSources, publicSurfaceTextSources } from "./public-ui-sources";
import { getSurfaceLocale, localizeSurfaceMetadata, localizeSurfaceTree } from "./surface-localization";
import type { ReadingLocale } from "./language-catalog";
import { OrganizationIdentity } from "@/components/organization-identity";
import { AgentMethods } from "@/components/agent-methods";
import { SourceHealthLabel } from "@/components/source-health-label";
import { AnalysisStatusLabel } from "@/components/analysis-status-label";
import { ToolRecordFields } from "@/components/tool-record-fields";
import { ChangeHistoryBrowser } from "@/components/change-history-browser";
import { ChangeIndexEventsBrowser } from "@/components/change-index-events-browser";
import { ChangeEventContent } from "@/components/change-event-content";
import { BrowseEntryGroups } from "@/components/browse-entry-groups";
import { ReportCoverageTable } from "@/app/(default)/reports/monthly/[month]/report-coverage-table";
import { ApiEndpointRow } from "@/components/api-endpoint-row";

// These server components produce their own presentation copy after the page
// returns. Pass the accepted copy explicitly; arbitrary components and evidence
// objects must not be evaluated or translated by the surface walker.
const publicCopyComponents = new Set<unknown>([
  OrganizationIdentity, AgentMethods, SourceHealthLabel, AnalysisStatusLabel, ToolRecordFields, ChangeEventContent, BrowseEntryGroups, ReportCoverageTable, ApiEndpointRow
]);
const readingLocaleComponents = new Set<unknown>([ChangeHistoryBrowser, ChangeIndexEventsBrowser]);
function withPublicComponentCopy(node: ReactNode, locale: ReadingLocale, sharedUiText: Readonly<Record<string, string>>): ReactNode {
  if (Array.isArray(node)) return Children.map(node, child => withPublicComponentCopy(child, locale, sharedUiText));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  const props = { ...element.props };
  if (publicCopyComponents.has(element.type)) Object.assign(props, { readingLocale: locale, sharedUiText });
  if (readingLocaleComponents.has(element.type)) props.readingLocale = locale;
  if (props["data-i18n"] !== "preserve" && "children" in props) props.children = withPublicComponentCopy(props.children as ReactNode, locale, sharedUiText);
  if (element.type === ChangeIndexEventsBrowser) {
    // Country facets are presentation labels; send only the labels this browser shows.
    const countries = (props.initial as { facets?: { countries?: string[] } } | undefined)?.facets?.countries ?? [];
    const labels = Object.fromEntries(countries.flatMap(country => sharedUiText[country] ? [[country, sharedUiText[country]]] : []));
    return <ReadingUiTextProvider value={labels}>{cloneElement(element, props)}</ReadingUiTextProvider>;
  }
  return cloneElement(element, props);
}
export function localizePublicSurfaceTree(node: ReactNode, locale: ReadingLocale, uiText: Readonly<Record<string, string>>): ReactNode {
  return withPublicComponentCopy(localizeSurfaceTree(node, locale, uiText), locale, uiText);
}

type SurfaceProps = {
  params?: Promise<Record<string, string | undefined>>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Collect only rendered presentation inputs; evidence and code stay untouched. */
export function publicSurfaceNodeTextSources(node: ReactNode): string[] {
  const sources = new Set<string>();
  const visit = (value: ReactNode) => {
    if (typeof value === "string") {
      const text = value.replace(/\s+/g, " ").trim();
      if (text) sources.add(text);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (isValidElement(value)) {
      const props = value.props as Record<string, unknown>;
      if (props["data-i18n"] === "preserve" || value.type === "code" || value.type === "pre") return;
      for (const key of ["title", "description", "eyebrow", "label", "alt", "aria-label", "placeholder", "summary"]) {
        if (typeof props[key] === "string") visit(props[key]);
      }
      visit(props.children as ReactNode);
    }
  };
  visit(node);
  return [...sources];
}

/** Keep package I/O outside the pure surface helpers imported by client islands. */
export function createLocalizedSurfacePage(renderer: unknown, pathname: string) {
  return async function LocalizedSurfacePage(props: SurfaceProps) {
    const locale = getSurfaceLocale(await props.params);
    const node = await (renderer as (props: SurfaceProps) => ReactNode | Promise<ReactNode>)(props);
    const uiText = locale === DEFAULT_LOCALE ? {} : await getPublicReadingUiText(locale, [...publicSurfaceTextSources, ...publicSurfaceNodeTextSources(node)]);
    const localized = localizePublicSurfaceTree(node, locale, uiText);
    const clientSources = publicClientTextSources(pathname);
    const clientText = Object.fromEntries(clientSources.flatMap(source => uiText[source] === undefined ? [] : [[source, uiText[source]]]));
    return Object.keys(clientText).length
      ? <ReadingUiTextProvider value={clientText}>{localized}</ReadingUiTextProvider>
      : localized;
  };
}

export function createLocalizedSurfaceMetadata(
  source: Metadata | ((props: unknown) => Metadata | Promise<Metadata>),
  pathname: string | ((props: Record<string, string | undefined>) => string)
) {
  return async function generateLocalizedMetadata(props: { params?: Promise<Record<string, string | undefined>> }) {
    const params = (await props.params) ?? {};
    const locale = getSurfaceLocale(params);
    const metadata = typeof source === "function" ? await source(props) : source;
    const uiText = locale === DEFAULT_LOCALE ? {} : await getPublicReadingUiText(locale, [...publicSurfaceTextSources, ...presentationTextSources(metadata)]);
    const resolvedPath = typeof pathname === "function" ? pathname(params) : pathname;
    return localizeSurfaceMetadata(metadata, resolvedPath, locale, uiText);
  };
}
