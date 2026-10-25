import {primaryChangeCategory} from "./change-event-rules";
import type {ChangeCategory,ChangeEvent,ChangeItem,EventHistory} from "./change-events";
import {utcDay,validChangeDate} from "./v6-changes-window";

export type HistoryCategory="default"|"all"|ChangeCategory;
export interface HistoryFilters {category:HistoryCategory;topic:string;start?:string;end?:string}
export {primaryChangeCategory} from "./change-event-rules";
export const itemHasTopic=(item:ChangeItem,topic:string)=>topic==="all"||item.theme===topic||Boolean(item.themes?.includes(topic));
export function matchingChangeItems(event:ChangeEvent,filters:Pick<HistoryFilters,"category"|"topic">){
  return event.items.filter(item=>(filters.category==="all"||filters.category==="default"&&(primaryChangeCategory(item.category)||item.category==="record_maintenance"||item.category==="page_update")||filters.category===item.category)&&itemHasTopic(item,filters.topic));
}
export function selectChangeHistory(history:EventHistory,filters:HistoryFilters){
  const custom=filters.start!==undefined||filters.end!==undefined;
  if(custom&&(!filters.start||!filters.end||!validChangeDate(filters.start)||!validChangeDate(filters.end)||filters.start>filters.end))return {kind:"invalid" as const};
  const from=history.coverage.recordedFrom&&utcDay(history.coverage.recordedFrom);
  const eligible=history.events.map(event=>({event,items:matchingChangeItems(event,filters)})).filter(row=>row.items.length);
  const rows=eligible.filter(({event})=>{if(!custom)return true;const date=event.publishedAt&&utcDay(event.publishedAt);return Boolean(date&&date>=filters.start!&&date<=filters.end!);});
  const unknownDates=eligible.filter(({event})=>!event.publishedAt).length;
  return {kind:custom&&from&&filters.end!<from?"before" as const:custom&&from&&filters.start!<from?"partial" as const:rows.length?"matches" as const:"empty" as const,rows,count:rows.length,unknownDates,from};
}
/** A Claim can belong to several themes; it still counts once in a filtered event. */
export function selectedItemCount(items:ChangeItem[]){return new Set(items.map(item=>item.claimId??item.id)).size;}
