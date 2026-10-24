import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { ChangeEventStore } from "../apps/web/lib/public-change-history";
import { buildEventHistories, buildChangeOverview, eventPreview, eventHash, type ChangeOverviewPackage } from "../apps/web/lib/change-events";

const digest=(raw:Buffer)=>createHash('sha256').update(raw).digest('hex');
export function validateChangeEventReceipt(receiptPath:string,scopePath:string,dataPath:string,basisSha256:string,packageRoot=dirname(receiptPath)) {
  const root=realpathSync(packageRoot),receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
  function proof(ref:{path:string;sha256:string;basisSha256:string}) {
    if(!ref||ref.basisSha256!==basisSha256||!/^[a-f0-9]{64}$/.test(ref.sha256))throw Error('Unbound event projection proof');
    const file=realpathSync(resolve(root,ref.path));
    if(!file.startsWith(root+sep))throw Error('Event proof escapes receipt package');
    const raw=readFileSync(file);if(digest(raw)!==ref.sha256)throw Error('Event proof hash mismatch');
    return {file,value:JSON.parse(raw.toString())};
  }
  if(receipt.basisSha256!==basisSha256)throw Error('Event receipt basis mismatch');
  const projection=proof(receipt.projectionArtifact);
  const store=new ChangeEventStore(dirname(projection.file),{path:projection.file.split('/').at(-1)!,sha256:receipt.projectionArtifact.sha256},receipt.inputBasisSha256);
  if(receipt.projectionRevision!==store.manifest.revision||receipt.rulesVersion!==store.manifest.rulesVersion)throw Error('Event rules/revision mismatch');
  const input=store.input(),expected=buildEventHistories(input);
  if(!isDeepStrictEqual(Object.keys(expected).sort(),Object.keys(store.manifest.eventHistories!).sort()))throw Error('Missing or foreign event history scope');
  for(const [slug,history] of Object.entries(expected))if(!isDeepStrictEqual(store.history(input.revision,slug),JSON.parse(JSON.stringify(history))))throw Error(`Missing, duplicate or changed events: ${slug}`);
  const wantedIndex=Object.values(expected).flatMap(h=>h.events.map(e=>({...eventPreview(e),slug:h.slug}))).sort((a,b)=>(Date.parse(b.publishedAt??'')||0)-(Date.parse(a.publishedAt??'')||0)||a.id.localeCompare(b.id));
  if(!isDeepStrictEqual(store.index(),JSON.parse(JSON.stringify(wantedIndex))))throw Error('Stale or duplicate event index');
  const scope=JSON.parse(readFileSync(scopePath,'utf8'));
  const data=JSON.parse(readFileSync(dataPath,'utf8')) as Array<{entity:{slug:string};claims:Array<{id:string}>}>;
  const declared=scope.changedRevisionsBySlug;
  if(!declared||!isDeepStrictEqual(Object.keys(declared).sort(),scope.universities.map((s:{slug:string})=>s.slug).sort()))throw Error('Missing complete changed revision scope');
  for(const summary of data){
    const slug=summary.entity.slug,school=input.schools[slug],history=expected[slug];
    if(!school||school.currentRecordSha256!==eventHash(summary)||!isDeepStrictEqual([...school.currentClaimIds].sort(),summary.claims.map(c=>c.id).sort()))throw Error('Current policy record does not match event basis');
    const changed=school.currentRevision===input.revision&&history.events.some(e=>e.revision===input.revision)?[input.revision]:[];
    if(!isDeepStrictEqual(declared[slug],changed))throw Error('Missing or foreign changed revision scope');
  }
  const overview=proof(receipt.overviewArtifact).value as ChangeOverviewPackage;
  if(overview.schemaVersion!=='uapt-v6-change-overviews-v1'||overview.revision!==input.revision||overview.rulesVersion!==input.rulesVersion||overview.basisSha256!==input.basisSha256||overview.projectionSha256!==receipt.projectionArtifact.sha256)throw Error('Overview package basis mismatch');
  const wantedOverviews=Object.fromEntries(Object.entries(expected).filter(([,h])=>h.currentRecordSha256).map(([slug,h])=>[slug,buildChangeOverview(h,receipt.projectionArtifact.sha256)]));
  if(!isDeepStrictEqual(overview.schools,JSON.parse(JSON.stringify(wantedOverviews))))throw Error('Overview scope/content mismatch');
  const scopeSlugs=new Set(scope.universities.map((s:{slug:string})=>s.slug));
  // Each observed surface stores actual ordered event IDs, not a success boolean.
  for(const name of ['history','universityChanges','latestDiff','changesIndex','recentChanges','rss']) {
    const surface=proof(receipt.eventSurfaces?.[name]).value;
    if(surface.schemaVersion!=='uapt-change-event-surface-v1'||surface.surface!==name||surface.projectionSha256!==receipt.projectionArtifact.sha256||surface.rulesVersion!==input.rulesVersion||!isDeepStrictEqual([...surface.checkedSlugs].sort(),[...scopeSlugs].sort()))throw Error(`Wrong event surface identity: ${name}`);
    let wanted=wantedIndex.filter(e=>scopeSlugs.has(e.slug));
    if(name==='latestDiff')wanted=[...scopeSlugs].flatMap(slug=>wanted.filter(e=>e.slug===slug).slice(0,1)).sort((a,b)=>(Date.parse(b.publishedAt??'')||0)-(Date.parse(a.publishedAt??'')||0)||a.id.localeCompare(b.id));
    if(name==='recentChanges'||name==='rss') {
      const w=surface.window;
      if(!w||typeof w.start!=='string'||typeof w.end!=='string'||!Number.isFinite(Date.parse(w.start))||!Number.isFinite(Date.parse(w.end))||Date.parse(w.start)>Date.parse(w.end)||!/(Z|[+-]\d{2}:\d{2})$/.test(w.start)||!/(Z|[+-]\d{2}:\d{2})$/.test(w.end)||!Number.isSafeInteger(w.limit)||w.limit<1||w.limit>100)throw Error(`Invalid event window: ${name}`);
      wanted=wanted.filter(e=>e.publishedAt&&Date.parse(e.publishedAt)>=Date.parse(w.start)&&Date.parse(e.publishedAt)<=Date.parse(w.end)).slice(0,w.limit);
    }
    if(!isDeepStrictEqual(surface.eventIds,wanted.map(e=>e.id)))throw Error(`Stale, duplicate or missing event surface: ${name}`);
  }
  return {revision:input.revision,schools:Object.keys(expected).length,events:wantedIndex.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);
  if(args.length!==5)throw Error('Use <changes-receipt.json> <scope.json> <public-data.json> <basis-sha256>');
  process.stdout.write(JSON.stringify(validateChangeEventReceipt(...args as [string,string,string,string,string]))+'\n');
}
