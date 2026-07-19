import {
  SUPPORTED_LOCALES,
  isLocalizablePath,
  isMultilingualPhaseTwoEnabled,
  stripLocalePrefix,
  withLocalePrefix
} from "../apps/web/lib/i18n";

const baseUrl = new URL(process.env.UAPT_SMOKE_BASE_URL ?? "http://127.0.0.1:3101");

async function main() {
  const phaseTwoEnabled = isMultilingualPhaseTwoEnabled();
  const sitemap = await readText(new URL("/sitemap.xml", baseUrl));
  const sitemapPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => new URL(decodeXml(match[1])).pathname
  );
  const englishPaths = sitemapPaths.filter(
    (pathname) => !stripLocalePrefix(pathname).hadLocalePrefix
  );
  const phaseOneDynamicSamples = [
    pick(englishPaths, /^\/universities\/[^/]+$/),
    pick(englishPaths, /^\/analysis\/[^/]+$/),
    pick(englishPaths, /^\/changes\/[^/]+$/),
    pick(englishPaths, /^\/changes\/[^/]+\/[^/]+$/)
  ];
  const phaseTwoDynamicSamples = phaseTwoEnabled
    ? [
        pick(englishPaths, /^\/themes\/[^/]+$/),
        pick(englishPaths, /^\/regions\/[^/]+$/),
        pick(englishPaths, /^\/rankings\/[^/]+$/),
        pick(englishPaths, /^\/reports\/monthly\/2026-06\/coverage\/[^/]+$/)
      ]
    : [];
  const phaseOneStaticPaths = [
    "/",
    "/search",
    "/universities",
    "/analysis",
    "/changes",
    "/datasets",
    "/methodology",
    "/citation",
    "/contribute"
  ];
  const phaseTwoStaticPaths = [
    "/university-ai-policy-database",
    "/tools",
    "/sources",
    "/coverage",
    "/coverage/qs-2026",
    "/source-health",
    "/reports",
    "/reports/monthly/2026-05",
    "/reports/monthly/2026-06",
    "/reports/outreach"
  ];
  const paths = [
    ...new Set([
      ...phaseOneStaticPaths,
      ...phaseOneDynamicSamples,
      ...(phaseTwoEnabled ? phaseTwoStaticPaths : []),
      ...phaseTwoDynamicSamples
    ])
  ];

  const failures: string[] = [];
  for (const locale of SUPPORTED_LOCALES) {
    for (const path of paths) {
      const localizedPath = withLocalePrefix(path, locale);
      const response = await fetch(new URL(localizedPath, baseUrl), {
        redirect: "manual"
      });
      if (response.status !== 200) {
        failures.push(`${localizedPath}: HTTP ${response.status}`);
        continue;
      }
      const html = await response.text();
      checkHtml(html, localizedPath, locale, failures);
    }
    if (phaseTwoEnabled) await checkRedirects(locale, failures);
  }

  if (!phaseTwoEnabled) {
    await checkPhaseTwoGate(sitemapPaths, phaseTwoStaticPaths, failures);
  }

  await checkCanonicalDataInvariant(paths, failures);

  if (failures.length) {
    throw new Error(`i18n HTTP smoke failed:\n${failures.join("\n")}`);
  }
  console.log(
    `i18n HTTP smoke passed: phase ${phaseTwoEnabled ? "two" : "one"}, ${SUPPORTED_LOCALES.length} locales x ${paths.length} representative routes`
  );
}

async function checkPhaseTwoGate(
  sitemapPaths: string[],
  phaseTwoPaths: string[],
  failures: string[]
) {
  for (const locale of SUPPORTED_LOCALES.filter((value) => value !== "en")) {
    for (const path of phaseTwoPaths) {
      const localizedPath = withLocalePrefix(path, locale);
      if (sitemapPaths.includes(localizedPath)) {
        failures.push(`${localizedPath}: phase-two route leaked into sitemap`);
      }
    }

    const gatedPath = withLocalePrefix("/tools", locale);
    const response = await fetch(new URL(gatedPath, baseUrl), {
      redirect: "manual"
    });
    if (response.status !== 404) {
      failures.push(`${gatedPath}: phase-two route should return 404, got ${response.status}`);
    }
  }
}

async function checkRedirects(
  locale: (typeof SUPPORTED_LOCALES)[number],
  failures: string[]
) {
  const redirects = [
    ["/reports/2026-05", "/reports/monthly/2026-05"],
    ["/reports/2026-06", "/reports/monthly/2026-06"],
    ["/coverage-dashboard", "/coverage"],
    ["/coverage-dashboard/qs-2026", "/coverage/qs-2026"]
  ] as const;
  for (const [source, destination] of redirects) {
    const sourcePath = withLocalePrefix(source, locale);
    const expectedPath = withLocalePrefix(destination, locale);
    const response = await fetch(new URL(sourcePath, baseUrl), { redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status !== 308 || !location || new URL(location, baseUrl).pathname !== expectedPath) {
      failures.push(`${sourcePath}: expected permanent locale-aware redirect to ${expectedPath}`);
    }
  }
}

function checkHtml(
  html: string,
  pathname: string,
  locale: (typeof SUPPORTED_LOCALES)[number],
  failures: string[]
) {
  if (!new RegExp(`<html[^>]+lang=["']${locale}["']`).test(html)) {
    failures.push(`${pathname}: missing server-rendered html lang=${locale}`);
  }
  if (!/<title>[^<]+<\/title>/.test(html)) {
    failures.push(`${pathname}: missing title`);
  }
  const canonical = getLinkHref(html, "canonical");
  if (!canonical || new URL(canonical, baseUrl).pathname !== pathname) {
    failures.push(`${pathname}: canonical ${canonical ?? "missing"} has the wrong path`);
  }
  for (const alternateLocale of [...SUPPORTED_LOCALES, "x-default"] as const) {
    if (!hasHrefLang(html, alternateLocale)) {
      failures.push(`${pathname}: missing hreflang ${alternateLocale}`);
    }
  }
  const switcher = html.match(/class=["']language-switcher["'][\s\S]*?class=["']visually-hidden["']/)?.[0];
  if (!switcher || (switcher.match(/<a\b/g) ?? []).length !== 4) {
    failures.push(`${pathname}: language switcher must expose exactly four locales`);
  }
  if (locale !== "en") {
    for (const href of getPageAnchorHrefs(html)) {
      if (!href.startsWith("/")) continue;
      const targetPath = new URL(href, baseUrl).pathname;
      if (!isLocalizablePath(targetPath)) continue;
      const parsed = stripLocalePrefix(targetPath);
      if (!parsed.hadLocalePrefix || parsed.locale !== locale) {
        failures.push(`${pathname}: locale-dropping link ${href}`);
        break;
      }
    }
  }
}

async function checkCanonicalDataInvariant(paths: string[], failures: string[]) {
  const universityPath = paths.find((path) => /^\/universities\/[^/]+$/.test(path));
  if (!universityPath) return;
  const pages = await Promise.all(
    SUPPORTED_LOCALES.map(async (locale) => {
      const html = await readText(new URL(withLocalePrefix(universityPath, locale), baseUrl));
      const publicJsonUrl = getHrefs(html).find((href) =>
        href.includes("/api/public/v1/universities/")
      );
      return { html, locale, publicJsonUrl };
    })
  );
  const canonicalJsonUrl = pages[0].publicJsonUrl;
  for (const page of pages) {
    if (page.publicJsonUrl !== canonicalJsonUrl) {
      failures.push(`${page.locale}${universityPath}: public JSON URL changed`);
    }
  }
  if (!canonicalJsonUrl) return;
  const publicJsonPath = new URL(canonicalJsonUrl, baseUrl).pathname;
  const record = JSON.parse(await readText(new URL(publicJsonPath, baseUrl))) as {
    data?: { entity?: { name?: string }; claims?: Array<{ evidence?: Array<{ evidenceSnippet?: string }> }> };
  };
  const canonicalName = record.data?.entity?.name;
  const evidenceSnippet = record.data?.claims?.[0]?.evidence?.[0]?.evidenceSnippet;
  for (const page of pages) {
    if (canonicalName && !decodeXml(page.html).includes(canonicalName)) {
      failures.push(`${page.locale}${universityPath}: canonical university name missing`);
    }
    if (evidenceSnippet && !decodeXml(page.html).includes(evidenceSnippet)) {
      failures.push(`${page.locale}${universityPath}: original evidence snippet changed or missing`);
    }
  }
}

function pick(paths: string[], pattern: RegExp) {
  const value = paths.find((path) => pattern.test(path));
  if (!value) throw new Error(`Sitemap has no route matching ${pattern}`);
  return value;
}

function getLinkHref(html: string, rel: string) {
  for (const tag of html.match(/<link\b[^>]*>/g) ?? []) {
    if (!new RegExp(`\\brel=["']${rel}["']`).test(tag)) continue;
    return tag.match(/\bhref=["']([^"']+)["']/)?.[1];
  }
  return undefined;
}

function hasHrefLang(html: string, locale: string) {
  return (html.match(/<link\b[^>]*>/g) ?? []).some(
    (tag) =>
      /\brel=["']alternate["']/.test(tag) &&
      new RegExp(`\\bhreflang=["']${locale}["']`, "i").test(tag)
  );
}

function getPageAnchorHrefs(html: string) {
  return (html.match(/<a\b[^>]*>/g) ?? [])
    .filter((tag) => !/\bhreflang=/i.test(tag))
    .map((tag) => tag.match(/\bhref=["']([^"']+)["']/)?.[1])
    .filter((href): href is string => Boolean(href))
    .map(decodeXml);
}

function getHrefs(html: string) {
  return [...html.matchAll(/\bhref=["']([^"']+)["']/g)].map((match) =>
    decodeXml(match[1])
  );
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

async function readText(url: URL) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

void main();
