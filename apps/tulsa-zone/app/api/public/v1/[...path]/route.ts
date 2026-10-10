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
import {GET as recentChanges} from '@/app/api/public/v1/recent-changes.json/route';
import {GET as search,OPTIONS as searchOptions} from '@/app/api/public/v1/search.json/route';
import {GET as snapshotIndex} from '@/app/api/public/v1/policy-snapshots/index.json/route';

import {GET as claimsEndpoint} from '@/app/api/public/v1/claims/[slug]/route';
import {GET as analysisEndpoint} from '@/app/api/public/v1/analysis/universities/[slug]/route';
import {GET as analysisIndex} from '@/app/api/public/v1/analysis/index.json/route';
import {GET as coverageScores} from '@/app/api/public/v1/analysis/coverage-scores.json/route';
import {GET as pageQuality} from '@/app/api/public/v1/analysis/page-quality.json/route';
import {getUniversityStatusWidget,getReviewStateWidget,getPolicyCoverageWidget,getSourceFreshnessWidget,widgetCorsHeaders} from '@/lib/developer-surfaces';

export const dynamic='force-dynamic';
const slug='massachusetts-institute-of-technology';
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}){
 const path=(await params).path.join('/');
 const common:Record<string,()=>Promise<Response>|Response>={
  'tools.json':tools,'coverage/qs-2026.json':coverage,'university-index.json':universityIndex,
  'universities.json':universities,'search/index.json':searchIndex,'policy-snapshots/index.json':snapshotIndex,
  'analysis/index.json':analysisIndex,'analysis/coverage-scores.json':coverageScores,'analysis/page-quality.json':pageQuality
 };
 if(path==='recent-changes.json')return recentChanges();
 if(path==='search.json')return search(request);
 if(Object.hasOwn(common,path))return common[path]();
 if(path===`claims/${slug}`||path===`claims/${slug}.json`)return claimsEndpoint(request,{params:Promise.resolve({slug})});
 if(path===`analysis/universities/${slug}`||path===`analysis/universities/${slug}.json`)return analysisEndpoint(request,{params:Promise.resolve({slug})});
 const widgetPaths=Object.fromEntries(Object.entries({'university-status':getUniversityStatusWidget,'review-state':getReviewStateWidget,'policy-coverage':getPolicyCoverageWidget,'source-freshness':getSourceFreshnessWidget}).flatMap(([kind,load])=>[[`widgets/${kind}/${slug}`,load],[`widgets/${kind}/${slug}.json`,load]]));
 if(Object.hasOwn(widgetPaths,path)){
   const payload=await widgetPaths[path](slug);
   return NextResponse.json(payload??{error:'MIT widget unavailable'},{status:payload?200:503,headers:{...widgetCorsHeaders,'Cache-Control':'private, no-store, no-transform'}});
 }
 if(path===`universities/${slug}.json`||path===`universities/${slug}`){
  const summary=await getStagedPublicSummaryBySlug(slug);
  if(!summary)return NextResponse.json({error:'Published MIT record unavailable'},{status:503});
  const policySnapshot=await getPublicUniversityPolicySnapshotLink(slug,getSiteBaseUrl());
  return NextResponse.json(buildPublicEntitySummaryResponse({...summary,...(policySnapshot?{policySnapshot}:{})},getSiteBaseUrl()),{headers:{'Cache-Control':'private, no-store, no-transform'}});
 }
 if(path===`policy-snapshots/universities/${slug}.json`||path===`policy-snapshots/universities/${slug}`){
  const snapshot=await getLoadedPolicySnapshotBySlug(slug);
  if(!snapshot)return NextResponse.json({error:'MIT snapshot unavailable'},{status:503});
  return NextResponse.json(buildPolicySnapshotResponse(snapshot,getSiteBaseUrl()),{headers:{'Cache-Control':'private, no-store, no-transform'}});
 }
 return NextResponse.json({error:'Outside bounded repair scope'},{status:404});
}

export function OPTIONS(){return searchOptions();}
