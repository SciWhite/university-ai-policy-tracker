import { permanentRedirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCanonicalSlugForAlias } from "./entity-aliases";
import { withLocalePrefix, type SupportedLocale } from "./i18n";
import { getSiteBaseUrl } from "./site-url";

// Retired duplicate-identity slugs (data/entity-aliases.json) keep working:
// pages answer with a permanent redirect and JSON routes with a 308 to the
// same path under the canonical slug.

export async function redirectAliasSlugPage(
  slug: string,
  locale: SupportedLocale,
  buildPath: (canonicalSlug: string) => string
): Promise<void> {
  const canonicalSlug = await getCanonicalSlugForAlias(slug);
  if (canonicalSlug) {
    permanentRedirect(withLocalePrefix(buildPath(canonicalSlug), locale));
  }
}

export async function aliasSlugJsonRedirect(
  slug: string,
  buildPath: (canonicalSlug: string) => string
): Promise<NextResponse | undefined> {
  const canonicalSlug = await getCanonicalSlugForAlias(slug);

  return canonicalSlug
    ? NextResponse.redirect(new URL(buildPath(canonicalSlug), getSiteBaseUrl()), 308)
    : undefined;
}
