import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync} from "node:fs";
import {resolve,dirname,relative} from "node:path";
import {pathToFileURL} from "node:url";
import {collectSummaryEvidence} from "./lib/change-summary-evidence";
import {ChangeEventStore} from "../apps/web/lib/public-change-history";
import {bindChangeSummary,summaryHash,summaryTextHash,assertSummaryText,acceptReviewedChangeSummary,type SummaryProjection} from "../apps/web/lib/change-summary-binding";
import {MAX_SUMMARY_BYTES,summaryReviewChecks,type ChangeSummaryDraft,type ChangeSummaryReview,type ChangeSummaryText} from "../apps/web/lib/change-summary-types";
import type {ChangeSummaryManifest} from "../apps/web/lib/change-summary-store";

export function summaryReviewContext(root:string){
  const ref=JSON.parse(readFileSync(resolve(root,"current.json"),"utf8")),store=new ChangeEventStore(root,ref);
  const projection:SummaryProjection={projectionRevision:store.manifest.revision!,projectionSha256:ref.sha256,basisSha256:store.manifest.basisSha256,rulesVersion:store.manifest.rulesVersion!};
  return {store,projection,input:store.input()};
}
function newOutput(output:string){
  const target=resolve(output),data=resolve("data");
  if(existsSync(target)||!relative(data,target).startsWith(".."))throw Error("Use a NEW private staging directory outside tracked data");
  mkdirSync(target,{recursive:true});return target;
}
const write=(path:string,value:unknown)=>writeFileSync(path,JSON.stringify(value,null,2)+"\n",{flag:"wx"});
export function prepareSummaryReviewPacket(root:string,slug:string,revision:string,output:string,context=summaryReviewContext(root)){
  const {store,projection,input}=context,event=store.history(projection.projectionRevision,slug)?.events.find(event=>event.revision===revision);
  if(!event)throw Error("Exact summary event not found");
  const binding=bindChangeSummary(event,projection),target=newOutput(output);
  const evidence=collectSummaryEvidence(event,input);
  const hardHold=evidence.some(row=>row.issues.some(issue=>["frozen_excerpt_unavailable","assessment_must_not_conflicts_with_should_not_excerpt"].includes(issue)));
  const preflight={status:hardHold?"held":evidence.some(row=>row.issues.length)?"needs_semantic_review":"pending_review",semanticApproval:false,issues:evidence.flatMap(row=>row.issues.map(reason=>({itemId:row.itemId,reason}))),evidenceSha256:summaryHash(evidence)};
  const packet={schemaVersion:"uapt-change-summary-review-packet-v1",binding,event,evidence,preflight,publicationApproved:false};
  write(resolve(target,"packet.json"),packet);
  writeFileSync(resolve(target,"generation-prompt.txt"),`Write EN and ZH candidate summaries for the attached frozen tracker revision only.\nReturn {whatChanged,studentImpact,basisAndScope} in each language. Each field must be concise.\nDescribe changes to THIS SITE'S RECORD, never claim the university introduced or repealed a rule.\nPreserve school/unit/course/date scope, uncertainty, held decisions and access-versus-assessment distinctions.\nDo not infer an absent policy, current permissions, new effective dates or why an unclassified historical revision occurred.\nThis packet is historical evidence, not proof of current university policy. Do not update it from latest.\nCompare each bound Claim with its attached frozen evidence snippets, including must/should/may/required, negation and scope. Lexical screening is not semantic approval. If evidence is missing or strength conflicts, hold the summary; do not repeat the unsupported assertion as a student rule.\nUse only the exact bound Claim text, snippets and URLs. State gaps plainly. Do not generate approval metadata.\nBinding SHA-256: ${summaryHash(binding)}\n`,{flag:"wx"});
  return packet;
}
export function writeSummaryDraft(packetPath:string,language:"en"|"zh",text:ChangeSummaryText,generatorId:string,output:string){
  const packet=JSON.parse(readFileSync(packetPath,"utf8"));
  if(packet.schemaVersion!=="uapt-change-summary-review-packet-v1"||!generatorId.trim()||!["en","zh"].includes(language)||!summaryHash(packet.binding)||summaryHash(bindChangeSummary(packet.event,packet.binding))!==summaryHash(packet.binding))throw Error("Invalid summary packet");
  if(!packet.evidence||packet.preflight?.evidenceSha256!==summaryHash(packet.evidence))throw Error("Frozen summary evidence required");
  assertSummaryText(text);
  const draft:ChangeSummaryDraft={schemaVersion:"uapt-change-summary-draft-v1",binding:packet.binding,language,generatedAt:new Date().toISOString(),generator:{kind:"ai",id:generatorId},text,...(packet.preflight?.status==="held"?{generationHold:packet.preflight.issues.map((issue:{itemId:string;reason:string})=>`${issue.itemId}:${issue.reason}`)}:{})};
  const target=newOutput(output);write(resolve(target,"draft.json"),draft);
  write(resolve(target,"review-template.json"),{schemaVersion:"uapt-change-summary-review-v1",decision:"pending",draftSha256:summaryHash(draft),bindingSha256:summaryHash(draft.binding),reviewerId:"",reviewedAt:null,checks:Object.fromEntries(summaryReviewChecks.map(key=>[key,false]))});
  return draft;
}
export interface SummaryReviewInput {draft:{path:string;sha256:string};review:{path:string;sha256:string}}
/** Consumes externally supplied review receipts; there is deliberately no approve command. */
export function exportReviewedSummaryPackage(root:string,inputs:SummaryReviewInput[],base:string,output:string){
  const {store,projection}=summaryReviewContext(root),approved=[];
  const read=<T,>(ref:{path:string;sha256:string}):T=>{const file=realpathSync(resolve(base,ref.path)),raw=readFileSync(file);if(summaryTextHash(raw.toString())!==ref.sha256)throw Error("Summary review input hash mismatch");return JSON.parse(raw.toString()) as T;};
  for(const input of inputs){
    const draft=read<ChangeSummaryDraft>(input.draft),review=read<ChangeSummaryReview>(input.review);
    const event=store.history(projection.projectionRevision,draft.binding.slug)?.events.find(event=>event.id===draft.binding.eventId);if(!event)throw Error("Reviewed event no longer exists");
    approved.push(acceptReviewedChangeSummary(draft,review,event,projection));
  }
  const manifest:ChangeSummaryManifest={schemaVersion:"uapt-reviewed-change-summaries-v1",projection,events:{}};
  for(const value of approved){const refs=manifest.events[value.binding.eventId]??={};if(refs[value.language])throw Error("Duplicate reviewed summary language");refs[value.language]={file:"",sha256:"",bytes:0};}
  if(approved.some(value=>Buffer.byteLength(JSON.stringify(value))>MAX_SUMMARY_BYTES))throw Error("Reviewed summary exceeds bounded leaf size");
  const target=newOutput(output);mkdirSync(resolve(target,"objects"));
  for(const value of approved){const raw=JSON.stringify(value),sha256=summaryTextHash(raw),file=`objects/${sha256}.json`;writeFileSync(resolve(target,file),raw,{flag:"wx"});manifest.events[value.binding.eventId][value.language]={file,sha256,bytes:Buffer.byteLength(raw)};}
  const raw=JSON.stringify(manifest),sha256=summaryTextHash(raw),file=`manifest-${sha256}.json`;writeFileSync(resolve(target,file),raw,{flag:"wx"});write(resolve(target,"current.json"),{path:file,sha256});
  return {events:Object.keys(manifest.events).length,summaries:approved.length,manifestSha256:sha256,projection};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [command,...args]=process.argv.slice(2);
  if(command==="prepare"&&args.length===4){prepareSummaryReviewPacket(...args as [string,string,string,string]);}
  else if(command==="draft"&&args.length===5){writeSummaryDraft(args[0],args[1] as "en"|"zh",JSON.parse(readFileSync(args[2],"utf8")),args[3],args[4]);}
  else if(command==="package"&&args.length===3){const inputs=JSON.parse(readFileSync(args[1],"utf8")) as SummaryReviewInput[];process.stdout.write(JSON.stringify(exportReviewedSummaryPackage(args[0],inputs,dirname(resolve(args[1])),args[2]))+"\n");}
  else throw Error("Use prepare <public-history-root> <slug> <event-revision> <NEW-private-output> | draft <packet.json> <en|zh> <text.json> <generator-id> <NEW-private-output> | package <public-history-root> <frozen-review-inputs.json> <NEW-private-output>");
}
