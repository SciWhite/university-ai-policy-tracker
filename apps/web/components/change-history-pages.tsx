import React from "react";
import type {SupportedLocale} from "@/lib/i18n";
import {withLocalePrefix} from "@/lib/i18n";
import {getChangeHistoryView} from "@/lib/change-history-view";
import {changeHistoryCopy} from "@/lib/change-history-copy";
import {v6ChangesCopy} from "@/lib/v6-changes-copy";
import {getAbsoluteSiteUrl} from "@/lib/site-url";
import {formatDateMedium} from "@/lib/format-date";
import {JsonLd} from "./json-ld";
import {ChangeHistoryBrowser} from "./change-history-browser";
import {ChangeEventContent} from "./change-event-content";

export async function SchoolChangeHistoryPage({slug,locale}:{slug:string;locale:SupportedLocale}){
  const view=await getChangeHistoryView(slug,locale);
  if(!view)return null;
  const ui=changeHistoryCopy(locale),copy=v6ChangesCopy(locale);
  const dates=view.history.events.flatMap(e=>e.publishedAt?[e.publishedAt]:[]).sort((a,b)=>Date.parse(b)-Date.parse(a));
  const canonical=getAbsoluteSiteUrl(withLocalePrefix(`/changes/${slug}`,locale));
  return <main className="page-shell page-shell--wide change-history-page">
    {/* Existing fragment URLs remain usable; aliases are not new dated events. */}
    {["v6-page-supplement-release","v6-homepage-links-20261015","v6-compact-20261015",...(slug==="massachusetts-institute-of-technology"?["mit-v6-student-actions-20261015"]:[]),...(slug==="imperial-college-london"?["imperial-v6-balance-20261015","imperial-v6-refine-20261015","imperial-v6-ux-20261015"]:[])].map(id=><span key={id} id={id} className="change-history-legacy-anchor"/>)}
    <JsonLd data={{"@context":"https://schema.org","@type":"WebPage",name:`${view.name} — ${ui.history}`,description:copy.scope,url:canonical,inLanguage:locale,mainEntity:{"@type":"Dataset",name:`${view.name} — ${ui.history}`,description:copy.scope,url:canonical,isAccessibleForFree:true,distribution:{"@type":"DataDownload",name:ui.json,encodingFormat:"application/json",contentUrl:getAbsoluteSiteUrl(`/api/public/v1/changes/events/${view.history.revision}/${slug}.json`)}},...(dates[0]?{dateModified:dates[0]}:{})}}/>
    <header className="entity-header"><div className="entity-header__main"><p className="entity-header__eyebrow">{ui.history}</p><h1 data-i18n="preserve">{view.name}</h1><p>{copy.scope}</p><p className="v6-changes-meta">{ui.scope}</p></div><div className="entity-header__actions">{view.universityAvailable?<a className="site-action" href={withLocalePrefix(`/universities/${slug}`,locale)}>{ui.university}</a>:null}<a className="site-action" href={withLocalePrefix("/changes",locale)}>{copy.title}</a></div></header>
    <ChangeHistoryBrowser history={view.history} locale={locale} heldHref={view.heldHref} universityAvailable={view.universityAvailable}/>
  </main>;
}

export async function ChangeRevisionPage({slug,revision,locale}:{slug:string;revision:string;locale:SupportedLocale}){
  const view=await getChangeHistoryView(slug,locale),event=view?.history.events.find(e=>e.revision===revision);
  if(!view||!event)return null;
  const ui=changeHistoryCopy(locale),copy=v6ChangesCopy(locale);
  return <main className="page-shell page-shell--wide change-history-page">
    <JsonLd data={{"@context":"https://schema.org","@type":"WebPage",name:`${view.name} — ${ui.revision}`,description:copy.scope,url:getAbsoluteSiteUrl(withLocalePrefix(event.url,locale)),inLanguage:locale,...(event.publishedAt?{dateModified:event.publishedAt}:{})}}/>
    <header className="entity-header"><div className="entity-header__main"><p className="entity-header__eyebrow">{ui.revision}</p><h1 data-i18n="preserve">{view.name}</h1><p>{copy.scope}</p><p>{ui.scope}</p><p className="v6-changes-meta">{ui.revisionId}: <span data-i18n="preserve">{event.revision}</span>{event.publishedAt?<> · <time dateTime={event.publishedAt}>{formatDateMedium(event.publishedAt,locale)}</time></>:null}</p>{event.previousRevision?<p className="v6-changes-meta">{ui.prior}: <span data-i18n="preserve">{event.previousRevision}</span></p>:null}</div><div className="entity-header__actions"><a className="site-action" href={withLocalePrefix(`/changes/${slug}`,locale)}>{copy.all}</a>{view.universityAvailable?<a className="site-action" href={withLocalePrefix(`/universities/${slug}`,locale)}>{ui.university}</a>:null}</div></header>
    <div className="v6-changes"><div className="v6-changes-body"><ChangeEventContent event={event} locale={locale} themeOrder={view.history.themeOrder} heldHref={view.heldHref} showRevisionLink={false}/><footer><a href={`/api/public/v1/changes/events/${view.history.revision}/${slug}.json?eventRevision=${encodeURIComponent(revision)}`}>{ui.json}</a></footer></div></div>
  </main>;
}
