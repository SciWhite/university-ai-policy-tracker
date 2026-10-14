import {readV6RecordCorrections} from "./v6-effective-records";
import {
  buildPublicToolsResponse,
  deriveUniversityToolRecords,
  deriveUniversityToolRecordsForSummary,
  type PublicToolsResponse,
  type UniversityToolRecord
} from "@uapt/shared";
import {
  getStagedPublicSummaries,
  getStagedPublicSummaryBySlug
} from "./staged-public-data";
import { getSiteBaseUrl } from "./site-url";

export async function getUniversityToolRecords(
  slug: string
): Promise<UniversityToolRecord[]> {
  const corrected = readV6RecordCorrections()?.toolsBySlug[slug];
  if (corrected) return structuredClone(corrected);
  const summary = await getStagedPublicSummaryBySlug(slug);

  return summary ? deriveUniversityToolRecordsForSummary(summary) : [];
}

export async function getAllUniversityToolRecords(): Promise<
  UniversityToolRecord[]
> {
  const correction=readV6RecordCorrections();
  const records=deriveUniversityToolRecords(await getStagedPublicSummaries());
  if(!correction)return records;
  const slugs=new Set(correction.summaries.map(s=>s.entity.slug));
  return [...records.filter(r=>!slugs.has(r.universitySlug)),...Object.values(correction.toolsBySlug).flat()];
}

export async function getPublicToolsResponse(): Promise<PublicToolsResponse> {
  return buildPublicToolsResponse(
    await getAllUniversityToolRecords(),
    getSiteBaseUrl()
  );
}
