import type {ChangeCategory,EventPreview} from "./change-events";
import type {HistoryCategory} from "./change-history-selection";
import {primaryChangeCategory} from "./change-history-selection";
import {validChangeDate,utcDay} from "./v6-changes-window";
import {changeCategoryKeys} from "./v6-changes-copy";

export interface ChangeIndexEvent extends EventPreview {slug:string;name:string;localizedName:string;country:string|null}
export interface EventIndexFilters {q:string;category:HistoryCategory;topic:string;country:string;start?:string;end?:string;page:number}
export const eventIndexDefaults:EventIndexFilters={q:"",category:"default",topic:"all",country:"all",page:1};
export const eventIndexPageSize=8;
export interface EventIndexPage {
  schemaVersion:"uapt-change-event-index-v1";revision:string;basisSha256:string;projectionSha256:string;rulesVersion:string;
  filters:EventIndexFilters;rows:ChangeIndexEvent[];total:number;schoolCount:number;page:number;pages:number;
  coverage:{recordedFrom:string|null;unknownDates:number;partial:boolean;before:boolean};
  facets:{topics:string[];countries:string[]};
}
export function eventIndexFilters(params:URLSearchParams):EventIndexFilters{
  const category=params.get("kind")??"default",page=params.get("page")??"1";
  if(category!=="all"&&category!=="default"&&!changeCategoryKeys.includes(category as ChangeCategory))throw Error("Invalid update type");
  if(!/^\d+$/.test(page)||!Number.isSafeInteger(Number(page))||Number(page)<1)throw Error("Invalid page");
  const start=params.get("from")??undefined,end=params.get("to")??undefined;
  if(start!==undefined||end!==undefined){if(!start||!end||!validChangeDate(start)||!validChangeDate(end)||start>end)throw Error("Invalid date range");}
  return {q:(params.get("q")??"").trim().slice(0,200),category:category as HistoryCategory,topic:params.get("topic")??"all",country:params.get("country")??"all",start,end,page:Number(page)};
}
export function eventIndexQuery(filters:EventIndexFilters){
  const p=new URLSearchParams();if(filters.q)p.set("q",filters.q);if(filters.category!=="default")p.set("kind",filters.category);if(filters.topic!=="all")p.set("topic",filters.topic);if(filters.country!=="all")p.set("country",filters.country);if(filters.start!==undefined)p.set("from",filters.start);if(filters.end!==undefined)p.set("to",filters.end);if(filters.page>1)p.set("page",String(filters.page));return p;
}
export function matchesEventCategory(categories:ChangeCategory[],category:HistoryCategory){return categories.some(value=>category==="all"||category==="default"&&primaryChangeCategory(value)||value===category);}
export function eventIndexCandidates(rows:ChangeIndexEvent[],filters:EventIndexFilters){
  const q=filters.q.toLocaleLowerCase();
  return rows.filter(row=>matchesEventCategory(row.categories,filters.category)&&(filters.topic==="all"||row.themes.includes(filters.topic))&&(filters.country==="all"||row.country===filters.country)&&(!q||[row.name,row.localizedName,row.slug,row.revision].some(text=>text.toLocaleLowerCase().includes(q))));
}
/** Full filtered set first, dates and pagination second. Never collapse rows by school. */
export function paginateEventIndex(rows:ChangeIndexEvent[],filters:EventIndexFilters,facets:EventIndexPage["facets"]){
  const dated=rows.flatMap(row=>{const date=row.publishedAt&&utcDay(row.publishedAt);return date?[date]:[];}).sort();
  const from=dated[0]??null,unknownDates=rows.filter(row=>!row.publishedAt).length;
  const filtered=rows.filter(row=>{const date=row.publishedAt&&utcDay(row.publishedAt);return !filters.start||Boolean(date&&date>=filters.start&&date<=filters.end!);});
  const pages=Math.max(1,Math.ceil(filtered.length/eventIndexPageSize)),page=Math.min(filters.page,pages);
  return {filters,rows:filtered.slice((page-1)*eventIndexPageSize,page*eventIndexPageSize),total:filtered.length,schoolCount:new Set(filtered.map(row=>row.slug)).size,page,pages,facets,coverage:{recordedFrom:from,unknownDates,partial:Boolean(filters.start&&from&&filters.start<from&&filters.end!>=from),before:Boolean(filters.end&&from&&filters.end<from)}};
}
/** Latest is one actual event per school; recent/RSS are dated event windows. */
export function eventSurfaceRows(rows:ChangeIndexEvent[],kind:"latest"|"recent",window?:{start:string;end:string;limit:number}){
  if(kind==="latest"){const seen=new Set<string>();return rows.filter(row=>{if(seen.has(row.slug))return false;seen.add(row.slug);return true;});}
  if(!window||!Number.isSafeInteger(window.limit)||window.limit<1||window.limit>100||![window.start,window.end].every(date=>/(Z|[+-]\d{2}:\d{2})$/.test(date)&&Number.isFinite(Date.parse(date)))||Date.parse(window.start)>Date.parse(window.end))throw Error("Invalid event window");
  return rows.filter(row=>row.publishedAt&&Date.parse(row.publishedAt)>=Date.parse(window.start)&&Date.parse(row.publishedAt)<=Date.parse(window.end)).slice(0,window.limit);
}
