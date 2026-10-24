import type {Metadata} from "next";
import {getAbsoluteSiteUrl} from "./site-url";
import {cache} from "react";
import {getCatalogUniversityBySlug} from "./catalog";
import {getLocalizedInstitutionName} from "./institution-localization";
import {loadSelectedChangeHistory,loadSelectedHistoricalName} from "./change-events-api";
import {readV6RecordCorrections} from "./v6-effective-records";
import {withLocalePrefix,type SupportedLocale} from "./i18n";
import {changeHistoryCopy} from "./change-history-copy";
import {v6ChangesCopy} from "./v6-changes-copy";
import {getLocalizedAlternates} from "./i18n-metadata";

export const getChangeHistoryView=cache(async(slug:string,locale:SupportedLocale)=>{
  const history=await loadSelectedChangeHistory(slug);
  if(!history)return undefined;
  const university=await getCatalogUniversityBySlug(slug);
  const universityAvailable=university?.slug===slug;
  const name=universityAvailable?university.name:await loadSelectedHistoricalName(slug);
  if(!name)throw Error("History university identity unavailable");
  return {history,name:getLocalizedInstitutionName(slug,name,locale),universityAvailable,heldHref:readV6RecordCorrections()?.heldBySlug[slug]?.length?withLocalePrefix(`/universities/${slug}`,locale)+"#v6-held-public-claims":undefined};
});
export async function changeHistoryMetadata(slug:string,locale:SupportedLocale,eventRevision?:string):Promise<Metadata|undefined>{
  const view=await getChangeHistoryView(slug,locale);
  if(!view)return undefined;
  const event=eventRevision?view.history.events.find(e=>e.revision===eventRevision):undefined;
  if(eventRevision&&!event)return undefined;
  const path=event?.url??`/changes/${slug}`,ui=changeHistoryCopy(locale);
  const title=`${view.name} — ${event?ui.revision:ui.history}${event?` · ${event.revision}`:""}`;
  return {title,description:v6ChangesCopy(locale).scope,alternates:getLocalizedAlternates(path,locale),openGraph:{title,description:v6ChangesCopy(locale).scope,url:getAbsoluteSiteUrl(withLocalePrefix(path,locale)),type:"article" as const}};
}
