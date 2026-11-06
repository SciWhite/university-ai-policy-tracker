import { permanentRedirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCanonicalSlugForAlias } from "./entity-aliases";
import { withLocalePrefix, type SupportedLocale } from "./i18n";
import { getSiteBaseUrl } from "./site-url";

// Retired duplicate-identity slugs (data/entity-aliases.json) keep working:
// pages answer with a permanent redirect and JSON routes with a 308 to the
// same path under the canonical slug.

// Development seed placeholders (packages/shared/src/seed.ts) were reachable in
// production under these short slugs; they are not separate universities.
const SEED_PLACEHOLDER_SLUGS: Readonly<Record<string, string>> = {
  mit: "massachusetts-institute-of-technology",
  harvard: "harvard-university",
  stanford: "stanford-university",
  oxford: "university-of-oxford"
};

async function canonicalRedirectSlug(slug: string): Promise<string | undefined> {
  return (await getCanonicalSlugForAlias(slug)) ?? SEED_PLACEHOLDER_SLUGS[slug];
}

export async function redirectAliasSlugPage(
  slug: string,
  locale: SupportedLocale,
  buildPath: (canonicalSlug: string) => string
): Promise<void> {
  const canonicalSlug = await canonicalRedirectSlug(slug);
  if (canonicalSlug) {
    permanentRedirect(withLocalePrefix(buildPath(canonicalSlug), locale));
  }
}

export async function aliasSlugJsonRedirect(
  slug: string,
  buildPath: (canonicalSlug: string) => string
): Promise<NextResponse | undefined> {
  const canonicalSlug = await canonicalRedirectSlug(slug);

  return canonicalSlug
    ? NextResponse.redirect(new URL(buildPath(canonicalSlug), getSiteBaseUrl()), 308)
    : undefined;
}
