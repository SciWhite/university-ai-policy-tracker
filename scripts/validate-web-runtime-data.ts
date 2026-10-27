import {createHash} from "node:crypto";
import {readFile, realpath} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argument = process.argv.indexOf("--app-root");
const appRoot = argument >= 0 ? path.resolve(process.argv[argument + 1]) : path.join(sourceRoot, "apps/web");
// A filesystem package check must never fall back to a live API.
process.env.UAPT_DISABLE_INTERNAL_FETCH = "1";
delete process.env.CATALOG_API_BASE_URL;
process.env.UAPT_V6_PUBLISHED_PAGES = "1";
process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES = "1";
process.env.NEXT_PUBLIC_SITE_URL = "https://eduaipolicy.org";

async function main() {
  const originalCwd = process.cwd(), originalFetch = globalThis.fetch;
  let fetchAttempts = 0;
  globalThis.fetch = async () => {fetchAttempts++; throw Error("Unexpected network in runtime package validation");};
  try {
    const data = await import("../apps/web/lib/staged-public-data");
    const {findRepoRoot} = await import("../apps/web/lib/repo-root");
    const {publicHistoryBasisV2} = await import("../apps/web/lib/public-history-basis");
    const digest = (value:unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    process.chdir(sourceRoot);
    data.resetStagedPublicDatasetCache();
    const expected = digest((await data.getStagedPublicDataset()).publicSummaries);
    process.chdir(appRoot);
    const runtimeRoot = await findRepoRoot();
    if (await realpath(runtimeRoot) !== await realpath(path.join(appRoot, ".runtime-data"))) throw Error("Runtime data check fell back to source checkout");
    data.resetStagedPublicDatasetCache();
    const summaries = (await data.getStagedPublicDataset()).publicSummaries;
    if (digest(summaries) !== expected) throw Error("Runtime canonical records/evidence differ from frozen source");
    const pointer = JSON.parse(await readFile(path.join(runtimeRoot, "data/public-change-history/current.json"), "utf8"));
    const manifest = JSON.parse(await readFile(path.join(runtimeRoot, "data/public-change-history", pointer.path), "utf8"));
    if (await publicHistoryBasisV2(runtimeRoot) !== manifest.basisSha256) throw Error("Runtime history identity inputs are incomplete or changed");
    const {historyManifest, ChangeEventStore} = await import("../apps/web/lib/public-change-history");
    const selected = await historyManifest();
    const store = new ChangeEventStore(selected.root, pointer);
    const analysis = await import("../apps/web/app/api/public/v1/analysis/universities/[slug]/route");
    const events = await import("../apps/web/lib/change-events-api");
    const controls = [];
    for (const slug of ["massachusetts-institute-of-technology", "imperial-college-london", "ucl", "university-of-waterloo"]) {
      const response = await analysis.GET(new Request(`https://eduaipolicy.org/api/public/v1/analysis/universities/${slug}.json`), {params: Promise.resolve({slug: slug + ".json"})});
      const value = await response.json();
      if (response.status !== 200 || value.data?.entitySlug !== slug) throw Error(`Packaged analysis API failed: ${slug}`);
      controls.push(slug);
    }
    const history = await events.changeEventsResponse(new Request("https://eduaipolicy.org/api/public/v1/changes/events/test/ucl.json"), {revision: store.manifest.revision!, slug: "ucl"});
    if (history.status !== 200 || (await history.json()).slug !== "ucl") throw Error("Packaged public history API failed");
    const feedStarted = performance.now();
    const atom = await import("../apps/web/app/feeds/atom.xml/route");
    const atomResponse = await atom.GET();
    const atomXml = await atomResponse.text();
    const {getChangeIndexData} = await import("../apps/web/lib/change-records");
    const {xmlEscape} = await import("../apps/web/lib/feed");
    const feedRecords = (await getChangeIndexData()).data.records.slice(0, 30);
    if (atomResponse.status !== 200 || !atomXml.includes('<feed xmlns="http://www.w3.org/2005/Atom">')) throw Error("Packaged Atom feed failed");
    for (const record of feedRecords) {
      const id = xmlEscape(new URL(record.changeUrl, "https://eduaipolicy.org").href);
      const summary = xmlEscape(`${record.summary} Review state: ${record.reviewState}. Claims: ${record.claimCount}.`);
      if (!atomXml.includes(`<id>${id}</id>`) || !atomXml.includes(`<summary>${summary}</summary>`)) throw Error(`Packaged Atom record differs: ${record.slug}`);
    }
    const atomMilliseconds = Math.round(performance.now() - feedStarted);
    if (atomMilliseconds > 120000) throw Error("Packaged Atom feed exceeds the prebuild 120s limit");
    const {getDiscoveryPage} = await import("../apps/web/lib/rankings-view-data");
    const {rankingEditions} = await import("../apps/web/lib/ranking-editions");
    const discoveryEditions = [];
    for (const edition of rankingEditions) {
      const expectedDoc = JSON.parse(await readFile(path.join(sourceRoot,"data/ranking-browser",edition.slug+".json"),"utf8"));
      const observed = await getDiscoveryPage("rankings", {}, "en", edition.slug);
      if (observed.rankingCount !== expectedDoc.rows.length || observed.query.size !== 25 || observed.rows.length !== 25)
        throw Error(`Packaged ranking edition/default page failed: ${edition.slug}`);
      discoveryEditions.push({slug:edition.slug,records:observed.rankingCount,pageSize:observed.query.size});
    }
    if (fetchAttempts) throw Error("Runtime validation attempted a live API fallback");
    console.log(JSON.stringify({status:"PASS",runtimeRoot,universities:summaries.length,canonicalRecordsSha256:expected,events:store.index().length,analysisControls:controls,discoveryEditions,atomFeed:{records:feedRecords.length,milliseconds:atomMilliseconds,publishedIndexMatched:true},historyApi:"ucl",liveFetchDisabled:true,fetchAttempts}));
  } finally { process.chdir(originalCwd); globalThis.fetch = originalFetch; }
}
main().catch(error => {console.error(error);process.exitCode=1;});
