import {readV6RecordCorrections,v6RecordRevision} from "@/lib/v6-effective-records";
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
import {getLatestReleaseDiff,getReleaseDiff,getLatestEntityReleaseDiff,getEntityReleaseDiff} from '@/lib/release-diffs';
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
const slugs=readV6RecordCorrections()?.summaries.map(s=>s.entity.slug)??[];
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}){
 const path=(await params).path.join('/');
 const correction=readV6RecordCorrections()!;
 if(path.startsWith('policy-pages/v6/revisions/')){const revision=path.split('/').at(-1)!.replace(/\.json$/,'');const data=readPublishedV6Revision(revision);return NextResponse.json(data??{error:'Revision not found'},{status:data?200:404});}
 if(path==='record-corrections/latest.json')return NextResponse.json({schemaVersion:'uapt-scoped-record-diff-v1',revision:correction.revision,datasetReleaseId:correction.datasetReleaseId,publishedAt:correction.publishedAt,changes:correction.changesBySlug});
 const history=path.match(/^universities\/([a-z0-9-]+)\/revisions\/(baseline-v6-pages-20261013|v6-audit-fix-20261014)\.json$/);
 if(history&&slugs.includes(history[1])){const slug=history[1],historical=history[2].startsWith('baseline-');const record=historical?correction.historical[slug].baseline:correction.summaries.find(s=>s.entity.slug===slug)!;return NextResponse.json({...buildPublicEntitySummaryResponse(record,'https://eduaipolicy.org'),recordRevision:history[2],historical,heldClaims:historical?correction.historical[slug].heldClaims:correction.heldBySlug[slug],historicalSnapshot:historical?correction.historical[slug].snapshot:undefined,notice:historical?'Historical baseline; not current permission or snapshot approval.':'Current scoped reviewed record.'});}
 if(path==='policy-pages/v6.json')return NextResponse.json(readPublishedV6(),{headers:{'Cache-Control':'private, no-store, no-transform'}});
 if(path==='policy-pages/v6/changes/latest.json'){const data=readPublishedV6()!;return NextResponse.json({schemaVersion:'uapt-page-supplement-diff-v1',releaseId:data.releaseId,canonicalDatasetChanged:true,publicationKind:'scoped_record_correction',changes:data.slugs.map(slug=>({slug,href:'/changes/'+data.releaseId+'/'+slug,basisFingerprint:publishedV6School(slug,'en')!.fingerprint,reviewedDisplayClaimIds:correction.summaries.find(s=>s.entity.slug===slug)!.claims.map(c=>c.id),...correction.changesBySlug[slug]}))});}
 const common:Record<string,()=>Promise<Response>|Response>={
  'tools.json':tools,'coverage/qs-2026.json':coverage,'university-index.json':universityIndex,
  'universities.json':universities,'search/index.json':searchIndex,'policy-snapshots/index.json':snapshotIndex,
  'analysis/index.json':analysisIndex,'analysis/coverage-scores.json':coverageScores,'analysis/page-quality.json':pageQuality
 };
 if(path==='recent-changes.json')return recentChanges();
 if(path==='changes/index.json')return NextResponse.json(await getChangeIndexResponse());
 if(path==='changes/latest.json')return NextResponse.json({...await getLatestReleaseDiff(),scopedRecordCorrection:{revision:correction.revision,publishedAt:correction.publishedAt,changes:correction.changesBySlug}});
 if(path==='widgets/recent-changes.json')return NextResponse.json(buildRecentChangesWidgetFromPublicChanges((await getStagedRecentChangesEnvelope()).data.changes,10),{headers:widgetCorsHeaders});
 if(path.startsWith('changes/')) {
   const parts=path.split('/').slice(1).map(part=>part.replace(/\.json$/, ''));
   const payload=parts[0]==='latest'&&parts[1] ? await getLatestEntityReleaseDiff(parts[1]) : parts[1] ? await getEntityReleaseDiff(parts[0],parts[1]) : await getReleaseDiff(parts[0]);
   return NextResponse.json(payload?{...payload,...(parts[0]==='latest'&&correction.changesBySlug[parts[1]]?{scopedRecordCorrection:{revision:correction.revision,...correction.changesBySlug[parts[1]]}}:{})}:{error:'Change diff not found'},{status:payload?200:404});
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
  return NextResponse.json({...buildPublicEntitySummaryResponse({...summary,...(policySnapshot?{policySnapshot}:{})},'https://eduaipolicy.org'),recordRevision:v6RecordRevision(slug),historicalRecordsUrl:`https://eduaipolicy.org/api/public/v1/universities/${slug}/revisions/baseline-v6-pages-20261013.json`},{headers:{'Cache-Control':'private, no-store, no-transform'}});
 }
 if(path===`policy-snapshots/universities/${slug}.json`||path===`policy-snapshots/universities/${slug}`){
  const snapshot=await getLoadedPolicySnapshotBySlug(slug);
  if(!snapshot)return NextResponse.json({error:'Student snapshot not published',reasonCode:'not_published',recordRevision:v6RecordRevision(slug)},{status:404});
  return NextResponse.json(buildPolicySnapshotResponse(snapshot,getSiteBaseUrl()),{headers:{'Cache-Control':'private, no-store, no-transform'}});
 }
 }
 return NextResponse.json({error:'Outside bounded repair scope'},{status:404});
}

export async function OPTIONS(){return (await import('@/app/api/public/v1/search.json/route')).OPTIONS();}
