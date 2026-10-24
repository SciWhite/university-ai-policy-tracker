"use client";
import {primaryChangeCategory,CHANGE_RULES_VERSION} from "../lib/change-event-rules";
import {changeCountsText} from "@/lib/change-counts-copy";
import {ChangeEventContent} from "./change-event-content";
import React,{useEffect,useRef,useState} from "react";
import {withLocalePrefix,type SupportedLocale} from "@/lib/i18n";
import type {SelectedChangeOverview} from "@/lib/change-events-api";
import type {ChangeEvent,ChangeOverview,EventPreview} from "@/lib/change-events";
import {changeWindow,utcDay,visibleChangeWindow} from "@/lib/v6-changes-window";
import {changeCategoryKeys,v6ChangesCopy,v6ChangeTopicTitle,historicalChangeTopicOrder} from "@/lib/v6-changes-copy";

const isPrimary=primaryChangeCategory;
type Props={slug:string;recordSha256?:string;locale:SupportedLocale;today:string;initial:SelectedChangeOverview;hasHeldRecords?:boolean};
type EventState={status:"loading"}|{status:"failed"}|{status:"ready";event:ChangeEvent};

export function PolicyV6ChangesClient({slug,recordSha256,locale,today,initial,hasHeldRecords=false}:Props){
  const copy=v6ChangesCopy(locale),root=useRef<HTMLDetailsElement>(null);
  const [overview,setOverview]=useState(initial),[retrying,setRetrying]=useState(false);
  const [range,setRange]=useState(changeWindow(today)),[preset,setPreset]=useState("90");
  const [events,setEvents]=useState<Record<string,EventState>>({});
  const pending=useRef(new Set<string>());
  const selection=overview.status==="ready"?visibleChangeWindow(overview.overview,range.start,range.end):undefined;
  const revision=overview.status==="ready"?overview.overview.revision:overview.revision;
  const category=(key:string)=>copy.categories[changeCategoryKeys.indexOf(key as typeof changeCategoryKeys[number])]??copy.other;
  const theme=(key:string)=>v6ChangeTopicTitle(key,locale);
  const themeOrder=[...(overview.status==="ready"?overview.overview.themeOrder:[]),...historicalChangeTopicOrder];
  const orderedThemes=(keys:string[])=>[...keys].sort((a,b)=>{const ia=themeOrder.indexOf(a),ib=themeOrder.indexOf(b);return (ia<0?999:ia)-(ib<0?999:ib)||a.localeCompare(b);});
  const previewThemes=(keys:string[])=>{const names=[...new Set(orderedThemes(keys.filter(key=>key!=="sources")).map(theme))];return names.slice(0,2).join(" · ")+(names.length>2?" · "+copy.moreThemes.replace("{n}",String(names.length-2)):"");};
  const date=(value:string|null)=>value&&utcDay(value)||copy.unknownDate;

  useEffect(()=>{
    const reveal=()=>{if(globalThis.location.hash==="#record-changes"&&root.current){root.current.open=true;requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>("summary")?.focus({preventScroll:true}));}};
    reveal();globalThis.addEventListener("hashchange",reveal);
    // Repeated clicks on the current hash must also reopen a manually closed module.
    const click=(event:MouseEvent)=>{if(!event.defaultPrevented&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0&&event.target instanceof Element&&event.target.closest('a[href="#record-changes"]'))revealOnClick();};
    const revealOnClick=()=>{if(root.current){root.current.open=true;requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>("summary")?.focus({preventScroll:true}));}};
    document.addEventListener("click",click);
    return()=>{globalThis.removeEventListener("hashchange",reveal);document.removeEventListener("click",click);};
  },[]);

  async function retryOverview(){
    if(!revision||retrying)return;
    setRetrying(true);
    try{
      const response=await fetch(`/api/public/v1/changes/overview/${revision}/${slug}.json`,{cache:"no-store"});
      if(!response.ok)throw Error("Unavailable");
      const value=await response.json() as ChangeOverview;
      if(value.schemaVersion!=="uapt-v6-change-overview-v1"||value.revision!==revision||value.slug!==slug||value.recordSha256!==recordSha256||value.rulesVersion!==CHANGE_RULES_VERSION||!Array.isArray(value.timeline))throw Error("Foreign overview");
      setOverview({status:"ready",overview:value});
    }catch{setOverview({status:"failed",revision});}finally{setRetrying(false);}
  }
  async function loadEvent(preview:EventPreview){
    if(!revision||pending.current.has(preview.id)||events[preview.id]?.status==="ready")return;
    pending.current.add(preview.id);setEvents(previous=>({...previous,[preview.id]:{status:"loading"}}));
    try{
      const response=await fetch(`/api/public/v1/changes/events/${revision}/${slug}.json?eventRevision=${encodeURIComponent(preview.revision)}`,{cache:"no-store"});
      if(!response.ok)throw Error("Unavailable");
      const value=await response.json() as ChangeEvent;
      if(value.id!==preview.id||value.slug!==slug||value.revision!==preview.revision||value.rulesVersion!==CHANGE_RULES_VERSION||!Array.isArray(value.items))throw Error("Foreign event");
      setEvents(previous=>({...previous,[preview.id]:{status:"ready",event:value}}));
    }catch{setEvents(previous=>({...previous,[preview.id]:{status:"failed"}}));}finally{pending.current.delete(preview.id);}
  }
  // Native disclosures can be opened before React attaches onToggle. Honor that
  // intent once hydrated, rather than leaving the initial loading text forever.
  useEffect(()=>{
    for(const detail of root.current?.querySelectorAll<HTMLDetailsElement>(".v6-changes-event[open]")??[]){
      const id=detail.closest<HTMLElement>("li[data-event-id]")?.dataset.eventId;
      const preview=initial.status==="ready"?initial.overview.timeline.find(value=>value.id===id):undefined;
      if(preview)void loadEvent(preview);
    }
    // This is the mount-time native state handoff; later toggles use onToggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  function eventDetails(event:ChangeEvent){
    return <ChangeEventContent event={event} items={event.items.filter(item=>isPrimary(item.category))} locale={locale} themeOrder={themeOrder} heldHref={hasHeldRecords?"#v6-held-public-claims":undefined}/>;
  }
  return <details id="record-changes" ref={root} className="v6-changes">
    <summary><span className="v6-changes-title">{copy.title}</span><span className="v6-changes-meta">{preset==="90"?copy.recent:preset==="30"?copy.days30:copy.custom}{selection&&selection.kind!=="invalid"&&selection.kind!=="before"?` · ${copy.count.replace("{n}",String(selection.count))}`:""}</span></summary>
    <div className="v6-changes-body">
      <p>{copy.scope}</p>
      <div className="v6-changes-filters" role="group" aria-label={copy.custom}>{([['30',copy.days30],['90',copy.recent],['custom',copy.custom]] as const).map(([value,label])=><button key={value} type="button" aria-pressed={preset===value} onClick={()=>{setPreset(value);if(value!=="custom")setRange(changeWindow(today,Number(value) as 30|90));}}>{label}</button>)}</div>
      {preset==="custom"?<div className="v6-changes-dates"><label>{copy.start}<input type="date" value={range.start} onChange={e=>setRange({...range,start:e.target.value})}/></label><label>{copy.end}<input type="date" value={range.end} onChange={e=>setRange({...range,end:e.target.value})}/></label></div>:null}
      <div aria-live="polite" aria-atomic="true" className="v6-changes-status">{overview.status!=="ready"?<><p>{overview.status==="failed"?copy.failed:copy.unavailable}</p>{revision?<button type="button" disabled={retrying} onClick={retryOverview}>{retrying?copy.loading:copy.retry}</button>:null}</>:selection?.kind==="invalid"?<p role="alert">{copy.invalid}</p>:selection?<>{selection.kind==="before"?<p>{copy.before}</p>:null}{selection.kind==="partial"?<p>{copy.partial.replace("{date}",selection.from??"")}</p>:null}{selection.kind==="empty"||selection.kind==="partial"&&!selection.count?<p>{copy.empty}</p>:null}{selection.undated?<p>{copy.undated}</p>:null}</>:null}</div>
      {selection&&selection.kind!=="invalid"&&selection.previews.length?<ol className="v6-changes-timeline">{selection.previews.map(preview=>{const state=events[preview.id];return <li key={preview.id} data-event-id={preview.id}><div className="v6-changes-meta"><time dateTime={preview.publishedAt??undefined}>{date(preview.publishedAt)}</time><span>{preview.categories.filter(isPrimary).map(category).join(" · ")}</span></div><p className="v6-changes-preview">{preview.themes.length?previewThemes(preview.themes):copy.other}<span> · {preview.counts.affected?changeCountsText(preview.counts,locale):preview.categories.filter(isPrimary).map(category).join(" · ")||copy.other}</span></p><details className="v6-changes-event" onToggle={e=>{if(e.currentTarget.open)void loadEvent(preview);}}><summary>{copy.details}</summary><div aria-live="polite">{!state||state.status==="loading"?<p>{copy.loading}</p>:state.status==="failed"?<><p>{copy.detailFailed}</p><button type="button" onClick={()=>void loadEvent(preview)}>{copy.retry}</button><a href={withLocalePrefix(preview.url,locale)}>{copy.full}</a></>:eventDetails(state.event)}</div></details></li>;})}</ol>:null}
      <footer>{overview.status==="ready"&&overview.overview.gaps.length?<p className="v6-changes-meta">{copy.gaps}</p>:null}<a href={withLocalePrefix(`/changes/${slug}`,locale)}>{copy.all}</a><a href="#claims">{copy.current}</a><p className="v6-changes-meta">{copy.sourceOnly}</p></footer>
    </div>
  </details>;
}
