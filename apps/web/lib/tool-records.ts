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
  const summary = await getStagedPublicSummaryBySlug(slug);

  return summary ? deriveUniversityToolRecordsForSummary(summary) : [];
}

export async function getAllUniversityToolRecords(): Promise<
  UniversityToolRecord[]
> {
  return deriveUniversityToolRecords(await getStagedPublicSummaries());
}

export async function getPublicToolsResponse(): Promise<PublicToolsResponse> {
  return buildPublicToolsResponse(
    await getAllUniversityToolRecords(),
    getSiteBaseUrl()
  );
}
