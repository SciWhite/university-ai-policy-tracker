import { INDEX_RECOVERY_CONTENT_VERSION } from "./index-recovery-pilot";
import { getPublicUniversitySummaryBySlug, getCatalogUniversityBySlug } from "./catalog";
import { getLoadedPolicySnapshotBySlug } from "./policy-snapshots";

/** Only substantive changes; checking/retrieval/release timestamps are not inputs. */
export function indexRecoveryContentDate(changedDates: Array<string | undefined>, snapshotGeneratedAt?: string): Date {
  const dates = [INDEX_RECOVERY_CONTENT_VERSION, ...changedDates, snapshotGeneratedAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value)).filter(Number.isFinite);
  return new Date(Math.max(...dates));
}

export async function getIndexRecoveryLastModified(slug: string): Promise<Date> {
  const [summary, loaded, university] = await Promise.all([
    getPublicUniversitySummaryBySlug(slug), getLoadedPolicySnapshotBySlug(slug),
    getCatalogUniversityBySlug(slug)
  ]);
  // Do not use aggregate summary dates: some producers substitute check dates.
  return indexRecoveryRecordDate([
    ...(university?.sources ?? []), ...(summary?.claims ?? [])
  ], loaded?.validation.effectiveStatus === "strong" ? loaded.snapshot.generatedAt : undefined);
}

export function indexRecoveryRecordDate(
  records: Array<{ lastChangedAt?: string; lastCheckedAt?: string }>,
  snapshotGeneratedAt?: string
): Date {
  return indexRecoveryContentDate(records.map((record) => record.lastChangedAt), snapshotGeneratedAt);
}
