import {readFile,writeFile} from 'node:fs/promises';
import {catalogPayloadSchema,loadCatalog,digest,eligibleClaims} from '../apps/mcp/src/catalog';
import {publicEntitySummarySchema} from '@uapt/shared';
async function main(){
 const dir='.local/v6-audit-fix';const previous=await loadCatalog(dir+'/mcp-baseline-catalog.json');const correction=JSON.parse(await readFile('data/public-v6-records/revisions/v6-audit-fix-20261014.json','utf8'));const bySlug=new Map(correction.summaries.map((s:any)=>[s.entity.slug,s]));
 const sourceEnvelope=JSON.parse(await readFile(dir+'/mcp-baseline-catalog.json','utf8'));const payload=structuredClone(sourceEnvelope.payload);
 payload.exportedAt=correction.publishedAt;const changed:string[]=[];
 for(const record of payload.records){const slug=record.summary.entity.slug;const summary=bySlug.get(slug);if(!summary)continue;record.summary=publicEntitySummarySchema.parse(summary);record.aliases=[...new Set([...record.aliases,...record.summary.entity.aliases,record.summary.entity.name])];delete record.snapshot;Object.assign(record,{universityRevisionId:correction.revision,recordSha256:digest(record.summary),recordPublishedAt:correction.publishedAt,snapshotUnavailableReason:correction.snapshots[slug]?'pending_review':'not_published',historicalClaimIds:correction.heldBySlug[slug].map((c:any)=>c.id)});if(eligibleClaims(record).length!==record.summary.claims.length)throw Error('Ineligible current record '+slug);changed.push(slug);}
 if(changed.length!==10)throw Error('MCP correction scope mismatch');const catalog=catalogPayloadSchema.parse(payload);const bytes=JSON.stringify({sha256:digest(catalog),payload:catalog});await writeFile(dir+'/mcp-corrected-catalog.json',bytes);await loadCatalog(dir+'/mcp-corrected-catalog.json');
 const untouched=sourceEnvelope.payload.records.filter((r:any)=>!bySlug.has(r.summary.entity.slug));for(const old of untouched){const actual=payload.records.find((r:any)=>r.summary.entity.slug===old.summary.entity.slug);if(digest(old)!==digest(actual))throw Error('Changed non-target MCP record '+old.summary.entity.slug);}
 console.log(JSON.stringify({records:catalog.records.length,changed:10,unchangedRecords:untouched.length,currentTargetClaims:catalog.records.filter(r=>bySlug.has(r.summary.entity.slug)).reduce((n,r)=>n+r.summary.claims.length,0),catalogDigest:digest(catalog)}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
