import derived from "./university-slug-aliases.json";

// Client-safe identity resolution for retired duplicate university slugs.
// The JSON is derived from data/entity-aliases.json and checked by
// scripts/validate-entity-aliases.ts.
const slugAliases: Record<string, string> = derived.aliases;
const aliasesByCanonical = new Map<string, string[]>();
for (const [alias, canonical] of Object.entries(slugAliases)) {
  aliasesByCanonical.set(canonical, [...(aliasesByCanonical.get(canonical) ?? []), alias]);
}

export function canonicalUniversitySlug(slug: string): string {
  return slugAliases[slug] ?? slug;
}

/** Canonical slugs, deduplicated in first-seen order. */
export function canonicalUniversitySlugs(slugs: string[]): string[] {
  return [...new Set(slugs.map(canonicalUniversitySlug))];
}

/** The canonical slug followed by retired alias slugs of the same identity. */
export function universityIdentitySlugs(slug: string): string[] {
  const canonical = canonicalUniversitySlug(slug);
  return [canonical, ...(aliasesByCanonical.get(canonical) ?? [])];
}
