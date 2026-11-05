import { isPublishedV6Slug, publishedV6Enabled } from "./policy-v6-published-gate";

/**
 * One university template, two live data tiers (site consolidation plan §2.4):
 * - `full`: the school is in the active release's published V6 package, with
 *   its own reviewed presentation, student guide, art and reading locales.
 * - `base`: any other catalog school. The V6 template is filled from the
 *   school's public record and analysis profile; modules without reviewed
 *   presentation content (Do/Don't guide, school scene art, editorial summary)
 *   are hidden and the page carries the base-tier notice.
 * A school moves from base to full only through a content release whose V6
 * package passes the release validator; no program change is involved.
 */
export type PolicyV6Tier = "full" | "base";

export function policyV6Tier(slug: string): PolicyV6Tier {
  return isPublishedV6Slug(slug) ? "full" : "base";
}

/** Base-tier rendering follows the same production switch as published V6 pages. */
export function isPolicyV6BaseTier(slug: string): boolean {
  return publishedV6Enabled() && policyV6Tier(slug) === "base";
}

/** Source string for the base-tier notice; translations live in messages/public-ui. */
export const POLICY_V6_BASE_TIER_NOTICE =
  "This page is compiled from public policy records and has not yet been individually reviewed.";
