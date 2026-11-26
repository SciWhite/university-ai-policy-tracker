import homepages from "./university-homepages.json";
import { safeHomepageUrl, type OfficialHomepage } from "./university-homepage-validate";

export type { OfficialHomepage } from "./university-homepage-validate";

/** Code registry of the first 81 V6 schools; the page falls back to it when the package has no entry. */
export function legacyUniversityHomepage(slug: string): string | undefined {
  return Object.hasOwn(homepages, slug) ? homepages[slug as keyof typeof homepages] : undefined;
}

export function universityHomepageHref(slug: string, homepage?: OfficialHomepage) {
  const href = homepage === undefined ? legacyUniversityHomepage(slug) : homepage?.url;
  return safeHomepageUrl(href) ? href : undefined;
}
