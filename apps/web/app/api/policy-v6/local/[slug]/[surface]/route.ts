import {NextResponse} from 'next/server';
import {getLocalV6Bundle,getLocalV6StudentActions} from '@/lib/policy-v6-bundle';
export const dynamic='force-dynamic';
/** Explicit private local QA surface. Never changes canonical/public API data. */
export async function GET(_request:Request,{params}:{params:Promise<{slug:string;surface:string}>}){
 if(process.env.NODE_ENV!=='development')return NextResponse.json({error:'Not found'},{status:404});
 const {slug,surface}=await params;
 if(!['claims','analysis','actions'].includes(surface))return NextResponse.json({error:'Not found'},{status:404});
 const view=getLocalV6Bundle(slug,'en');
 if(!view||view.publicationApproved!==false||!view.analysisProjection)return NextResponse.json({error:'Local candidate not available'},{status:404});
 const data=surface==='claims'?{slug,claims:view.claims,tools:view.tools}:surface==='analysis'?view.analysisProjection.profile:getLocalV6StudentActions(view);
 return NextResponse.json({candidateOnly:true,publicationApproved:false,revision:view.school.revision,sourceBundleSha256:view.sourceBundleSha256,data},{headers:{'Cache-Control':'private, no-store, no-transform'}});
}
