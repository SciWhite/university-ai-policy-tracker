import {readV6RecordCorrections} from "./v6-effective-records";
import { deriveUniversityToolRecordsForSummary, type PublicEntitySummary } from "@uapt/shared";
import type { PageToolRecord } from "@/components/university-ai-tools";
import { readContentJson } from "./content-runtime";

/** Public page additions are limited to three reviewed source sets; public API records stay unchanged. */
export async function getUniversityToolRecords(summary: PublicEntitySummary): Promise<PageToolRecord[]> {
  const corrected=readV6RecordCorrections()?.toolsBySlug[summary.entity.slug];
  if(corrected)return structuredClone(corrected);
  const records: PageToolRecord[] = deriveUniversityToolRecordsForSummary(summary);
  const additions = readContentJson<Record<string, PageToolRecord[]>>("data/university-tools-published-supplements.json")[summary.entity.slug] ?? [];
  for (const record of additions) {
    if (!records.some((existing) => existing.rawToolName.toLowerCase() === record.rawToolName.toLowerCase())) {
      records.push(record);
    }
  }
  return records;
}
