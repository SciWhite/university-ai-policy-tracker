import {primaryChangeCategory} from "../lib/change-event-rules";
import React from "react";
import type {ChangeItem} from "@/lib/change-events";
import type {SummaryChangeEvent} from "@/lib/change-summary-types";
import {changeSummaryCopy} from "@/lib/change-summary-copy";
import {changeItemsText} from "@/lib/change-counts-copy";
import {v6ChangeTopicTitle,v6ChangesCopy} from "@/lib/v6-changes-copy";
import type {SupportedLocale} from "@/lib/i18n";

/** Published views require review; an explicitly enabled local candidate is labelled separately. */
export function ChangeStudentSummary({event,items,locale}:{event:SummaryChangeEvent;items:ChangeItem[];locale:SupportedLocale}){
  const copy=changeSummaryCopy(locale),selection=event.studentSummary;
  const primary=event.items.filter(item=>primaryChangeCategory(item.category));
  const visible=items.filter(item=>primaryChangeCategory(item.category));
  if(!visible.length)return null;
  const full=visible.length===primary.length&&primary.every(item=>visible.some(value=>value.id===item.id));
  const entries=(selection?.status==="ready"||selection?.status==="preview")&&full?selection.entries:undefined;
  const language=locale==="zh"&&entries?.zh?"zh":entries?.en?"en":entries?.zh?"zh":undefined;
  const reviewed=language&&entries?.[language];
  const preview=selection?.status==="preview";
  const themes=[...new Set(visible.flatMap(item=>item.themes??[item.theme]))];
  const countText=changeItemsText(visible,locale);
  return <section className="change-student-summary" aria-label={copy.title} data-summary-state={preview?"preview":reviewed?"ready":"template"}>
    <h3>{copy.title}</h3>
    {reviewed?<><p className="v6-changes-meta">{preview?copy.preview:copy.reviewed}{"review" in reviewed?<> · <time dateTime={reviewed.review.reviewedAt}>{reviewed.review.reviewedAt.slice(0,10)}</time></>:null}</p>{preview?<p>{copy.previewNotice}</p>:null}{language!==locale?<p className="v6-changes-meta">{copy.fallback.replace("{language}",language==="en"?copy.english:copy.chinese)}</p>:null}{([['whatChanged',copy.changed],['studentImpact',copy.impact],['basisAndScope',copy.scope]] as const).map(([key,label])=><div key={key}><strong>{label}</strong><p lang={language} data-i18n="preserve">{reviewed.text[key]}</p></div>)}<ul className="v6-changes-evidence">{[...new Set(reviewed.binding.items.flatMap(item=>item.sourceUrls))].filter(url=>/^https?:\/\//.test(url)).map((url,i)=><li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{v6ChangesCopy(locale).evidence} {i+1} ↗</a></li>)}</ul></>:<><p className="v6-changes-meta">{copy.template}</p><p>{countText}</p><p>{themes.slice(0,2).map(theme=>v6ChangeTopicTitle(theme,locale)).join(" · ")}{themes.length>2?` · ${v6ChangesCopy(locale).moreThemes.replace("{n}",String(themes.length-2))}`:""}</p><p className="v6-changes-meta">{selection?.status==="held"?copy.held:selection?.status==="stale"?copy.stale:selection?.status==="failed"?copy.failed:selection?.status==="preview"&&!full?copy.filteredPreview:selection?.status==="ready"&&!full?copy.filtered:copy.pending}</p></>}
    <p className="v6-changes-meta">{copy.historical}</p>
  </section>;
}
