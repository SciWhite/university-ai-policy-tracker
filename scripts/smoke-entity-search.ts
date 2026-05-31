import {
  getEntityResolutionIndexResponse,
  getSearchIndexResponse,
  getSearchResponse,
  searchEntities
} from "../apps/web/lib/entity-search";

async function main(): Promise<void> {
  const [
    entityIndex,
    searchIndex,
    mitResults,
    anuResults,
    disclosureResponse,
    pekingZhResults,
    montrealFrResults,
    warsawPlResults
  ] =
    await Promise.all([
      getEntityResolutionIndexResponse(),
      getSearchIndexResponse(),
      searchEntities("MIT"),
      searchEntities("ANU"),
      getSearchResponse("disclosure", { limit: 10 }),
      searchEntities("北京大学"),
      searchEntities("Université de Montréal"),
      searchEntities("Uniwersytet Warszawski")
    ]);

  assert(entityIndex.data.count > 0, "entity resolution index is empty");
  assert(
    entityIndex.data.aliasCount >= entityIndex.data.count,
    "entity resolution index should have at least one alias per entity"
  );
  assert(searchIndex.data.count === entityIndex.data.count, "search index count mismatch");
  assert(
    mitResults[0]?.entitySlug === "massachusetts-institute-of-technology",
    "MIT should resolve to Massachusetts Institute of Technology"
  );
  assert(anuResults[0]?.entitySlug === "anu", "ANU should resolve to ANU");
  assert(
    disclosureResponse.data.results.length > 0,
    "policy-theme search should return public records"
  );
  assert(
    pekingZhResults[0]?.entitySlug === "peking-university",
    "Chinese localized search should resolve 北京大学"
  );
  assert(
    montrealFrResults[0]?.entitySlug === "universite-de-montreal",
    "French localized search should resolve Université de Montréal"
  );
  assert(
    warsawPlResults[0]?.entitySlug === "university-of-warsaw",
    "Polish localized search should resolve Uniwersytet Warszawski"
  );
  assert(
    !JSON.stringify(searchIndex).includes("staging/uapt-runs"),
    "safe search index must not expose staging paths"
  );
  assert(
    !JSON.stringify(searchIndex).includes("evidenceSnippet"),
    "safe search index must not expose raw evidence fields"
  );

  console.log(
    `Entity/search smoke passed: ${entityIndex.data.count} entities, ` +
      `${entityIndex.data.aliasCount} aliases, MIT -> ${mitResults[0].entitySlug}, ` +
      `ANU -> ${anuResults[0].entitySlug}.`
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main();
