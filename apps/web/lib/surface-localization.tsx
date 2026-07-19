import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import type { Metadata } from "next";
import enStrings from "@/messages/surfaces/en.json";
import zhStrings from "@/messages/surfaces/zh.json";
import frStrings from "@/messages/surfaces/fr.json";
import plStrings from "@/messages/surfaces/pl.json";
import esStrings from "@/messages/surfaces/es.json";
import nlStrings from "@/messages/surfaces/nl.json";
import msStrings from "@/messages/surfaces/ms.json";
import {
  DEFAULT_LOCALE,
  localizeHref,
  normalizeLocale,
  type SupportedLocale
} from "@/lib/i18n";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

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
) as Record<Exclude<SupportedLocale, "en">, Map<string, string>>;

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
) as Record<Exclude<SupportedLocale, "en">, Array<{ regex: RegExp; translation: string }>>;

const caseInsensitiveTranslationMaps = Object.fromEntries(
  Object.entries(translationMaps).map(([locale, values]) => [
    locale,
    new Map([...values.entries()].map(([source, translation]) => [source.toLowerCase(), translation]))
  ])
) as Record<Exclude<SupportedLocale, "en">, Map<string, string>>;

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
  return normalizeLocale(params?.locale);
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
  pathname: string | ((props: Record<string, string | undefined>) => string)
) {
  return async function generateLocalizedMetadata(props: {
    params?: Promise<Record<string, string | undefined>>;
  } = {}) {
    const params = (await props.params) ?? {};
    const locale = getSurfaceLocale(params);
    const metadata =
      typeof source === "function" ? await source(props) : source;
    const resolvedPath =
      typeof pathname === "function" ? pathname(params) : pathname;
    return localizeSurfaceMetadata(metadata, resolvedPath, locale);
  };
}

export function translateSurfaceText(value: string, locale: SupportedLocale) {
  if (locale === DEFAULT_LOCALE) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const normalized = value.replace(/\s+/g, " ").trim();
  const translated = translationMaps[locale].get(normalized);
  if (translated) return `${leading}${translated}${trailing}`;

  for (const pattern of patternTranslations[locale]) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;
    const localized = pattern.translation.replace(/\{(\d+)\}/g, (_, index) => {
      const captured = match[Number(index) + 1] ?? "";
      return (
        localizeAbsoluteSiteUrl(captured, locale) ??
        translationMaps[locale].get(captured) ??
        caseInsensitiveTranslationMaps[locale].get(captured.toLowerCase()) ??
        captured
      );
    });
    return `${leading}${localized}${trailing}`;
  }

  return value;
}

export function localizeSurfaceTree(
  node: ReactNode,
  locale: SupportedLocale
): ReactNode {
  if (locale === DEFAULT_LOCALE || node == null || typeof node === "boolean") {
    return node;
  }
  if (typeof node === "string") return translateSurfaceText(node, locale);
  if (typeof node === "number") return node;
  if (Array.isArray(node)) return node.map((child) => localizeSurfaceTree(child, locale));
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<Record<string, unknown>>;
  const props = { ...element.props };
  const preserveChildren = props["data-i18n"] === "preserve";
  if (typeof element.type !== "string" && !("locale" in props)) {
    props.locale = locale;
  }
  for (const [key, value] of Object.entries(props)) {
    if (key === "href" || key === "action") {
      if (typeof value === "string") props[key] = localizeHref(value, locale);
    } else if (key === "children" && preserveChildren) {
      continue;
    } else if (key.endsWith("Url") && typeof value === "string") {
      props[key] = localizeAbsoluteSiteUrl(value, locale) ?? value;
    } else if (key === "data") {
      props[key] = localizeStructuredData(value, locale);
    } else if (translatableProps.has(key)) {
      props[key] = localizeSurfaceValue(value, locale);
    }
  }
  if (!("children" in props)) {
    props.children = Children.map(element.props.children as ReactNode, (child) =>
      localizeSurfaceTree(child, locale)
    );
  }
  return cloneElement(element, props);
}

export function localizeSurfaceMetadata(
  metadata: Metadata,
  pathname: string,
  locale: SupportedLocale
): Metadata {
  const localized = localizeSurfaceValue(metadata, locale) as Metadata;
  const alternates = getLocalizedAlternates(pathname, locale);
  const canonical = String(alternates.canonical);
  return {
    ...localized,
    alternates: {
      ...localized.alternates,
      ...alternates
    },
    openGraph: localized.openGraph
      ? { ...localized.openGraph, url: canonical }
      : undefined
  };
}

export function localizedCanonical(pathname: string, locale: SupportedLocale) {
  return getAbsoluteSiteUrl(localizeHref(pathname, locale));
}

function localizeSurfaceValue(
  value: unknown,
  locale: SupportedLocale,
  key?: string
): unknown {
  if (typeof value === "string") {
    if (key === "href" || key === "action") return localizeHref(value, locale);
    const localizedUrl = localizeAbsoluteSiteUrl(value, locale);
    return localizedUrl ?? translateSurfaceText(value, locale);
  }
  if (Array.isArray(value)) return value.map((item) => localizeSurfaceValue(item, locale, key));
  if (isValidElement(value)) return localizeSurfaceTree(value, locale);
  if (value instanceof URL || value instanceof Date) return value;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        localizeSurfaceValue(child, locale, childKey)
      ])
    );
  }
  return value;
}

function localizeStructuredData(
  value: unknown,
  locale: SupportedLocale,
  key?: string
): unknown {
  if (typeof value === "string") {
    const localizedUrl = localizeAbsoluteSiteUrl(value, locale);
    if (localizedUrl) return localizedUrl;
    return key && structuredDataTextKeys.has(key)
      ? translateSurfaceText(value, locale)
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => localizeStructuredData(item, locale, key));
  }
  if (value && typeof value === "object") {
    const localized = Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        localizeStructuredData(child, locale, childKey)
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
  locale: SupportedLocale
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
