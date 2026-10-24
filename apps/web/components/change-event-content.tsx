import {changeItemsText} from "@/lib/change-counts-copy";
import React from "react";
import type {ChangeItem} from "@/lib/change-events";
import {withLocalePrefix,type SupportedLocale} from "@/lib/i18n";
import {changeCategoryKeys,historicalChangeTopicOrder,v6ChangesCopy,v6ChangeTopicTitle} from "@/lib/v6-changes-copy";
import type {SummaryChangeEvent} from "@/lib/change-summary-types";
import {ChangeStudentSummary} from "./change-student-summary";

/** The compact module, school history and frozen revision share one text/evidence renderer. */
export function ChangeEventContent({event,items=event.items,locale,themeOrder=[],activeTopic,heldHref,showRevisionLink=true}:{
  event:SummaryChangeEvent;items?:ChangeItem[];locale:SupportedLocale;themeOrder?:string[];activeTopic?:string;heldHref?:string;showRevisionLink?:boolean;
}){
  const copy=v6ChangesCopy(locale);
  const category=(key:string)=>copy.categories[changeCategoryKeys.indexOf(key as typeof changeCategoryKeys[number])]??copy.other;
  const order=[...themeOrder,...historicalChangeTopicOrder];
  const topic=(item:ChangeItem)=>activeTopic&&activeTopic!=="all"?activeTopic:item.theme;
  const keys=[...new Set(items.map(topic))].sort((a,b)=>{const ia=order.indexOf(a),ib=order.indexOf(b);return (ia<0?999:ia)-(ib<0?999:ib)||a.localeCompare(b);});
  function text(item:ChangeItem){
    if(item.category==="held")return <><p>{copy.retained}</p>{item.oldText?<p lang="en" data-i18n="preserve">{item.oldText}</p>:null}{heldHref?<a href={heldHref}>{copy.held}</a>:null}</>;
    if(item.comparison==="exact_claim_id"&&item.oldText&&item.newText&&item.oldText!==item.newText)return <details className="v6-changes-text"><summary>{copy.diff}</summary>
      <div className="v6-changes-line v6-changes-line--remove"><span aria-hidden="true">−</span><div><strong>{copy.old}</strong><p lang="en" data-i18n="preserve">{item.oldText}</p></div></div>
      <div className="v6-changes-line v6-changes-line--add"><span aria-hidden="true">+</span><div><strong>{copy.next}</strong><p lang="en" data-i18n="preserve">{item.newText}</p></div></div>
    </details>;
    if(item.category==="tracker_addition"&&item.newText)return <details className="v6-changes-text"><summary>{copy.added}</summary><div className="v6-changes-line v6-changes-line--add"><span aria-hidden="true">+</span><p lang="en" data-i18n="preserve">{item.newText}</p></div></details>;
    return <><p>{copy.noText}</p>{item.oldText?<div><strong>{copy.old}</strong><p lang="en" data-i18n="preserve">{item.oldText}</p></div>:null}{item.newText?<div><strong>{copy.next}</strong><p lang="en" data-i18n="preserve">{item.newText}</p></div>:null}</>;
  }
  return <div className="v6-changes-event-body">
    <ChangeStudentSummary event={event} items={items} locale={locale}/>
    {keys.map(key=>{const grouped=items.filter(item=>topic(item)===key);return <details key={key} className="v6-changes-topic"><summary>{v6ChangeTopicTitle(key,locale)} · {changeItemsText(grouped,locale)}</summary>
      {grouped.map(item=><article key={item.id}><p className="v6-changes-meta">{category(item.category)}</p>{text(item)}{item.sourceUrls.length?<ul className="v6-changes-evidence">{[...new Set(item.sourceUrls)].filter(url=>/^https?:\/\//.test(url)).map((url,i)=><li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{copy.evidence} {i+1} ↗</a></li>)}</ul>:null}</article>)}
    </details>;})}
    {event.gaps.length?<p>{copy.gaps}</p>:null}
    {showRevisionLink?<a href={withLocalePrefix(event.url,locale)}>{copy.full}</a>:null}
  </div>;
}
