import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { StateLabel, getReviewStateLabel } from "@/components/state-label";
import enStrings from "@/messages/surfaces/en.json";
import zhStrings from "@/messages/surfaces/zh.json";
import frStrings from "@/messages/surfaces/fr.json";
import plStrings from "@/messages/surfaces/pl.json";
import esStrings from "@/messages/surfaces/es.json";
import nlStrings from "@/messages/surfaces/nl.json";
import msStrings from "@/messages/surfaces/ms.json";
import {
  DEFAULT_LOCALE,
  legacyLocale,
  localizeHref,
  normalizeReadingLocale,
  type SupportedLocale
} from "@/lib/i18n";
import type { ReadingLocale } from "@/lib/language-catalog";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import {
  getIndexRecoveryPilotLocaleRestriction,
  getIndexRecoveryPilotSlugFromPath
} from "@/lib/index-recovery-pilot";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getInstitutionNativeName } from "@/lib/institution-localization";

const localizedStrings = {
  zh: zhStrings,
  fr: frStrings,
  pl: plStrings,
  es: esStrings,
  nl: nlStrings,
  ms: msStrings
} as const;

const translationMaps = Object.fromEntries(
  Object.entries(localizedStrings).map(([locale, values]) => {
    if (values.length !== enStrings.length) {
      throw new Error(`Surface translation length mismatch for ${locale}`);
    }
    return [locale, new Map(enStrings.map((value, index) => [value, values[index]]))];
  })
) as Partial<Record<Exclude<SupportedLocale, "en">, Map<string, string>>>;

const patternTranslations = Object.fromEntries(
  Object.entries(translationMaps).map(([locale, values]) => [
    locale,
    [...values.entries()]
      .filter(([source]) => /\{\d+\}/.test(source))
      .map(([source, translation]) => ({
        regex: new RegExp(
          `^${escapeRegExp(source).replace(/\\\{\d+\\\}/g, "(.*?)")}$`
        ),
        translation
      }))
  ])
) as Partial<Record<Exclude<SupportedLocale, "en">, Array<{ regex: RegExp; translation: string }>>>;

const caseInsensitiveTranslationMaps = Object.fromEntries(
  Object.entries(translationMaps).map(([locale, values]) => [
    locale,
    new Map([...values.entries()].map(([source, translation]) => [source.toLowerCase(), translation]))
  ])
) as Partial<Record<Exclude<SupportedLocale, "en">, Map<string, string>>>;

const translatableProps = new Set([
  "actions",
  "alt",
  "aria-label",
  "children",
  "citationText",
  "data",
  "description",
  "eyebrow",
  "items",
  "label",
  "links",
  "metadata",
  "placeholder",
  "status",
  "summary",
  "tabs",
  "title"
]);
const structuredDataTextKeys = new Set([
  "about",
  "alternateName",
  "citation",
  "description",
  "headline",
  "keywords",
  "name",
  "text"
]);

export function getSurfaceLocale(params: { locale?: string } | undefined) {
  return normalizeReadingLocale(params?.locale);
}

export async function resolveSurfaceLocale(props: {
  params?: Promise<{ locale?: string }>;
}) {
  return getSurfaceLocale(await props.params);
}

export async function renderLocalizedSurfacePage(
  renderer: (props: unknown) => ReactNode | Promise<ReactNode>,
  props: { params?: Promise<{ locale?: string }> }
) {
  const locale = await resolveSurfaceLocale(props);
  return localizeSurfaceTree(await renderer(props), locale);
}

export function createLocalizedSurfacePage(renderer: unknown) {
  return async function LocalizedSurfacePage(props: {
    params?: Promise<Record<string, string | undefined>>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }) {
    return renderLocalizedSurfacePage(
      renderer as (props: unknown) => ReactNode | Promise<ReactNode>,
      props
    );
  };
}

export function createLocalizedSurfaceMetadata(
  source: Metadata | ((props: unknown) => Metadata | Promise<Metadata>),
  pathname:
    | string
    | ((
        props: Record<string, string | undefined>,
        searchParams?: Record<string, string | string[] | undefined>
      ) => string)
) {
  return async function generateLocalizedMetadata(props: {
    params?: Promise<Record<string, string | undefined>>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }) {
    const params = (await props.params) ?? {};
    // Reading searchParams makes a page dynamic; only paths that depend on the query (/sources
    // pagination) take that cost. Static pages (e.g. zh university pages) must not.
    const searchParams = typeof pathname === "function" && pathname.length > 1 ? (await props.searchParams) ?? {} : {};
    const locale = getSurfaceLocale(params);
    const metadata =
      typeof source === "function" ? await source(props) : source;
    const resolvedPath =
      typeof pathname === "function" ? pathname(params, searchParams) : pathname;
    return localizeSurfaceMetadata(metadata, resolvedPath, locale);
  };
}

export function translateSurfaceText(
  value: string,
  locale: ReadingLocale,
  sharedUiText: Readonly<Record<string, string>> = {}
) {
  if (locale === DEFAULT_LOCALE) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const normalized = value.replace(/\s+/g, " ").trim();
  const brandSuffix = " | University AI Policy Tracker";
  if (normalized.endsWith(brandSuffix) && (!sharedUiText[normalized] || sharedUiText[normalized] === normalized)) {
    const label = normalized.slice(0, -brandSuffix.length);
    if (sharedUiText[label] && sharedUiText[label] !== label) return `${leading}${sharedUiText[label]}${brandSuffix}${trailing}`;
  }
  const accepted = sharedUiText[value] ?? sharedUiText[normalized];
  if (accepted !== undefined) return `${leading}${accepted}${trailing}`;
  const acceptedTemplate = translateAcceptedTemplate(normalized, sharedUiText);
  if (acceptedTemplate !== undefined) return `${leading}${acceptedTemplate}${trailing}`;
  const aiPolicyMatch = (normalized.endsWith(brandSuffix) ? normalized.slice(0, -brandSuffix.length) : normalized).match(/^(.*?)(?:\s+| — )(AI [Pp]olicy|AI 政策|Politique d’IA|Polityka AI|Política de IA|AI-beleid|Dasar AI)$/);
  if (aiPolicyMatch) {
    const rawSchool = aiPolicyMatch[1];
    const rawSuffix = aiPolicyMatch[2];
    const localizedSuffix = sharedUiText[rawSuffix] ?? sharedUiText["AI policy"] ?? sharedUiText["AI Policy"] ?? rawSuffix;
    const localizedSchool = sharedUiText[rawSchool] ?? getInstitutionNativeName(rawSchool, locale) ?? rawSchool;
    if (localizedSchool !== rawSchool || (localizedSuffix && localizedSuffix !== rawSuffix)) {
      const translatedTitle = `${localizedSchool} ${localizedSuffix}`;
      return `${leading}${translatedTitle}${normalized.endsWith(brandSuffix) ? brandSuffix : ""}${trailing}`;
    }
  }
  const dictionaryLocale = legacyLocale(locale);
  if (dictionaryLocale === DEFAULT_LOCALE) return value;
  const localeMap = translationMaps[dictionaryLocale];
  if (!localeMap) return value;
  const translated = localeMap.get(normalized);
  if (translated) return `${leading}${translated}${trailing}`;

  for (const pattern of patternTranslations[dictionaryLocale] ?? []) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;
    const localized = pattern.translation.replace(/\{(\d+)\}/g, (_, index) => {
      const captured = match[Number(index) + 1] ?? "";
      return (
        localizeAbsoluteSiteUrl(captured, locale) ??
        localeMap.get(captured) ??
        caseInsensitiveTranslationMaps[dictionaryLocale]?.get(captured.toLowerCase()) ??
        captured
      );
    });
    return `${leading}${localized}${trailing}`;
  }

  return value;
}


/** Localize an explicitly selected presentation copy object, including its formatters. */
export function localizeSurfaceCopy<T>(value: T, locale: ReadingLocale, sharedUiText: Readonly<Record<string, string>>): T {
  const visit = (current: unknown): unknown => {
    if (typeof current === "string") return translateSurfaceText(current, locale, sharedUiText);
    if (typeof current === "function") return (...args: unknown[]) => visit(current(...args));
    if (Array.isArray(current)) return current.map(visit);
    if (current && typeof current === "object") return Object.fromEntries(Object.entries(current).map(([key, child]) => [key, visit(child)]));
    return current;
  };
  return visit(value) as T;
}

const acceptedTemplates = new WeakMap<Readonly<Record<string, string>>, Array<{ regex: RegExp; tokens: string[]; target: string }>>();
function translateAcceptedTemplate(value: string, sharedUiText: Readonly<Record<string, string>>): string | undefined {
  let templates = acceptedTemplates.get(sharedUiText);
  if (!templates) {
    templates = Object.entries(sharedUiText).flatMap(([source, target]) => {
      const tokens = [...source.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(match => match[1]);
      if (!tokens.length) return [];
      const regex = new RegExp(`^${escapeRegExp(source).replace(/\\\{[a-zA-Z0-9_]+\\\}/g, "(.*?)")}$`);
      return [{ regex, tokens, target }];
    });
    acceptedTemplates.set(sharedUiText, templates);
  }
  for (const template of templates) {
    const match = value.match(template.regex);
    if (!match) continue;
    return template.target.replace(/\{([a-zA-Z0-9_]+)\}/g, (token, key: string) => {
      const index = template.tokens.indexOf(key);
      if (index < 0) return token;
      const captured = match[index + 1] ?? "";
      return sharedUiText[captured] ?? captured;
    });
  }
  return undefined;
}

export function localizeSurfaceTree(
  node: ReactNode,
  locale: ReadingLocale,
  sharedUiText: Readonly<Record<string, string>> = {}
): ReactNode {
  if (locale === DEFAULT_LOCALE || node == null || typeof node === "boolean") {
    return node;
  }
  if (typeof node === "string") return translateSurfaceText(node, locale, sharedUiText);
  if (typeof node === "number") return node;
  if (Array.isArray(node)) return Children.map(node, (child) => localizeSurfaceTree(child, locale, sharedUiText));
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<Record<string, unknown>>;
  const props = { ...element.props };
  if (element.type === StateLabel && typeof props.reviewState === "string") {
    props.displayLabel = translateSurfaceText(getReviewStateLabel(props.reviewState, legacyLocale(locale)), locale, sharedUiText);
    if (props.prefix !== "") props.prefix = translateSurfaceText(typeof props.prefix === "string" ? props.prefix : "Review", locale, sharedUiText);
  }
  const preserveChildren = props["data-i18n"] === "preserve" || element.type === "code" || element.type === "pre";
  if (typeof element.type !== "string" && element.type !== NextLink && !("locale" in props)) {
    props.locale = legacyLocale(locale);
  }
  for (const [key, value] of Object.entries(props)) {
    if (key === "href" || key === "action") {
      if (typeof value === "string") props[key] = localizeHref(value, locale);
    } else if (key === "children") {
      if (!preserveChildren) props.children = localizeSurfaceTree(value as ReactNode, locale, sharedUiText);
    } else if (key.endsWith("Url") && typeof value === "string") {
      props[key] = localizeAbsoluteSiteUrl(value, locale) ?? value;
    } else if (key === "data") {
      props[key] = localizeStructuredData(value, locale, undefined, sharedUiText);
    } else if (translatableProps.has(key)) {
      props[key] = localizeSurfaceValue(value, locale, undefined, sharedUiText);
    }
  }
  if (!("children" in props)) {
    props.children = Children.map(element.props.children as ReactNode, (child) =>
      localizeSurfaceTree(child, locale, sharedUiText)
    );
  }
  return cloneElement(element, props);
}

export function localizeSurfaceMetadata(
  metadata: Metadata,
  pathname: string,
  locale: ReadingLocale,
  sharedUiText: Readonly<Record<string, string>> = {}
): Metadata {
  const localized = localizeSurfaceValue(metadata, locale, undefined, sharedUiText) as Metadata;
  const universityDetail = /^\/universities\/[a-z0-9-]+\/?$/.test(pathname);
  if (universityDetail) {
    const isIndexable = Boolean(metadata.robots && typeof metadata.robots === "object" && metadata.robots.index === true);
    const alternates = isIndexable && metadata.alternates?.languages && Object.keys(metadata.alternates.languages).length > 0
      ? metadata.alternates
      : { canonical: getAbsoluteSiteUrl(localizeHref(pathname, locale)), languages: {} };
    return {
      ...localized,
      alternates,
      robots: metadata.robots ?? { index: isIndexable, follow: true },
      openGraph: localized.openGraph ? { ...localized.openGraph, url: String(alternates.canonical) } : undefined
    };
  }
  if (locale !== DEFAULT_LOCALE && legacyLocale(locale) === DEFAULT_LOCALE) {
    const canonical = getAbsoluteSiteUrl(localizeHref(pathname, locale));
    return { ...localized, alternates: { canonical }, robots: { index: false, follow: true }, openGraph: localized.openGraph ? { ...localized.openGraph, url: canonical } : undefined };
  }
  // University detail pages in the index-recovery pilot declare only the
  // English alternate because their substantive body (claims, evidence,
  // snapshot prose) has not passed translation review in other locales.
  // The restriction applies to both the default and locale routes so the
  // emitted alternate sets stay self-consistent.
  const pilotRestriction = getIndexRecoveryPilotLocaleRestriction(
    getIndexRecoveryPilotSlugFromPath(pathname)
  );
  const alternates = metadata.alternates?.languages !== undefined
    ? metadata.alternates
    : getLocalizedAlternates(pathname, legacyLocale(locale), { restrictLocales: pilotRestriction });
  const canonical = String(alternates.canonical);
  return {
    ...localized,
    alternates: {
      ...localized.alternates,
      ...alternates,
      // A locale wrapper must not reintroduce alternates on an excluded URL.
      ...((metadata.alternates?.languages !== undefined && Object.keys(metadata.alternates.languages).length === 0) || typeof metadata.robots === "object" && metadata.robots?.index === false ? {languages: {}} : {})
    },
    openGraph: localized.openGraph
      ? { ...localized.openGraph, url: canonical }
      : undefined
  };
}

export function localizedCanonical(pathname: string, locale: ReadingLocale) {
  return getAbsoluteSiteUrl(localizeHref(pathname, locale));
}

function localizeSurfaceValue(
  value: unknown,
  locale: ReadingLocale,
  key?: string,
  sharedUiText: Readonly<Record<string, string>> = {}
): unknown {
  if (typeof value === "string") {
    if (key === "href" || key === "action") return localizeHref(value, locale);
    const localizedUrl = localizeAbsoluteSiteUrl(value, locale);
    return localizedUrl ?? translateSurfaceText(value, locale, sharedUiText);
  }
  if (Array.isArray(value)) return value.map((item) => localizeSurfaceValue(item, locale, key, sharedUiText));
  if (isValidElement(value)) return localizeSurfaceTree(value, locale, sharedUiText);
  if (value instanceof URL || value instanceof Date) return value;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        localizeSurfaceValue(child, locale, childKey, sharedUiText)
      ])
    );
  }
  return value;
}

function localizeStructuredData(
  value: unknown,
  locale: ReadingLocale,
  key?: string,
  sharedUiText: Readonly<Record<string, string>> = {}
): unknown {
  if (typeof value === "string") {
    const localizedUrl = localizeAbsoluteSiteUrl(value, locale);
    if (localizedUrl) return localizedUrl;
    return key && structuredDataTextKeys.has(key)
      ? translateSurfaceText(value, locale, sharedUiText)
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => localizeStructuredData(item, locale, key, sharedUiText));
  }
  if (value && typeof value === "object") {
    const localized = Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        localizeStructuredData(child, locale, childKey, sharedUiText)
      ])
    );
    if (!key && "@context" in localized && !("inLanguage" in localized)) {
      localized.inLanguage = locale;
    }
    return localized;
  }
  return value;
}

function localizeAbsoluteSiteUrl(
  value: string,
  locale: ReadingLocale
): string | undefined {
  if (!/^https?:\/\//.test(value)) return undefined;

  try {
    const url = new URL(value);
    const site = new URL(getAbsoluteSiteUrl("/"));
    if (url.origin !== site.origin) return undefined;
    const localizedPath = localizeHref(
      `${url.pathname}${url.search}${url.hash}`,
      locale
    );
    return new URL(localizedPath, site).toString();
  } catch {
    return undefined;
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
