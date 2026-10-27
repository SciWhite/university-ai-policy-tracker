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
  "cardiff-university",
  "de-la-salle-university",
  "universiti-sains-malaysia",
  "university-of-limerick",
  "university-of-twente",
  "keele-university",
  "university-of-guelph",
  "university-of-johannesburg",
  "deakin-university",
  "university-of-exeter",
  "university-of-leeds",
  "university-of-southampton",
  "boston-university",
  "freie-universitaet-berlin",
  "purdue-university",
  "university-of-washington",
  "adelaide-university",
  "pennsylvania-state-university",
  "universidad-de-buenos-aires",
  "tokyo-institute-of-technology",
  "university-of-birmingham",
  "the-university-of-western-australia",
  "kth-royal-institute-of-technology",
  "university-of-glasgow",
  "universitat-heidelberg",
  "universite-paris-saclay",
  "lund-university",
  "sorbonne-university",
  "the-university-of-warwick",
  "trinity-college-dublin-the-university-of-dublin",
  "ucla",
  "delft-university-of-technology",
  "shanghai-jiao-tong-university",
  "zhejiang-university",
  "yonsei-university",
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
