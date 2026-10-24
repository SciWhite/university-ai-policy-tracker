import {cache} from "react";
import {loadSelectedChangeEventIndex} from "./change-events-api";
import {getCatalogUniversities} from "./catalog";
import {getLocalizedInstitutionName} from "./institution-localization";
import {normalizeLocale,type SupportedLocale} from "./i18n";
import {matchingChangeItems} from "./change-history-selection";
import {eventIndexDefaults,eventIndexFilters,eventIndexCandidates,paginateEventIndex,eventSurfaceRows,type ChangeIndexEvent,type EventIndexFilters,type EventIndexPage} from "./change-index-events";
import {eventPreview,type EventHistory} from "./change-events";

export const selectedEventIndex=cache(async(locale:SupportedLocale)=>{
  const selected=await loadSelectedChangeEventIndex();if(!selected)return undefined;
  const universities=new Map((await getCatalogUniversities()).map(row=>[row.slug,row]));
  const names=new Map<string,string>();
  for(const slug of new Set(selected.rows.map(row=>row.slug))){
    const university=universities.get(slug);
    const name=university?.name??selected.historicalName(slug);
    if(!name)throw Error("Event index university identity unavailable");names.set(slug,name);
  }
  const rows:ChangeIndexEvent[]=selected.rows.map(row=>({...row,name:names.get(row.slug)!,localizedName:getLocalizedInstitutionName(row.slug,names.get(row.slug)!,locale),country:universities.get(row.slug)?.country??null}));
  return {...selected,rows};
});
export async function getEventIndexPage(locale:SupportedLocale,filters:EventIndexFilters=eventIndexDefaults):Promise<EventIndexPage|undefined>{
  const selected=await selectedEventIndex(locale);if(!selected)return undefined;
  let rows=eventIndexCandidates(selected.rows,filters);
  // The preview has separate category/topic arrays. Verify their intersection on
  // actual items, rather than claiming that any two facets refer to one Claim.
  if(filters.topic!=="all"){
    const histories=new Map<string,EventHistory>();
    rows=rows.flatMap(row=>{
      let history=histories.get(row.slug);if(!history){history=selected.history(row.slug);if(!history)throw Error("Missing indexed school history");histories.set(row.slug,history);}
      const event=history.events.find(event=>event.id===row.id);if(!event)throw Error("Missing indexed revision");
      const items=matchingChangeItems(event,filters);return items.length?[{...row,...eventPreview({...event,items})}]:[];
    });
  }
  const result=paginateEventIndex(rows,filters,{topics:[...new Set(selected.rows.flatMap(row=>row.themes))].sort(),countries:[...new Set(selected.rows.flatMap(row=>row.country?[row.country]:[]))].sort()});
  return {schemaVersion:"uapt-change-event-index-v1",...selected.identity,...result};
}
export const eventApiHeaders={"Cache-Control":"private, no-store, no-transform"};
export async function eventIndexResponse(request:Request,revision:string,kind:"index"|"latest"|"recent"="index"){
  const url=new URL(request.url),locale=normalizeLocale(url.searchParams.get("locale")??undefined);
  let filters:EventIndexFilters;
  try{filters=eventIndexFilters(url.searchParams);}catch{return Response.json({error:"Invalid event filters"},{status:400,headers:eventApiHeaders});}
  try{
    const selected=await selectedEventIndex(locale);
    if(!selected)return Response.json({error:"Verified event projection is not selected"},{status:503,headers:eventApiHeaders});
    if(selected.identity.revision!==revision)return Response.json({error:"Requested projection revision is unavailable"},{status:409,headers:eventApiHeaders});
    if(kind==="index")return Response.json(await getEventIndexPage(locale,filters),{headers:eventApiHeaders});
    const dates=selected.rows.flatMap(row=>row.publishedAt?[row.publishedAt]:[]).sort((a,b)=>Date.parse(a)-Date.parse(b));
    const window={start:url.searchParams.get("start")??(dates[0]?new Date(dates[0]).toISOString():"1970-01-01T00:00:00Z"),end:url.searchParams.get("end")??(dates.at(-1)?new Date(dates.at(-1)!).toISOString():"1970-01-01T00:00:00Z"),limit:Number(url.searchParams.get("limit")??50)};
    const rows=eventSurfaceRows(selected.rows,kind,window);
    return Response.json({schemaVersion:"uapt-change-event-surface-v1",...selected.identity,surface:kind==="latest"?"latestDiff":"recentChanges",...(kind==="recent"?{window}:{}),total:rows.length,rows},{headers:eventApiHeaders});
  }catch(error){if(error instanceof Error&&error.message==="Invalid event window")return Response.json({error:error.message},{status:400,headers:eventApiHeaders});return Response.json({error:"Event artifact validation failed; history is unavailable"},{status:503,headers:eventApiHeaders});}
}
