import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  HIDDEN_AUTO_LOCALES,
  VISIBLE_LOCALES,
  localizeHref
} from "../apps/web/lib/i18n";
import { getLocalizedInstitutionName } from "../apps/web/lib/institution-localization";

const locales = ["zh", "fr", "pl", "es", "nl", "ms"] as const;
const protectedTerms = [
  "University AI Policy Tracker",
  "GenAI",
  "ChatGPT",
  "Copilot",
  "Academic AI",
  "JSON",
  "API",
  "MCP",
  "QS 2026",
  "THE 2026",
  "ARWU 2025",
  "U.S. News 2025-2026",
  "CWTS Leiden 2025"
] as const;
const publicRouteFiles = [
  "page.tsx",
  "search/page.tsx",
  "universities/page.tsx",
  "universities/[slug]/page.tsx",
  "university-ai-policy-database/page.tsx",
  "tools/page.tsx",
  "sources/page.tsx",
  "themes/[slug]/page.tsx",
  "regions/[slug]/page.tsx",
  "rankings/[slug]/page.tsx",
  "analysis/page.tsx",
  "analysis/[slug]/page.tsx",
  "changes/page.tsx",
  "changes/[releaseId]/page.tsx",
  "changes/[releaseId]/[slug]/page.tsx",
  "coverage/page.tsx",
  "coverage/qs-2026/page.tsx",
  "source-health/page.tsx",
  "reports/page.tsx",
  "reports/monthly/2026-05/page.tsx",
  "reports/monthly/2026-06/page.tsx",
  "reports/monthly/2026-05/coverage/[region]/page.tsx",
  "reports/monthly/2026-06/coverage/[region]/page.tsx",
  "reports/outreach/page.tsx",
  "datasets/page.tsx",
  "methodology/page.tsx",
  "citation/page.tsx",
  "contribute/page.tsx"
] as const;

async function main() {
  const pageSource = await readJson("apps/web/messages/pages/en.json");
  const surfaceSource = (await readJson("apps/web/messages/surfaces/en.json")) as string[];
  const shellSource = await readJson("apps/web/messages/en.json");

  for (const locale of locales) {
    const pageTranslation = await readJson(`apps/web/messages/pages/${locale}.json`);
    const surfaceTranslation = (await readJson(
      `apps/web/messages/surfaces/${locale}.json`
    )) as string[];
    const shellTranslation = await readJson(`apps/web/messages/${locale}.json`);

    assertTree(pageSource, pageTranslation, locale, "pages");
    assertTree(shellSource, shellTranslation, locale, "shell");
    if (!Array.isArray(surfaceTranslation) || surfaceTranslation.length !== surfaceSource.length) {
      throw new Error(`${locale}: surface translation length mismatch`);
    }
    surfaceSource.forEach((value, index) =>
      assertString(value, surfaceTranslation[index], locale, `surfaces[${index}]`)
    );
  }

  await Promise.all(
    publicRouteFiles.map(async (file) => {
      const target = path.resolve("apps/web/app/[locale]", file);
      const info = await stat(target).catch(() => null);
      if (!info?.isFile()) throw new Error(`Missing localized route: ${file}`);
    })
  );

  assert(
    JSON.stringify(VISIBLE_LOCALES) === JSON.stringify(["en", "zh", "fr", "pl"]),
    "Language switcher locale contract changed"
  );
  assert(
    JSON.stringify(HIDDEN_AUTO_LOCALES) === JSON.stringify(["es", "nl", "ms"]),
    "Hidden auto-locale contract changed"
  );
  assert(localizeHref("/tools", "es") === "/es/tools", "Localized public link failed");
  assert(
    localizeHref("/search?q=harvard.edu", "zh") === "/zh/search?q=harvard.edu",
    "Localized public link with query failed"
  );
  assert(localizeHref("/api-reference", "fr") === "/api-reference", "English-only professional route gained a locale prefix");
  assert(localizeHref("/api/public/v1/index.json", "zh") === "/api/public/v1/index.json", "Public API URL changed during localization");
  assert(
    getLocalizedInstitutionName("example", "Canonical University", "zh") ===
      "Canonical University",
    "Canonical university name changed during localization"
  );

  console.log(
    `i18n validation passed: 7 locales, ${publicRouteFiles.length} public route families, ${surfaceSource.length} extended-surface strings`
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertTree(
  source: unknown,
  translated: unknown,
  locale: string,
  currentPath: string
) {
  if (Array.isArray(source)) {
    if (!Array.isArray(translated) || translated.length !== source.length) {
      throw new Error(`${locale}:${currentPath} array mismatch`);
    }
    source.forEach((value, index) =>
      assertTree(value, translated[index], locale, `${currentPath}[${index}]`)
    );
    return;
  }
  if (source && typeof source === "object") {
    if (!translated || typeof translated !== "object" || Array.isArray(translated)) {
      throw new Error(`${locale}:${currentPath} object mismatch`);
    }
    const before = Object.keys(source as Record<string, unknown>).sort();
    const after = Object.keys(translated as Record<string, unknown>).sort();
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(`${locale}:${currentPath} key mismatch`);
    }
    for (const key of before) {
      assertTree(
        (source as Record<string, unknown>)[key],
        (translated as Record<string, unknown>)[key],
        locale,
        `${currentPath}.${key}`
      );
    }
    return;
  }
  if (typeof source !== typeof translated) {
    throw new Error(`${locale}:${currentPath} type mismatch`);
  }
  if (typeof source === "string") {
    assertString(source, translated as string, locale, currentPath);
  }
}

function assertString(source: string, translated: string, locale: string, currentPath: string) {
  if (!translated.trim()) throw new Error(`${locale}:${currentPath} is empty`);
  const sourcePlaceholders = source.match(/\{[^}]+\}/g) ?? [];
  const translatedPlaceholders = translated.match(/\{[^}]+\}/g) ?? [];
  if (JSON.stringify(sourcePlaceholders.sort()) !== JSON.stringify(translatedPlaceholders.sort())) {
    throw new Error(`${locale}:${currentPath} placeholder mismatch`);
  }

  const protectedValue =
    currentPath.endsWith(".href") ||
    source.startsWith("/") ||
    source.startsWith("http") ||
    /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(source);
  if (protectedValue && source !== translated) {
    throw new Error(`${locale}:${currentPath} changed protected value`);
  }
  for (const term of protectedTerms) {
    if (countOccurrences(source, term) !== countOccurrences(translated, term)) {
      throw new Error(`${locale}:${currentPath} changed protected term: ${term}`);
    }
  }

  const comparisonSource = protectedTerms.reduce(
    (value, term) => value.replaceAll(term, ""),
    source
  );
  const comparisonTranslation = protectedTerms.reduce(
    (value, term) => value.replaceAll(term, ""),
    translated
  );
  const ordinaryEnglishSentence =
    comparisonSource === comparisonTranslation &&
    comparisonSource.length >= 24 &&
    comparisonSource.split(/\s+/).length >= 5 &&
    looksLikeEnglish(comparisonSource);
  if (ordinaryEnglishSentence) {
    throw new Error(`${locale}:${currentPath} still contains English fallback: ${source}`);
  }
}

function looksLikeEnglish(value: string) {
  const commonWords =
    value.toLowerCase().match(
      /\b(?:the|and|or|for|from|with|without|should|how|what|not|public|university|record|records|source|sources|policy|when|which|under|official|page|data|dataset|release|review|state|date|cite|citation|visible|matching|most|last|include|includes|currently|remains|main|does)\b/g
    ) ?? [];
  return commonWords.length >= 2;
}

function countOccurrences(value: string, term: string) {
  return value.split(term).length - 1;
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.resolve(file), "utf8"));
}

void main();
