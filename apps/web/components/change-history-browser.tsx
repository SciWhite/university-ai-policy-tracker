"use client";
import {changeItemsText} from "@/lib/change-counts-copy";
import React,{useState} from "react";
import type {EventHistory} from "@/lib/change-events";
import {withLocalePrefix,type SupportedLocale} from "@/lib/i18n";
import {changeCategoryKeys,historicalChangeTopicOrder,v6ChangesCopy,v6ChangeTopicTitle} from "@/lib/v6-changes-copy";
import {changeHistoryCopy} from "@/lib/change-history-copy";
import {selectChangeHistory,type HistoryCategory} from "@/lib/change-history-selection";
import {utcDay} from "@/lib/v6-changes-window";
import {ChangeEventContent} from "./change-event-content";

const pageSize=6;
export function ChangeHistoryBrowser({history,locale,heldHref,universityAvailable=true}:{history:EventHistory;locale:SupportedLocale;heldHref?:string;universityAvailable?:boolean}){
  const ui=changeHistoryCopy(locale),copy=v6ChangesCopy(locale);
  const [category,setCategory]=useState<HistoryCategory>("default"),[topic,setTopic]=useState("all"),[custom,setCustom]=useState(false),[start,setStart]=useState(""),[end,setEnd]=useState(""),[page,setPage]=useState(1);
  const selected=selectChangeHistory(history,{category,topic,start:custom?start:undefined,end:custom?end:undefined});
  const order=[...history.themeOrder,...historicalChangeTopicOrder];
  const topics=[...new Set(history.events.flatMap(event=>event.items.flatMap(item=>item.themes??[item.theme])))].sort((a,b)=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b);});
  const pages=selected.kind==="invalid"?1:Math.max(1,Math.ceil(selected.count/pageSize));
  const currentPage=Math.min(page,pages);
  const rows=selected.kind==="invalid"?[]:selected.rows.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const update=(action:()=>void)=>{action();setPage(1);};
  const categoryName=(key:string)=>copy.categories[changeCategoryKeys.indexOf(key as typeof changeCategoryKeys[number])]??copy.other;
  return <div className="v6-changes change-history-panel">
    <div className="v6-changes-body">
      <div className="change-history-filters">
        <label>{ui.range}<select value={custom?"custom":"all"} onChange={e=>update(()=>setCustom(e.target.value==="custom"))}><option value="all">{ui.allDates}</option><option value="custom">{copy.custom}</option></select></label>
        <label>{ui.type}<select value={category} onChange={e=>update(()=>setCategory(e.target.value as HistoryCategory))}><option value="default">{ui.defaultTypes}</option>{changeCategoryKeys.map((key,i)=><option key={key} value={key}>{copy.categories[i]}</option>)}<option value="all">{ui.allTypes}</option></select></label>
        <label>{ui.topic}<select value={topic} onChange={e=>update(()=>setTopic(e.target.value))}><option value="all">{ui.allTopics}</option>{topics.map(key=><option key={key} value={key}>{v6ChangeTopicTitle(key,locale)}</option>)}</select></label>
      </div>
      {custom?<div className="v6-changes-dates"><label>{copy.start}<input type="date" value={start} onChange={e=>update(()=>setStart(e.target.value))}/></label><label>{copy.end}<input type="date" value={end} onChange={e=>update(()=>setEnd(e.target.value))}/></label></div>:null}
      <div className="v6-changes-status" aria-live="polite" aria-atomic="true">
        {selected.kind==="invalid"?<p role="alert">{copy.invalid}</p>:<><p>{ui.matches.replace("{n}",String(selected.count))}</p>{selected.kind==="before"?<p>{copy.before}</p>:selected.kind==="partial"?<p>{copy.partial.replace("{date}",selected.from??"")}</p>:null}{selected.kind==="empty"||selected.kind==="partial"&&!selected.count?<p>{copy.empty}</p>:null}{selected.unknownDates?<p>{copy.undated}</p>:null}</>}
      </div>
      {rows.length?<ol className="v6-changes-timeline">{rows.map(({event,items})=><li key={event.id} id={`revision-${event.revision}`}><div className="v6-changes-meta"><time dateTime={event.publishedAt??undefined}>{event.publishedAt?utcDay(event.publishedAt):copy.unknownDate}</time><span>{[...new Set(items.map(item=>item.category))].map(categoryName).join(" · ")}</span></div>
        <p className="v6-changes-preview">{changeItemsText(items,locale)}</p>
        <a href={withLocalePrefix(event.url,locale)}>{ui.revisionId}: <span data-i18n="preserve">{event.revision}</span></a>
        <details className="v6-changes-event"><summary>{copy.details}</summary><ChangeEventContent event={event} items={items} locale={locale} themeOrder={history.themeOrder} activeTopic={topic} heldHref={heldHref}/></details>
      </li>)}</ol>:null}
      {pages>1?<nav className="change-history-pagination" aria-label={ui.history}><button type="button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>{ui.previous}</button><span>{ui.page.replace("{n}",String(currentPage)).replace("{m}",String(pages))}</span><button type="button" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>{ui.next}</button></nav>:null}
      <footer><p className="v6-changes-meta">{ui.reason}</p>{history.coverage.gaps.length?<p className="v6-changes-meta">{copy.gaps}</p>:null}{universityAvailable?<a href={withLocalePrefix(`/universities/${history.slug}`,locale)}>{ui.university}</a>:null}<a href={`/api/public/v1/changes/events/${history.revision}/${history.slug}.json`}>{ui.json}</a></footer>
    </div>
  </div>;
}
