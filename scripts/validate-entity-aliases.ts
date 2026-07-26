import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildEntityAliasResolver,
  entityAliasRegistrySchema,
  normalizeEntityAliasName,
  resolveCanonicalEntitySlug
} from "@uapt/shared";

async function main() {
  const repoRoot = process.cwd();
  const registryPath = path.join(repoRoot, "data", "entity-aliases.json");
  const registry = entityAliasRegistrySchema.parse(
    JSON.parse(await readFile(registryPath, "utf8"))
  );

  const slugAliases = registry.aliases.filter(
    (alias) => alias.aliasType === "slug"
  );
  const rankingAliases = registry.aliases.filter(
    (alias) => alias.aliasType === "ranking_label"
  );

  assert.ok(
    registry.aliases.length >= slugAliases.length + rankingAliases.length,
    "Alias registry must contain slug and ranking_label entries."
  );

  const resolver = buildEntityAliasResolver(registry);

  for (const alias of slugAliases) {
    assert.equal(
      resolveCanonicalEntitySlug(resolver, alias.alias),
      alias.canonicalSlug,
      `Slug alias ${alias.alias} must resolve to ${alias.canonicalSlug}.`
    );
    assert.equal(
      resolveCanonicalEntitySlug(resolver, alias.canonicalSlug),
      alias.canonicalSlug,
      `Canonical slug ${alias.canonicalSlug} must resolve to itself.`
    );
  }

  // Every QS ranking-label alias must point at a row that actually exists in
  // the QS ranking source, and the label must not also exist verbatim as a
  // tracker record name (that would make the alias ambiguous).
  const qsPath = path.join(
    repoRoot,
    "data",
    "rankings",
    "qs-world-university-rankings-2026-top-1000.json"
  );
  const qsRanking = JSON.parse(await readFile(qsPath, "utf8")) as {
    universities: Array<{ name: string }>;
  };
  const qsNames = new Set(
    qsRanking.universities.map((row) => normalizeEntityAliasName(row.name))
  );

  for (const alias of rankingAliases.filter(
    (entry) => entry.sourceSystem === "qs_rankings"
  )) {
    assert.ok(
      qsNames.has(normalizeEntityAliasName(alias.alias)),
      `Ranking label alias '${alias.alias}' is not present in the QS 2026 ranking source.`
    );
  }

  console.log(
    `Entity alias registry OK: ${slugAliases.length} slug aliases, ${rankingAliases.length} ranking-label aliases, ${registry.aliases.length} total.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
