import {publishedV6School} from "../../apps/web/lib/policy-v6-published";
import { readFileSync, mkdirSync, existsSync, writeFileSync, realpathSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { buildEventHistories, buildChangeOverview, eventPreview, eventHash, CHANGE_RULES_VERSION, type ChangeProjectionInput, type ScopedEventSource, type ChangeOverviewPackage } from "../../apps/web/lib/change-events";
import { historyManifest, readPublicChangeHistory, type HistoryFile } from "../../apps/web/lib/public-change-history";
import { publicHistoryBasisV2 } from "../../apps/web/lib/public-history-basis";
import { readV6RecordCorrections, readV6RecordCorrectionRevision, v6SummaryAtRevision, v6BaselineRevision } from "../../apps/web/lib/v6-effective-records";
import { v6FrozenHistory } from "../../apps/web/lib/v6-history-cache";
import { v6HistoryRepair } from "../../apps/web/lib/v6-history-repair";
import { digest, exportV6Revision } from "../export-v6-shards";
import { readVerifiedArtifact } from "../../apps/web/lib/v6-artifact-store";
import type { ChangeRecord } from "../../apps/web/lib/change-records";

export async function collectChangeProjectionInput(repoRoot:string): Promise<ChangeProjectionInput> {
  const {manifest}=await historyManifest();
  if(manifest.schemaVersion!=="uapt-public-change-history-v1")throw Error("v2 upgrade requires the frozen v1 source projection, not a recursive re-export");
  const selected=readV6RecordCorrections();if(!selected)throw Error("Published V6 records required");
  const schools:ChangeProjectionInput['schools']={};
  const summaries=new Map(selected.summaries.map(s=>[s.entity.slug,s]));
  for(const slug of [...new Set([...Object.keys(manifest.entries),...summaries.keys()])].sort()) {
    const legacy=await readPublicChangeHistory(slug);
    const frozen=v6FrozenHistory(slug)??[];
    const byRevision=new Map<string,ChangeRecord>();
    const corroborating:ChangeRecord[]=[];
    for(const row of [...legacy,...frozen]) {
      if(!row.releaseId)throw Error("Missing frozen revision");
      // The bounded V6 view is an existing projection, not another event stream.
      // Prefer its explicit scoped display repair for this exact identity only.
      const repair=v6HistoryRepair(slug,row.releaseId);
      const prior=byRevision.get(row.releaseId);
      if(!prior || repair || !prior.diffRows.length && row.diffRows.length)byRevision.set(row.releaseId,repair??{...row,slug});
      else if(prior.diffRows.length && row.diffRows.length && eventHash(prior.diffRows)!==eventHash(row.diffRows)) {
        // Compare event content, not differences in citation envelopes or summary metadata.
        corroborating.push({...row,slug});
        buildEventHistories({schemaVersion:"uapt-change-history-input-v2",revision:selected.revision,basisSha256:"0".repeat(64),rulesVersion:CHANGE_RULES_VERSION,schools:{[slug]:{currentClaimIds:[],gaps:[],sources:[{kind:"legacy",record:prior},{kind:"legacy",record:{...row,slug}}]}}});
      }
    }
    const current=summaries.get(slug);
    const school:ChangeProjectionInput['schools'][string]={currentRecordSha256:current?eventHash(current):undefined,currentRevision:selected.recordRevisions[slug]?.universityRevisionId,currentClaimIds:current?.claims.map(c=>c.id!)??[],sources:[...byRevision.values(),...corroborating].map(record=>({kind:record.publicationKind==="scoped_record_correction"?"record_repair" as const:"legacy" as const,record})),gaps:[]};
    if(current){
      const selectedSchool=publishedV6School(slug,'en',selected.revision);
      school.themeOrder=selectedSchool?[...selectedSchool.topics,...selectedSchool.additionalTopics].map(t=>t.key):[];
      if(eventHash(current)!==selected.recordRevisions[slug].recordSha256)throw Error(`Current record fingerprint mismatch: ${slug}`);
      let revision:string|undefined=selected.recordRevisions[slug].universityRevisionId;
      const seen=new Set<string>();
      while(revision){
        if(seen.has(revision))throw Error(`Cyclic school revision chain: ${slug}/${revision}`);
        seen.add(revision);
        const pkg=readV6RecordCorrectionRevision(revision);
        if(!pkg){school.gaps.push(`revision_unavailable:${revision}`);break;}
        const pin=pkg.recordRevisions[slug];
        if(!pin){school.gaps.push(`school_missing_in_revision:${revision}`);break;}
        if(pin.universityRevisionId!==revision){revision=pin.universityRevisionId;continue;}
        const summary=v6SummaryAtRevision(slug,revision)!;
        if(!summary||eventHash(summary)!==pin.recordSha256)throw Error(`Historical record fingerprint mismatch: ${slug}/${revision}`);
        let previousRevision=pin.previousRevisionId;
        if(!previousRevision && pkg.parentRevisionId){
          const parent=readV6RecordCorrectionRevision(pkg.parentRevisionId);
          previousRevision=parent?.recordRevisions[slug]?.universityRevisionId;
          if(!parent)school.gaps.push(`parent_revision_unavailable:${pkg.parentRevisionId}`);
        }
        const declared=!!previousRevision;
        previousRevision??=v6BaselineRevision(slug,pkg);
        const before=declared?v6SummaryAtRevision(slug,previousRevision):pkg.historical[slug]?.baseline;
        const page=publishedV6School(slug,'en',revision);
        const previousPage=declared?publishedV6School(slug,'en',previousRevision):undefined;
        const claimThemes:Record<string,string[]>={};
        for(const topic of [...(page?.topics??[]),...(page?.additionalTopics??[]),...(previousPage?.topics??[]),...(previousPage?.additionalTopics??[])])for(const claim of topic.claims)claimThemes[claim.id]=[...new Set([...(claimThemes[claim.id]??[]),topic.key])];
        const source:ScopedEventSource={kind:"scoped",slug,revision,previousRevision,publishedAt:pin.publishedAt,current:summary,before,
          held:pkg.heldBySlug[slug]??[],changes:pkg.changesBySlug[slug],gaps:before?[]:[`previous_record_unavailable:${previousRevision}`],metadataChanged:!!pkg.changeSummary,claimThemes};
        if(!source.changes)throw Error(`Missing declared change IDs: ${slug}/${revision}`);
        school.sources.push(source);
        revision=declared?previousRevision:undefined;
      }
      school.gaps.push("presentation_history_not_normalized");
    }
    schools[slug]=school;
  }
  return {schemaVersion:"uapt-change-history-input-v2",revision:selected.revision,basisSha256:await publicHistoryBasisV2(repoRoot),rulesVersion:CHANGE_RULES_VERSION,schools};
}

/** Upgrade the existing projection in a NEW isolated directory. Never select a live pointer. */
export async function exportChangeHistoryV2(repoRoot:string,output:string) {
  const target=resolve(output),dataRoot=realpathSync(resolve(repoRoot,"data"));
  const parent=realpathSync(dirname(target));
  if(existsSync(target)||!relative(dataRoot,resolve(parent,target.split('/').at(-1)!)).startsWith('..'))throw Error("Use a NEW isolated v2 output outside tracked data");
  const input=await collectChangeProjectionInput(repoRoot);
  const histories=buildEventHistories(input);
  const legacy=await historyManifest();
  const root=resolve(target,"public-change-history");
  // All validation and deterministic derivation above precedes writes.
  mkdirSync(resolve(root,"objects"),{recursive:true});
  const put=(value:unknown):HistoryFile=>{
    const raw=Buffer.from(JSON.stringify(value)),sha256=digest(raw),file=`objects/${sha256}.json`;
    writeFileSync(resolve(root,file),raw,{flag:existsSync(resolve(root,file))?'w':'wx'});
    return {file,sha256,bytes:raw.length};
  };
  const entries:Record<string,HistoryFile>={},releases:Record<string,HistoryFile>={};
  for(const [key,ref] of Object.entries(legacy.manifest.entries))entries[key]=put(readVerifiedArtifact(legacy.root,ref.file,ref.sha256,4*1024*1024,ref.bytes));
  for(const [key,ref] of Object.entries(legacy.manifest.releases))releases[key]=put(readVerifiedArtifact(legacy.root,ref.file,ref.sha256,32*1024*1024,ref.bytes));
  const eventHistories=Object.fromEntries(Object.entries(histories).map(([slug,history])=>[slug,put(history)]));
  const eventIndex=put(Object.values(histories).flatMap(h=>h.events.map(e=>({...eventPreview(e),slug:h.slug}))).sort((a,b)=>(Date.parse(b.publishedAt??"")||0)-(Date.parse(a.publishedAt??"")||0)||a.id.localeCompare(b.id)));
  const manifest={schemaVersion:"uapt-public-change-history-v2",revision:input.revision,basisSha256:input.basisSha256,rulesVersion:CHANGE_RULES_VERSION,projectionInput:put(input),entries,releases,eventHistories,eventIndex};
  const raw=Buffer.from(JSON.stringify(manifest)),sha256=digest(raw),file=`manifest-${sha256}.json`;
  const overviews:ChangeOverviewPackage={schemaVersion:"uapt-v6-change-overviews-v1",revision:input.revision,projectionSha256:sha256,basisSha256:input.basisSha256,rulesVersion:CHANGE_RULES_VERSION,
    schools:Object.fromEntries(Object.entries(histories).filter(([,h])=>h.currentRecordSha256).map(([slug,h])=>[slug,buildChangeOverview(h,sha256)]))};
  if(await publicHistoryBasisV2(repoRoot)!==input.basisSha256)throw Error("Event inputs changed during export");
  writeFileSync(resolve(root,file),raw,{flag:'wx'});
  // This pointer exists only inside the new isolated package.
  writeFileSync(resolve(root,"current.json"),JSON.stringify({path:file,sha256})+'\n',{flag:'wx'});
  const overviewRaw=Buffer.from(JSON.stringify(overviews));
  exportV6Revision(resolve(target,"public-v6-change-overviews"),"public-v6-change-overviews",input.revision,overviewRaw);
  writeFileSync(resolve(target,"overviews.json"),overviewRaw,{flag:'wx'});
  const receipt={schemaVersion:"uapt-change-history-export-receipt-v2",revision:input.revision,basisSha256:input.basisSha256,projectionSha256:sha256,overviewSha256:digest(overviewRaw),schools:Object.keys(histories).length,events:Object.values(histories).reduce((n,h)=>n+h.events.length,0),legacyRowsPreserved:true,currentPointerSelected:false,publicationPerformed:false};
  writeFileSync(resolve(target,"receipt.json"),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  return receipt;
}
