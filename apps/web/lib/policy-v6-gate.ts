import {publishedV6Slugs,publishedV6Enabled} from "./policy-v6-published-gate";
/** Six reference schools; historical cohort stays stable for acceptance and art pins. */
export const policyV6Slugs = [
  "harvard-university",
  "imperial-college-london",
  "massachusetts-institute-of-technology",
  "stanford-university",
  "university-of-oxford",
  "university-of-cambridge",
] as const;
/** Separate opt-in local bundle pilots, with their own evidence and acceptance. */
export const policyV6BundlePreviewSlugs = [
  "institut-polytechnique-de-paris",
  "northwestern-university",
  "ucl",
  "california-institute-of-technology",
  "eth-zurich",
  "national-university-of-singapore",
  "anu",
  "edinburgh",
  "cuhk",
] as const;
export const isPolicyV6Preview = (
  slug: string,
  layout: unknown,
  environment = process.env.NODE_ENV,
) =>
  (publishedV6Enabled() && publishedV6Slugs.includes(slug)) ||
  environment === "development" &&
  [...policyV6Slugs, ...policyV6BundlePreviewSlugs].some((value) => value === slug) &&
  (layout === "v6" ||
    (slug === "harvard-university" && layout === "harvard-ui-lab"));
