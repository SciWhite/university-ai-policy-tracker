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

export function formatSchoolChangeDescription(displayName: string, releaseId: string, locale: SupportedLocale): string {
  if (locale === "zh") {
    const desc = `${displayName} 在版本 ${releaseId} 的 AI 政策变更记录、审核状态及已核验原始依据。`;
    return desc.length >= 50 ? desc : `${displayName} 在 University AI Policy Tracker 版本 ${releaseId} 的政策变更记录与已核验依据。`;
  }
  const desc = `Reviewed policy change records and dated evidence for ${displayName} in tracker release ${releaseId}.`;
  if (desc.length > 170) {
    const shortDesc = `Policy change records for ${displayName} in release ${releaseId}.`;
    return shortDesc.length > 170 ? shortDesc.slice(0, 167) + "..." : shortDesc;
  }
  if (desc.length < 50) {
    return `Reviewed university AI policy change records for ${displayName} in release ${releaseId}.`;
  }
  return desc;
}

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
  const description = eventRevision
    ? formatSchoolChangeDescription(view.name, eventRevision, locale)
    : v6ChangesCopy(locale).scope;
  return {title,description,alternates:getLocalizedAlternates(path,locale),openGraph:{title,description,url:getAbsoluteSiteUrl(withLocalePrefix(path,locale)),type:"article" as const}};
}
