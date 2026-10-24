import {primaryChangeCategory} from "./change-event-rules";
import type { ChangeOverview } from "./change-events";

const day = 86_400_000;
export const utcDay = (value:string) => {const date=new Date(value);return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):null;};
export function changeWindow(today:string,days:30|90=90) {
  return {start:new Date(Date.parse(`${today}T00:00:00Z`)-(days-1)*day).toISOString().slice(0,10),end:today};
}
export function validChangeDate(value:string) {return /^\d{4}-\d{2}-\d{2}$/.test(value)&&utcDay(`${value}T00:00:00Z`)===value;}
export function visibleChangeWindow(overview:ChangeOverview,start:string,end:string) {
  if(!validChangeDate(start)||!validChangeDate(end)||start>end)return {kind:"invalid" as const};
  const eligible=overview.timeline.filter(e=>e.categories.some(primaryChangeCategory));
  const events=eligible.filter(e=>{const date=e.publishedAt&&utcDay(e.publishedAt);return date&&date>=start&&date<=end;});
  const from=overview.recordedFrom&&utcDay(overview.recordedFrom);
  return {kind:from&&end<from?"before" as const:from&&start<from?"partial" as const:events.length?"matches" as const:"empty" as const,
    count:events.length,previews:events.slice(0,3),undated:eligible.filter(e=>!e.publishedAt).length,from};
}
