import { readFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { ChangeEventStore, type HistoryFile } from "../../apps/web/lib/public-change-history";
import { readVerifiedArtifact } from "../../apps/web/lib/v6-artifact-store";
import { buildEventHistories, buildChangeOverview, eventPreview, type ChangeOverviewPackage } from "../../apps/web/lib/change-events";
import { digest } from "../export-v6-shards";

export function validateChangePackage(root:string,ref:{path:string;sha256:string},overview:ChangeOverviewPackage) {
  const store=new ChangeEventStore(root,ref,overview.basisSha256),input=store.input(),histories=buildEventHistories(input);
  if(overview.schemaVersion!=="uapt-v6-change-overviews-v1"||overview.revision!==input.revision||overview.rulesVersion!==input.rulesVersion||overview.projectionSha256!==ref.sha256)throw Error("Change package identity mismatch");
  if(!isDeepStrictEqual(Object.keys(histories).sort(),Object.keys(store.manifest.eventHistories!).sort()))throw Error("Missing/foreign event histories");
  for(const [slug,h] of Object.entries(histories))if(!isDeepStrictEqual(JSON.parse(JSON.stringify(h)),store.history(input.revision,slug)))throw Error("Change package differs from frozen input");
  const index=Object.values(histories).flatMap(h=>h.events.map(e=>({...eventPreview(e),slug:h.slug}))).sort((a,b)=>(Date.parse(b.publishedAt??'')||0)-(Date.parse(a.publishedAt??'')||0)||a.id.localeCompare(b.id));
  if(!isDeepStrictEqual(JSON.parse(JSON.stringify(index)),store.index()))throw Error("Stale change event index");
  const expected=Object.fromEntries(Object.entries(histories).filter(([,h])=>h.currentRecordSha256).map(([slug,h])=>[slug,buildChangeOverview(h,ref.sha256)]));
  if(!isDeepStrictEqual(JSON.parse(JSON.stringify(expected)),overview.schools))throw Error("Change overview differs from frozen projection");
  const refs=[...Object.values(store.manifest.entries),...Object.values(store.manifest.releases),...Object.values(store.manifest.eventHistories!),store.manifest.eventIndex!,store.manifest.projectionInput!];
  for(const child of refs)readVerifiedArtifact(root,child.file,child.sha256,128*1024*1024,child.bytes);
  return {store,refs};
}
export function copyChangePackage(sourceRoot:string,ref:{path:string;sha256:string},targetRoot:string,refs:HistoryFile[]) {
  function copy(file:string,sha256:string,bytes?:number){
    readVerifiedArtifact(sourceRoot,file,sha256,128*1024*1024,bytes);
    const raw=readFileSync(resolve(sourceRoot,file));
    if(digest(raw)!==sha256||bytes!==undefined&&raw.length!==bytes)throw Error("History object changed during copy");
    if(!/^objects\/[a-f0-9]{64}\.json$/.test(file)&&!/^manifest-[a-f0-9]{64}\.json$/.test(file))throw Error("Invalid history object path");
    const target=resolve(targetRoot,file);mkdirSync(resolve(target,'..'),{recursive:true});
    if(existsSync(target)){if(digest(readFileSync(target))!==sha256)throw Error("Immutable history collision");}
    else writeFileSync(target,raw,{flag:'wx'});
  }
  for(const child of refs)copy(child.file,child.sha256,child.bytes);
  copy(ref.path,ref.sha256);
  const next=resolve(targetRoot,'current.json.next');
  writeFileSync(next,JSON.stringify(ref)+'\n',{flag:'wx'});
  // Caller performs the final atomic pointer rename inside an isolated candidate.
  return next;
}
