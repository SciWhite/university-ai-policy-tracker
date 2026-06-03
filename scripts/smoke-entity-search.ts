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
    beijingResults,
    ligongResults,
    pekingZhResults,
    pekingShortZhResults,
    tsinghuaShortZhResults,
    beijingTechShortZhResults,
    montrealFrResults,
    montrealFoldedFrResults,
    montrealCityFrResults,
    warsawPlResults,
    warsawTechPlResults,
    jagiellonianPlResults,
    jagiellonianFoldedPlResults
  ] =
    await Promise.all([
      getEntityResolutionIndexResponse(),
      getSearchIndexResponse(),
      searchEntities("MIT"),
      searchEntities("ANU"),
      getSearchResponse("disclosure", { limit: 10 }),
      searchEntities("北京", { limit: 10 }),
      searchEntities("理工", { limit: 10 }),
      searchEntities("北京大学"),
      searchEntities("北大"),
      searchEntities("清华"),
      searchEntities("北理工"),
      searchEntities("Université de Montréal"),
      searchEntities("Universite de Montreal"),
      searchEntities("Montreal"),
      searchEntities("Uniwersytet Warszawski"),
      searchEntities("Politechnika Warszawska"),
      searchEntities("Jagielloński"),
      searchEntities("Jagiellonski")
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
    beijingResults.length > 1 &&
      beijingResults.some((result) => result.entitySlug === "peking-university") &&
      beijingResults.some(
        (result) => result.entitySlug === "beijing-institute-of-technology"
      ),
    "Chinese short query 北京 should return multiple Beijing universities"
  );
  assert(
    ligongResults.some(
      (result) => result.entitySlug === "beijing-institute-of-technology"
    ) &&
      ligongResults.some(
        (result) => result.entitySlug === "dalian-university-of-technology"
      ) &&
      ligongResults.some(
        (result) => result.entitySlug === "south-china-university-of-technology"
      ),
    "Chinese short query 理工 should resolve multiple technology universities"
  );
  assert(
    pekingZhResults[0]?.entitySlug === "peking-university",
    "Chinese localized search should resolve 北京大学"
  );
  assert(
    pekingShortZhResults[0]?.entitySlug === "peking-university",
    "Chinese localized search should resolve 北大"
  );
  assert(
    tsinghuaShortZhResults[0]?.entitySlug === "tsinghua-university",
    "Chinese localized search should resolve 清华"
  );
  assert(
    beijingTechShortZhResults[0]?.entitySlug === "beijing-institute-of-technology",
    "Chinese localized search should resolve 北理工"
  );
  assert(
    montrealFrResults[0]?.entitySlug === "universite-de-montreal",
    "French localized search should resolve Université de Montréal"
  );
  assert(
    montrealFoldedFrResults[0]?.entitySlug === "universite-de-montreal",
    "French folded search should resolve Universite de Montreal"
  );
  assert(
    montrealCityFrResults.some(
      (result) => result.entitySlug === "universite-de-montreal"
    ),
    "French city search should include Université de Montréal"
  );
  assert(
    warsawPlResults[0]?.entitySlug === "university-of-warsaw",
    "Polish localized search should resolve Uniwersytet Warszawski"
  );
  assert(
    warsawTechPlResults[0]?.entitySlug === "warsaw-university-of-technology",
    "Polish localized search should resolve Politechnika Warszawska"
  );
  assert(
    jagiellonianPlResults[0]?.entitySlug === "jagiellonian-university",
    "Polish localized search should resolve Jagielloński"
  );
  assert(
    jagiellonianFoldedPlResults[0]?.entitySlug === "jagiellonian-university",
    "Polish folded search should resolve Jagiellonski"
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
