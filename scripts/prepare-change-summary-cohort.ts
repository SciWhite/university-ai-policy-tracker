import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareSummaryReviewPacket,summaryReviewContext} from './change-summary-workflow';
import {primaryChangeCategory} from '../apps/web/lib/change-event-rules';
import {utcDay,changeWindow} from '../apps/web/lib/v6-changes-window';
import {summaryHash} from '../apps/web/lib/change-summary-binding';

/** One recent substantive event per actual V6 school; exact evidence is kept in private packets. */
export function prepareChangeSummaryCohort(packageRoot:string,output:string,today:string){
 if(!existsSync(resolve(output)))throw Error('Create the isolated audit output parent first');
 const base=realpathSync(resolve(output)),outside=relative(realpathSync(resolve('data')),base);
 if(outside!==".."&&!outside.startsWith(".."+sep))throw Error('Summary cohort output must remain private and outside tracked data');
 const overview=JSON.parse(readFileSync(resolve(packageRoot,'overviews.json'),'utf8'));
 const context=summaryReviewContext(resolve(packageRoot,'public-change-history'));
 const window=changeWindow(today),pilot=new Set(['epfl','cornell-university','massachusetts-institute-of-technology']);
 const overrides:Record<string,string>={epfl:'qs20-24-v6-r6-20261020','cornell-university':'cornell-v6-r2-20261016','massachusetts-institute-of-technology':'v6-audit-fix-20261014'};
 const rows=[];
 for(const slug of Object.keys(overview.schools).sort()){
  const history=context.store.history(context.projection.projectionRevision,slug)!;
  const events=history.events.filter(e=>{const day=e.publishedAt&&utcDay(e.publishedAt);return day&&day>=window.start&&day<=window.end&&e.items.some(i=>primaryChangeCategory(i.category));});
  const event=overrides[slug]?events.find(e=>e.revision===overrides[slug]):events[0];
  if(!event){rows.push({slug,cohort:pilot.has(slug)?'pilot':'expansion',status:'no_recent_substantive_event',publicationApproved:false});continue;}
  try{
   const packet=prepareSummaryReviewPacket(context.store.root,slug,event.revision,resolve(base,'schools',slug),context);
   rows.push({slug,cohort:pilot.has(slug)?'pilot':'expansion',eventId:event.id,revision:event.revision,date:event.publishedAt,itemCount:packet.binding.items.length,packet:`schools/${slug}/packet.json`,packetObjectSha256:summaryHash(packet),preflight:packet.preflight,publicationApproved:false});
  }catch(error){rows.push({slug,cohort:pilot.has(slug)?'pilot':'expansion',eventId:event.id,status:'packet_blocked',reason:String(error),publicationApproved:false});}
 }
 const result={schemaVersion:'uapt-private-change-summary-cohort-v1',projection:context.projection,window,rows,publicationApproved:false};
 writeFileSync(resolve(base,'cohort.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [root,out,today]=process.argv.slice(2);if(!root||!out||!today)throw Error('Use <new-package-root> <private-output-parent> <UTC-today>');const result=prepareChangeSummaryCohort(root,out,today);console.log(JSON.stringify({schools:result.rows.length,packets:result.rows.filter(r=>'packet'in r).length,held:result.rows.filter(r=>'preflight'in r&&r.preflight?.status==='held').length}));}
