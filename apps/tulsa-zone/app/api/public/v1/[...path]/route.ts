import {canonicalUniversitySlug} from "@/lib/canonical-university-slug";
import {GET as universityEndpoint} from "@/app/api/public/v1/universities/[...slug]/route";
import {withSourceHashContract} from "@/lib/source-hash-contract";
import {v6BaselineRevision} from '@/lib/v6-effective-records';
import {HistoryCapacityError} from '@/lib/bounded-cache';
import {withIndexProvenance} from "@/lib/index-provenance";
import {readV6RecordCorrections,readV6RecordCorrectionRevision,v6RecordRevision,v6SummaryAtRevision,v6RecordSlugs} from "@/lib/v6-effective-records";
import {readPublishedV6Revision} from "@/lib/policy-v6-published";
import {readPublishedV6,publishedV6School,publishedV6Bundle,publishedV6Evidence} from "@/lib/policy-v6-published";
import {NextResponse} from 'next/server';
import {buildPublicEntitySummaryResponse} from '@uapt/shared';
import {getStagedPublicSummaryBySlug} from '@/lib/staged-public-data';
import {getLoadedPolicySnapshotBySlug,buildPolicySnapshotResponse,getPublicUniversityPolicySnapshotLink} from '@/lib/policy-snapshots';
import {getSiteBaseUrl} from '@/lib/site-url';
import {GET as tools} from '@/app/api/public/v1/tools.json/route';
import {GET as coverage} from '@/app/api/public/v1/coverage/qs-2026.json/route';
import {GET as universityIndex} from '@/app/api/public/v1/university-index.json/route';
import {GET as universities} from '@/app/api/public/v1/universities.json/route';
import {GET as searchIndex} from '@/app/api/public/v1/search/index.json/route';
import {getChangeIndexResponse} from '@/lib/change-records';
import {getLatestReleaseDiff,getReleaseDiff,getLatestEntityReleaseDiff,getEntityReleaseDiff,getV5RecordReleaseDiff,getScopedRecordReleaseDiff} from '@/lib/release-diffs';
import {getStagedRecentChangesEnvelope} from '@/lib/staged-public-data';
import {buildRecentChangesWidgetFromPublicChanges} from '@/lib/developer-surfaces';
import {GET as recentChanges} from '@/app/api/public/v1/recent-changes.json/route';
import {GET as snapshotIndex} from '@/app/api/public/v1/policy-snapshots/index.json/route';

import {GET as claimsEndpoint} from '@/app/api/public/v1/claims/[slug]/route';
import {GET as analysisEndpoint} from '@/app/api/public/v1/analysis/universities/[slug]/route';
import {GET as analysisIndex} from '@/app/api/public/v1/analysis/index.json/route';
import {GET as coverageScores} from '@/app/api/public/v1/analysis/coverage-scores.json/route';
import {GET as pageQuality} from '@/app/api/public/v1/analysis/page-quality.json/route';
import {getUniversityStatusWidget,getReviewStateWidget,getPolicyCoverageWidget,getSourceFreshnessWidget,widgetCorsHeaders} from '@/lib/developer-surfaces';

export const dynamic='force-dynamic';
const slugs=v6RecordSlugs();
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}){
 try { return await handleGet(request,{params}); }
 catch(error) {
  if(error instanceof HistoryCapacityError)return NextResponse.json({error:'Historical computation is busy; retry shortly.'},{status:503,headers:{'Retry-After':'2','Cache-Control':'no-store'}});
  throw error;
 }
}
async function handleGet(request:Request,{params}:{params:Promise<{path:string[]}>}){
 const path=(await params).path.join('/');
 const match = path.match(/^(universities|claims)\/([^/]+)$/) ?? path.match(/^(changes\/(?:latest|[a-z0-9-]+))\/([^/]+)$/);
 if(match){const slug=match[2].replace(/\.json$/, ""), canonical=canonicalUniversitySlug(slug);if(canonical!==slug)return NextResponse.redirect(new URL(`/api/public/v1/${match[1]}/${canonical}${match[2].endsWith(".json")?".json":""}`,getSiteBaseUrl()),308);}
 const correction=readV6RecordCorrections()!;
 if(path.startsWith('policy-pages/v6/revisions/')){const revision=path.split('/').at(-1)!.replace(/\.json$/,'');const data=readPublishedV6Revision(revision);return NextResponse.json(data??{error:'Revision not found'},{status:data?200:404});}
 if(/^record-corrections\/(latest|[a-z0-9-]+)\.json$/.test(path)){const revision=path.split('/')[1].replace(/\.json$/,'');const selected=revision==='latest'?correction:readV6RecordCorrectionRevision(revision);return NextResponse.json(selected?{schemaVersion:'uapt-scoped-record-diff-v1',revision:selected.revision,datasetReleaseId:selected.datasetReleaseId,publishedAt:selected.publishedAt,changes:selected.changesBySlug}:{error:'Correction revision not found'},{status:selected?200:404});}
 const history=path.match(/^universities\/([a-z0-9-]+)\/revisions\/([a-z0-9-]+)\.json$/);
 if(history&&slugs.includes(history[1])){const slug=history[1],baseline=history[2]===v6BaselineRevision(slug),selected=baseline?correction:readV6RecordCorrectionRevision(history[2]);if(!selected)return NextResponse.json({error:'Record revision not found'},{status:404});const record=baseline?selected.historical[slug]?.baseline:v6SummaryAtRevision(slug,selected.revision);if(!record)return NextResponse.json({error:'University not present in this historical revision'},{status:404});const historical=baseline||selected.revision!==correction.revision;return NextResponse.json({...withSourceHashContract(buildPublicEntitySummaryResponse(record,'https://eduaipolicy.org'),record),recordRevision:history[2],historical,heldClaims:baseline?selected.historical[slug].heldClaims:selected.heldBySlug[slug],historicalSnapshot:baseline?selected.historical[slug].snapshot:undefined,notice:historical?'Historical version; not current permission or snapshot approval.':'Current scoped reviewed record.'});}
 if(path==='policy-pages/v5.json'){const data=readPublishedV6()!;return NextResponse.json({schemaVersion:'uapt-bounded-v5-pages-v1',releaseId:data.releaseId,slugs:data.v5Slugs??[],presentation:data.v5Presentation},{headers:{'Cache-Control':'private, no-store, no-transform'}});}
 if(path==='policy-pages/v6.json')return NextResponse.json(readPublishedV6(),{headers:{'Cache-Control':'private, no-store, no-transform'}});
 if(path==='policy-pages/v6/changes/latest.json'){const data=readPublishedV6()!;return NextResponse.json({schemaVersion:'uapt-page-supplement-diff-v1',releaseId:data.releaseId,canonicalDatasetChanged:data.publicationKind==='v6_presentation_integration'?false:true,publicationKind:data.publicationKind==='v6_presentation_integration'?'v6_presentation_integration':'scoped_record_correction',changes:data.slugs.map(slug=>({slug,href:'/changes/'+(data.publicationKind==='v6_presentation_integration'?data.releaseId:correction.recordRevisions[slug].universityRevisionId)+'/'+slug,basisFingerprint:publishedV6School(slug,'en')!.fingerprint,reviewedDisplayClaimIds:v6SummaryAtRevision(slug,correction.revision)!.claims.map(c=>c.id),...(data.publicationKind==='v6_presentation_integration'?{addedClaimIds:[],updatedClaimIds:[],heldClaimIds:[],presentationChanged:true}:correction.changesBySlug[slug])}))});}
 const common:Record<string,()=>Promise<Response>|Response>={
  'tools.json':tools,'coverage/qs-2026.json':coverage,'university-index.json':universityIndex,
  'universities.json':universities,'search/index.json':searchIndex,'policy-snapshots/index.json':snapshotIndex,
  'analysis/index.json':analysisIndex,'analysis/coverage-scores.json':coverageScores,'analysis/page-quality.json':pageQuality
 };
 if(path==='coverage/qs-2026.json'||path==='policy-snapshots/index.json'){const response=await common[path]();const body=await response.json();
 if(path==='coverage/qs-2026.json'){
  // The dataset publication and this composed response have different clocks.
  body.datasetGeneratedAt=body.generatedAt;
  body.generatedAt=new Date().toISOString();
  body.timestampSemantics={generatedAt:'Response composition time; not evidence retrieval or policy effective date.',datasetGeneratedAt:'Historical base dataset publication time.','appliedRecordCorrection.recordedAt':'Scoped record/package correction time; not policy effective date.'};
 }
 const indexed=withIndexProvenance(body,correction);
 if(path==='coverage/qs-2026.json'){
  indexed.baselineGeneratedAt=body.datasetGeneratedAt;
  indexed.generatedAtMeaning='response_composition';
 }
 return NextResponse.json(indexed,{headers:{'Cache-Control':'private, no-store, no-transform'}});}
 if(path==='recent-changes.json')return recentChanges();
 if(path==='changes/index.json')return NextResponse.json(await getChangeIndexResponse());
 if(path==='changes/latest.json')return NextResponse.json({...await getLatestReleaseDiff(),scopedRecordCorrection:{revision:correction.revision,publishedAt:correction.publishedAt,changes:correction.changesBySlug}});
 if(path==='widgets/recent-changes.json')return NextResponse.json(buildRecentChangesWidgetFromPublicChanges((await getStagedRecentChangesEnvelope()).data.changes,10),{headers:widgetCorsHeaders});
 if(path.startsWith('changes/')) {
   const parts=path.split('/').slice(1).map(part=>part.replace(/\.json$/, ''));
   if(parts[0].startsWith('pku-v5-')||Object.values(readV6RecordCorrectionRevision(parts[0])?.recordRevisions??{}).some(r=>r.universityRevisionId===parts[0]&&r.baselineRevisionId)) {
     const diff=parts.length<=2?await (parts[0].startsWith('pku-v5-')?getV5RecordReleaseDiff(parts[0]):getScopedRecordReleaseDiff(parts[0])):undefined;
     const payload=parts[1]?diff?.entities.find(entity=>entity.entitySlug===parts[1]):diff;
     return NextResponse.json(payload??{error:'Change diff not found'},{status:payload?200:404,headers:{'Cache-Control':'private, no-store, no-transform'}});
   }
   const scoped=parts[0]==='latest'&&parts[1]&&correction.recordRevisions[parts[1]]?.baselineRevisionId ? await getScopedRecordReleaseDiff(correction.recordRevisions[parts[1]].universityRevisionId) : undefined;
   const payload=parts[0]==='latest'&&parts[1] ? scoped?.entities.find(entity=>entity.entitySlug===parts[1])??await getLatestEntityReleaseDiff(parts[1]) : parts[1] ? await getEntityReleaseDiff(parts[0],parts[1]) : await getReleaseDiff(parts[0]);
   return NextResponse.json(payload?{...payload,...(parts[0]==='latest'&&correction.changesBySlug[parts[1]]?{scopedRecordCorrection:{revision:correction.recordRevisions[parts[1]].universityRevisionId,...readV6RecordCorrectionRevision(correction.recordRevisions[parts[1]].universityRevisionId)?.changesBySlug[parts[1]]}}:{})}:{error:'Change diff not found'},{status:payload?200:404});
 }

 if(path==='search.json')return (await import('@/app/api/public/v1/search.json/route')).GET(request);
 if(Object.hasOwn(common,path))return common[path]();
 for (const slug of slugs) {
 if(path===`claims/${slug}`||path===`claims/${slug}.json`)return claimsEndpoint(request,{params:Promise.resolve({slug})});
 if(path===`analysis/universities/${slug}`||path===`analysis/universities/${slug}.json`)return analysisEndpoint(request,{params:Promise.resolve({slug})});
 const widgetPaths=Object.fromEntries(Object.entries({'university-status':getUniversityStatusWidget,'review-state':getReviewStateWidget,'policy-coverage':getPolicyCoverageWidget,'source-freshness':getSourceFreshnessWidget}).flatMap(([kind,load])=>[[`widgets/${kind}/${slug}`,load],[`widgets/${kind}/${slug}.json`,load]]));
 if(Object.hasOwn(widgetPaths,path)){
   const payload=await widgetPaths[path](slug);
   return NextResponse.json(payload??{error:'Repair widget unavailable'},{status:payload?200:503,headers:{...widgetCorsHeaders,'Cache-Control':'private, no-store, no-transform'}});
 }
 if(path===`universities/${slug}.json`||path===`universities/${slug}`){
  const summary=await getStagedPublicSummaryBySlug(slug);
  if(!summary)return NextResponse.json({error:'Published repair record unavailable'},{status:503});
  const policySnapshot=await getPublicUniversityPolicySnapshotLink(slug,getSiteBaseUrl());
  return NextResponse.json({...withSourceHashContract(buildPublicEntitySummaryResponse({...summary,...(policySnapshot?{policySnapshot}:{})},'https://eduaipolicy.org'),summary),recordRevision:v6RecordRevision(slug),historicalRecordsUrl:`https://eduaipolicy.org/api/public/v1/universities/${slug}/revisions/${v6BaselineRevision(slug)}.json`},{headers:{'Cache-Control':'private, no-store, no-transform'}});
 }
 if(path===`policy-snapshots/universities/${slug}.json`||path===`policy-snapshots/universities/${slug}`){
  const snapshot=await getLoadedPolicySnapshotBySlug(slug);
  if(!snapshot)return NextResponse.json({error:'Student snapshot not published',reasonCode:'not_published',recordRevision:v6RecordRevision(slug)},{status:404});
  return NextResponse.json(buildPolicySnapshotResponse(snapshot,getSiteBaseUrl()),{headers:{'Cache-Control':'private, no-store, no-transform'}});
 }
 }
 const summaryPath=path.match(/^universities\/([^/]+)$/);
 if(summaryPath)return universityEndpoint(request,{params:Promise.resolve({slug:[summaryPath[1]]})});
 const claimPath=path.match(/^claims\/([^/]+)$/);
 if(claimPath)return claimsEndpoint(request,{params:Promise.resolve({slug:claimPath[1]})});
 return NextResponse.json({error:'Outside bounded repair scope'},{status:404});
}

export async function OPTIONS(){return (await import('@/app/api/public/v1/search.json/route')).OPTIONS();}
