import { deriveUniversityToolRecordsForSummary, type PublicEntitySummary } from "@uapt/shared";
import type { PageToolRecord } from "@/components/university-ai-tools";
import publishedSupplements from "./university-tools-published-supplements.json";

/** Public page additions are limited to three reviewed source sets; public API records stay unchanged. */
export async function getUniversityToolRecords(summary: PublicEntitySummary): Promise<PageToolRecord[]> {
  const records: PageToolRecord[] = deriveUniversityToolRecordsForSummary(summary);
  const additions = (publishedSupplements as unknown as Record<string, PageToolRecord[]>)[summary.entity.slug] ?? [];
  for (const record of additions) {
    if (!records.some((existing) => existing.rawToolName.toLowerCase() === record.rawToolName.toLowerCase())) {
      records.push(record);
    }
  }
  return records;
}
