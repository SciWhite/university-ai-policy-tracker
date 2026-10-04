import type { PolicyScenePilot, PolicySceneStoryCard } from "@/lib/policy-scene-pilot";

/**
 * V4 university pages selected for production; additions ship with the combined release.
 * On normal URLs in production and development, these universities receive the V4 layout by default.
 */
export const publishedV4UniversitySlugs = [
  "stanford-university",
  "harvard-university",
  "national-university-of-singapore",
  "utrecht-university",
  "imperial-college-london",
  "unsw-sydney", "university-of-sydney", "university-of-oxford",
  "adelaide-university", "de-la-salle-university", "university-of-queensland",
  "university-of-auckland", "university-of-bristol", "manchester", "edinburgh",
  "ubc", "university-of-johannesburg", "anu",
  "deakin-university", "university-of-surrey", "durham-university",
  "university-of-cambridge", "massachusetts-institute-of-technology",
  "university-of-exeter", "keele-university", "university-of-glasgow",
  "tilburg-university", "university-of-aberdeen", "flinders-university",
  "kingston-university-london", "university-of-victoria-uvic",
  "chalmers-university-of-technology", "cardiff-university",
  "aalto-university", "cornell-university", "university-of-melbourne"
] as const;

export type PublishedV4UniversitySlug = (typeof publishedV4UniversitySlugs)[number];

export function isPublishedV4University(slug: string): boolean {
  return publishedV4UniversitySlugs.some(candidate => candidate === slug);
}

/** Legacy preview allowlist alias pointing to the published cohort. */
export const policyReferencePreviewSlugs = publishedV4UniversitySlugs;

export function isPolicyReferencePreview(slug: string, layout: unknown, environment = process.env.NODE_ENV) {
  return environment === "development" && policyReferencePreviewSlugs.some(candidate => candidate === slug) && layout === "reference-v4";
}

/** Existing art stays beside its reviewed topic; original official evidence URLs remain intact. */
export function preparePolicyReferenceScene(scene: PolicyScenePilot): PolicyScenePilot {
  return {
    ...scene,
    showGallerySummaries: true,
    storyCards: scene.storyCards?.map(card => {
      const linkedDimension = card.evidenceHref.match(/^#snapshot-(coursework|exams|disclosure|privacy_data|approved_tools|research_publication)$/)?.[1] as PolicySceneStoryCard["placement"];
      const placement = card.placement ?? linkedDimension ?? (card.artworkSrc.endsWith("nus-mechanism-detector.jpg") ? "coursework" : undefined);
      return { ...card, placement, evidenceHref: placement && card.evidenceHref.startsWith("#snapshot-") ? `#snapshot-evidence-${placement}` : card.evidenceHref };
    })
  };
}

import { isHomeV4Preview } from "@/lib/home-v4-preview";

function isHomeTarget(pathname: string): boolean {
  const clean = pathname.replace(/^\/(?:en|zh|fr|pl|es|nl|ms)(?=\/|$)/, "");
  return clean === "" || clean === "/";
}

/** Keep local V4 comparison when a reader clicks the switcher's initial Suspense fallback. */
export function preservePolicyReferenceSearch(href: string, currentSearch: string, environment = process.env.NODE_ENV): string {
  const target = new URL(href, "https://preview.invalid");
  const layout = new URLSearchParams(currentSearch).get("layout");
  if (isHomeTarget(target.pathname) && isHomeV4Preview(layout, environment)) {
    target.searchParams.set("layout", "home-v4");
    return `${target.pathname}${target.search}${target.hash}`;
  }
  const slug = target.pathname.split("/").at(-1) ?? "";
  if (!isPolicyReferencePreview(slug, layout, environment)) return href;
  target.searchParams.set("layout", "reference-v4");
  return `${target.pathname}${target.search}${target.hash}`;
}
