"use client";
import {primaryChangeCategory} from "../lib/change-event-rules";
import {changeCountsText} from "@/lib/change-counts-copy";
import React,{useEffect,useRef,useState} from "react";
import type {ChangeEvent} from "@/lib/change-events";
import {eventIndexDefaults,eventIndexFilters,eventIndexQuery,type EventIndexFilters,type EventIndexPage} from "@/lib/change-index-events";
import {matchingChangeItems,type HistoryCategory} from "@/lib/change-history-selection";
import {changeIndexEventsCopy} from "@/lib/change-index-events-copy";
import {changeHistoryCopy} from "@/lib/change-history-copy";
import {changeCategoryKeys,historicalChangeTopicOrder,v6ChangesCopy,v6ChangeTopicTitle} from "@/lib/v6-changes-copy";
import {withLocalePrefix,type SupportedLocale} from "@/lib/i18n";
import {validChangeDate,utcDay} from "@/lib/v6-changes-window";
import {ChangeEventContent} from "./change-event-content";

type DetailState={status:"loading"|"failed"}|{status:"ready";event:ChangeEvent};
export function ChangeIndexEventsBrowser({initial,locale}:{initial:EventIndexPage;locale:SupportedLocale}){
  const ui=changeIndexEventsCopy(locale),history=changeHistoryCopy(locale),copy=v6ChangesCopy(locale);
  const [filters,setFilters]=useState<EventIndexFilters>(eventIndexDefaults),[data,setData]=useState(initial),[status,setStatus]=useState("ready"),[retry,setRetry]=useState(0),[selected,setSelected]=useState<string|null>(null),[detail,setDetail]=useState<DetailState>({status:"loading"}),[detailRetry,setDetailRetry]=useState(0);
  const cache=useRef(new Map<string,ChangeEvent>()),hydrated=useRef(false);
  const query=eventIndexQuery(filters).toString();
  const invalid=filters.start!==undefined&&(!filters.start||!filters.end||!validChangeDate(filters.start)||!validChangeDate(filters.end)||filters.start>filters.end);
  useEffect(()=>{
    const restore=()=>{try{const params=new URLSearchParams(location.search);setFilters(eventIndexFilters(params));setSelected(params.get("event"));setStatus("ready");}catch{setStatus("invalid");}};
    restore();hydrated.current=true;window.addEventListener("popstate",restore);return ()=>window.removeEventListener("popstate",restore);
  },[]);
  useEffect(()=>{
    if(invalid)return;
    if(query===""&&retry===0&&data===initial)return;
    const controller=new AbortController();setStatus("loading");
    const timer=setTimeout(async()=>{
      try{
        const response=await fetch(`/api/public/v1/changes/events/${initial.revision}/index.json?locale=${locale}&${query}`,{cache:"no-store",signal:controller.signal});if(!response.ok)throw Error("Unavailable");
        const value=await response.json() as EventIndexPage;
        if(value.schemaVersion!==initial.schemaVersion||value.revision!==initial.revision||value.basisSha256!==initial.basisSha256||value.projectionSha256!==initial.projectionSha256||value.rulesVersion!==initial.rulesVersion||!Array.isArray(value.rows))throw Error("Foreign index");
        setData(value);setStatus("ready");
      }catch{if(!controller.signal.aborted)setStatus("failed");}
    },200);
    return ()=>{clearTimeout(timer);controller.abort();};
    // Data is deliberately excluded: a completed response must not refetch itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[query,retry,locale,initial,invalid]);
  const row=status==="ready"&&!invalid?(data.rows.find(row=>row.id===selected)??data.rows[0]):undefined;
  useEffect(()=>{
    if(!row)return;
    const cached=cache.current.get(row.id);if(cached){setDetail({status:"ready",event:cached});return;}
    const controller=new AbortController();setDetail({status:"loading"});
    void(async()=>{try{
      const response=await fetch(`/api/public/v1/changes/events/${initial.revision}/${row.slug}.json?eventRevision=${encodeURIComponent(row.revision)}`,{cache:"no-store",signal:controller.signal});if(!response.ok)throw Error("Unavailable");
      const event=await response.json() as ChangeEvent;
      if(event.id!==row.id||event.slug!==row.slug||event.revision!==row.revision||event.publishedAt!==row.publishedAt||event.rulesVersion!==initial.rulesVersion||!Array.isArray(event.items))throw Error("Foreign event");
      if(!controller.signal.aborted){cache.current.set(row.id,event);setDetail({status:"ready",event});}
    }catch{if(!controller.signal.aborted)setDetail({status:"failed"});}})();
    return ()=>controller.abort();
  },[row?.id,initial.revision,initial.rulesVersion,detailRetry]);
  function update(next:EventIndexFilters,event:string|null=null){
    setFilters(next);setSelected(event);if(!invalid)setStatus("ready");
    if(hydrated.current){const params=eventIndexQuery(next);if(event)params.set("event",event);window.history.pushState(null,"",location.pathname+(params.size?`?${params}`:"")+location.hash);}
  }
  const change=(patch:Partial<EventIndexFilters>)=>update({...filters,...patch,page:1});
  const categoryName=(key:string)=>copy.categories[changeCategoryKeys.indexOf(key as typeof changeCategoryKeys[number])]??copy.other;
  const topics=[...initial.facets.topics].sort((a,b)=>{const order=["coursework","exams","disclosure","privacy_data","approved_tools","research_publication",...historicalChangeTopicOrder];return (order.indexOf(a)<0?999:order.indexOf(a))-(order.indexOf(b)<0?999:order.indexOf(b))||a.localeCompare(b);});
  return <div className="v6-changes change-events-browser" data-projection-revision={initial.revision}>
    <div className="v6-changes-body">
      <div className="change-events-search"><label>{ui.search}<input type="search" value={filters.q} onChange={event=>change({q:event.target.value})}/></label></div>
      <div className="change-history-filters change-events-filters">
        <label>{history.range}<select aria-label={history.range} value={filters.start!==undefined?"custom":"all"} onChange={event=>change(event.target.value==="custom"?{start:"",end:""}:{start:undefined,end:undefined})}><option value="all">{history.allDates}</option><option value="custom">{copy.custom}</option></select></label>
        <label>{history.type}<select aria-label={history.type} value={filters.category} onChange={event=>change({category:event.target.value as HistoryCategory})}><option value="default">{history.defaultTypes}</option>{changeCategoryKeys.map((key,i)=><option key={key} value={key}>{copy.categories[i]}</option>)}<option value="all">{history.allTypes}</option></select></label>
        <label>{history.topic}<select aria-label={history.topic} value={filters.topic} onChange={event=>change({topic:event.target.value})}><option value="all">{history.allTopics}</option>{topics.map(key=><option key={key} value={key}>{v6ChangeTopicTitle(key,locale)}</option>)}</select></label>
        <label>{ui.country}<select aria-label={ui.country} value={filters.country} onChange={event=>change({country:event.target.value})}><option value="all">{ui.allCountries}</option>{initial.facets.countries.map(country=><option key={country} value={country}>{country}</option>)}</select></label>
      </div>
      {filters.start!==undefined?<div className="v6-changes-dates"><label>{copy.start}<input aria-label={copy.start} type="date" value={filters.start} onChange={event=>change({start:event.target.value})}/></label><label>{copy.end}<input aria-label={copy.end} type="date" value={filters.end??""} onChange={event=>change({end:event.target.value})}/></label></div>:null}
      <div aria-live="polite" className="change-events-status">{invalid||status==="invalid"?<p role="alert">{copy.invalid}</p>:status==="loading"?<p>{ui.loading}</p>:status==="failed"?<><p role="alert">{copy.failed}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>{copy.retry}</button></>:<><p><strong>{history.matches.replace("{n}",String(data.total))}</strong><span> · {ui.schools.replace("{n}",String(data.schoolCount))}</span></p>{data.coverage.before?<p>{copy.before}</p>:data.coverage.partial?<p>{copy.partial.replace("{date}",data.coverage.recordedFrom??"")}</p>:null}{data.coverage.unknownDates?<p>{copy.undated}</p>:null}{!data.total?<p>{copy.empty}</p>:null}</>}</div>
      {status==="ready"&&!invalid?<div className="change-events-columns">
        <div><ol className="v6-changes-timeline change-events-list" aria-label={ui.title}>{data.rows.map(event=><li key={event.id} data-event-id={event.id}>
          <div className="v6-changes-meta"><time dateTime={event.publishedAt??undefined}>{event.publishedAt?utcDay(event.publishedAt):copy.unknownDate}</time></div>
          <button type="button" className="change-events-select" aria-pressed={row?.id===event.id} onClick={()=>{setSelected(event.id);const params=eventIndexQuery(filters);params.set("event",event.id);window.history.pushState(null,"",`${location.pathname}?${params}`);if(window.matchMedia("(max-width:900px)").matches)requestAnimationFrame(()=>document.querySelector<HTMLElement>(".change-events-detail")?.focus());}}><span data-i18n="preserve">{event.localizedName}</span><span className="v6-changes-meta">{event.categories.filter(key=>filters.category==="all"||filters.category==="default"?filters.category==="all"||primaryChangeCategory(key):key===filters.category).map(categoryName).join(" · ")}</span><span className="v6-changes-meta">{event.themes.filter(key=>key!=="sources").sort((a,b)=>topics.indexOf(a)-topics.indexOf(b)).slice(0,2).map(key=>v6ChangeTopicTitle(key,locale)).join(" · ")}</span></button>
          <a className="change-events-permalink" href={withLocalePrefix(event.url,locale)}>{history.revisionId} · <span data-i18n="preserve">{event.revision}</span></a>
        </li>)}</ol>
          {data.total?<nav className="change-history-pagination" aria-label={history.history}><button type="button" disabled={data.page<=1} onClick={()=>update({...filters,page:data.page-1})}>{history.previous}</button><span>{history.page.replace("{n}",String(data.page)).replace("{m}",String(data.pages))}</span><button type="button" disabled={data.page>=data.pages} onClick={()=>update({...filters,page:data.page+1})}>{history.next}</button></nav>:null}
        </div>
        {row?<section className="change-events-detail" aria-label={copy.details} tabIndex={-1} key={row.id}><h2 data-i18n="preserve">{row.localizedName}</h2><p className="v6-changes-meta">{row.publishedAt?utcDay(row.publishedAt):copy.unknownDate} · <span data-i18n="preserve">{row.revision}</span></p>{row.counts.affected?<p>{changeCountsText(row.counts,locale)}</p>:null}<div aria-live="polite">{detail.status==="ready"&&detail.event.id===row.id?<ChangeEventContent showRevisionLink={false} event={detail.event} items={matchingChangeItems(detail.event,filters)} locale={locale} activeTopic={filters.topic} themeOrder={["coursework","exams","disclosure","privacy_data","approved_tools","research_publication",...historicalChangeTopicOrder]}/>:detail.status==="failed"?<><p>{copy.detailFailed}</p><button type="button" onClick={()=>setDetailRetry(value=>value+1)}>{copy.retry}</button></>:<p>{copy.loading}</p>}</div><footer><a href={withLocalePrefix(row.url,locale)}>{copy.full}</a><a href={withLocalePrefix(`/changes/${row.slug}`,locale)}>{copy.all}</a></footer></section>:null}
      </div>:null}
      <footer><p>{history.reason}</p><p className="v6-changes-meta">{history.scope}</p></footer>
    </div>
  </div>;
}
