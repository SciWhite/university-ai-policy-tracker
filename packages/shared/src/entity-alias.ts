import { z } from "zod";
import { canonicalEntityTypeSchema, claimReviewStateSchema } from "./claims";

// Entity aliases implement the EntityAlias contract in docs/data-contract.md:
// retrieval and identity hints that connect alternate slugs, names, acronyms,
// ranking labels, source domains, and local-language names to one canonical
// entity. Aliases improve recall and identity resolution only; they never
// create policy facts and cannot publish claims.

export const ENTITY_ALIAS_REGISTRY_SCHEMA_VERSION = "uapt-entity-alias-v1";

export const entityAliasTypeSchema = z.enum([
  "slug",
  "name",
  "acronym",
  "ranking_label",
  "source_domain",
  "local_name"
]);

export const entityAliasSourceSystemSchema = z.enum([
  "uapt_staging",
  "qs_rankings",
  "the_rankings",
  "arwu_rankings",
  "usnews_rankings",
  "cwts_rankings",
  "manual_curation"
]);

export const entityAliasSchema = z.object({
  alias: z.string().min(1),
  aliasType: entityAliasTypeSchema,
  entityType: canonicalEntityTypeSchema,
  canonicalSlug: z.string().min(1),
  sourceSystem: entityAliasSourceSystemSchema,
  matchConfidence: z.number().min(0).max(1),
  reviewState: claimReviewStateSchema,
  matchReason: z.string().min(1),
  lastReviewedAt: z.string().datetime()
});

export const entityAliasRegistrySchema = z
  .object({
    schemaVersion: z.literal(ENTITY_ALIAS_REGISTRY_SCHEMA_VERSION),
    generatedAt: z.string().datetime(),
    notes: z.string().optional(),
    aliases: z.array(entityAliasSchema)
  })
  .superRefine((registry, ctx) => {
    const canonicalSlugs = new Set(
      registry.aliases.map((alias) => alias.canonicalSlug)
    );
    const seen = new Set<string>();

    registry.aliases.forEach((alias, index) => {
      const key = `${alias.entityType}:${alias.aliasType}:${alias.alias}`;

      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aliases", index, "alias"],
          message: `Duplicate alias entry: ${key}`
        });
      }
      seen.add(key);

      if (alias.aliasType === "slug" && alias.alias === alias.canonicalSlug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aliases", index, "alias"],
          message: `Slug alias must differ from its canonical slug: ${alias.alias}`
        });
      }

      if (
        alias.aliasType === "slug" &&
        canonicalSlugs.has(alias.alias)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aliases", index, "alias"],
          message: `Alias chain detected: ${alias.alias} is also used as a canonical slug`
        });
      }
    });
  });

export type EntityAliasType = z.infer<typeof entityAliasTypeSchema>;
export type EntityAliasSourceSystem = z.infer<
  typeof entityAliasSourceSystemSchema
>;
export type EntityAlias = z.infer<typeof entityAliasSchema>;
export type EntityAliasRegistry = z.infer<typeof entityAliasRegistrySchema>;

export interface EntityAliasResolver {
  /** slug alias -> canonical slug (identity resolution) */
  slugAliases: ReadonlyMap<string, string>;
  /** normalized name/label alias -> canonical slug (join/recall resolution) */
  nameAliases: ReadonlyMap<string, string>;
}

export function normalizeEntityAliasName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildEntityAliasResolver(
  registry: EntityAliasRegistry
): EntityAliasResolver {
  const slugAliases = new Map<string, string>();
  const nameAliases = new Map<string, string>();

  for (const alias of registry.aliases) {
    if (alias.aliasType === "slug") {
      slugAliases.set(alias.alias, alias.canonicalSlug);
    } else {
      nameAliases.set(
        normalizeEntityAliasName(alias.alias),
        alias.canonicalSlug
      );
    }
  }

  return { slugAliases, nameAliases };
}

export function resolveCanonicalEntitySlug(
  resolver: EntityAliasResolver,
  slug: string
): string {
  return resolver.slugAliases.get(slug) ?? slug;
}
