import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildEntityAliasResolver,
  entityAliasRegistrySchema,
  normalizeEntityAliasName,
  type EntityAliasRegistry,
  type EntityAliasResolver
} from "@uapt/shared";
import { findRepoRoot } from "./repo-root";

// Loads data/entity-aliases.json (docs/data-contract.md EntityAlias records).
// Slug aliases drive identity resolution: staged artifacts filed under an
// alias slug merge into the canonical entity, and alias URLs permanently
// redirect. Ranking-label aliases make ranking joins exact. A missing or
// invalid registry degrades to no aliases rather than failing the build.

const EMPTY_RESOLVER: EntityAliasResolver = {
  slugAliases: new Map(),
  nameAliases: new Map()
};

let registryPromise: Promise<EntityAliasRegistry | undefined> | undefined;

async function readEntityAliasRegistry(): Promise<
  EntityAliasRegistry | undefined
> {
  try {
    const repoRoot = await findRepoRoot();
    const raw = await readFile(
      path.join(repoRoot, "data", "entity-aliases.json"),
      "utf8"
    );

    return entityAliasRegistrySchema.parse(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export async function getEntityAliasRegistry(): Promise<
  EntityAliasRegistry | undefined
> {
  registryPromise ??= readEntityAliasRegistry();

  return registryPromise;
}

export async function getEntityAliasResolver(): Promise<EntityAliasResolver> {
  const registry = await getEntityAliasRegistry();

  return registry ? buildEntityAliasResolver(registry) : EMPTY_RESOLVER;
}

/** Canonical slug when the given slug is a registered alias, else undefined. */
export async function getCanonicalSlugForAlias(
  slug: string
): Promise<string | undefined> {
  const resolver = await getEntityAliasResolver();

  return resolver.slugAliases.get(slug);
}

/** All registered alias slugs (used to emit redirect params/routes). */
export async function getAliasSlugs(): Promise<string[]> {
  const resolver = await getEntityAliasResolver();

  return [...resolver.slugAliases.keys()];
}

/** Canonical slug for a ranking label / name variant, else undefined. */
export async function getCanonicalSlugForName(
  name: string
): Promise<string | undefined> {
  const resolver = await getEntityAliasResolver();

  return resolver.nameAliases.get(normalizeEntityAliasName(name));
}
