import {readV6RecordCorrections} from "@/lib/v6-effective-records";
import React from "react";
import type { SupportedLocale } from "@/lib/i18n";
import { loadSelectedChangeOverview } from "@/lib/change-events-api";
import { PolicyV6ChangesClient } from "./policy-v6-changes-client";

export async function PolicyV6Changes({slug,recordSha256,locale}:{slug:string;recordSha256?:string;locale:SupportedLocale}) {
  const today=new Date().toISOString().slice(0,10);
  const initial=await loadSelectedChangeOverview(slug,recordSha256);
  return <PolicyV6ChangesClient key={`${slug}:${recordSha256}`} slug={slug} recordSha256={recordSha256} locale={locale} today={today} initial={initial} hasHeldRecords={Boolean(readV6RecordCorrections()?.heldBySlug[slug]?.length)}/>;
}
