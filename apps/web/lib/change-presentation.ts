import type { ChangeRecord, DiffPreviewLine } from "./change-records";
import type { SupportedLocale } from "./i18n";

/** Historical objects stay immutable; locale selection happens on a read copy. */
export function selectChangeSummary(value: unknown, locale: SupportedLocale = "en"): { text: string; language: string } | undefined {
  if (typeof value === "string") return { text: value, language: "en" };
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const copy = value as Record<string, unknown>;
  for (const language of [...new Set([locale, "en", "zh"])]) {
    if (typeof copy[language] === "string" && copy[language].trim()) {
      return { text: copy[language], language };
    }
  }
  return undefined;
}

export interface CorrectionIds {
  addedClaimIds: string[];
  updatedClaimIds: string[];
  heldClaimIds: string[];
}

/** Counts are per Claim ID, not the sum of overlapping evidence/metadata counters. */
export function countCorrectionIds(changes: CorrectionIds) {
  const added = new Set(changes.addedClaimIds);
  const updated = new Set(changes.updatedClaimIds.filter(id => !added.has(id)));
  const held = new Set(changes.heldClaimIds);
  return {
    added: added.size,
    modified: updated.size,
    held: held.size,
    affected: new Set([...added, ...updated, ...held]).size,
    changedCurrentIds: new Set([...added, ...updated])
  };
}

export function hasRecordedChanges(record: Pick<ChangeRecord, "diffRows" | "added" | "modified" | "trackerRemovedClaims" | "sourceAdded" | "sourceRemoved" | "sourceSnapshotChanged">): boolean {
  return Boolean(record.diffRows.length || record.added || record.modified || record.trackerRemovedClaims ||
    record.sourceAdded || record.sourceRemoved || record.sourceSnapshotChanged);
}

/** A Claim comparison is not a document with line numbers. No fuzzy pairing,
 * evidence-only rows, cached preview fallback, or current-record-as-insert.
 * Scoped corrections without recorded rows remain text-comparison unavailable.
 */
export function exactClaimDiffLines(record: Pick<ChangeRecord, "publicationKind" | "diffRows">): DiffPreviewLine[] {
  if (record.publicationKind === "scoped_record_correction") return [];
  return record.diffRows.flatMap(row => {
    if (row.changeType !== "claim_modified" || row.matchMethod !== "claim_id" ||
      !row.oldClaim?.claimId || row.oldClaim.claimId !== row.newClaim?.claimId ||
      row.oldClaim.claimText === row.newClaim.claimText) return [];
    return [
      { type: "delete" as const, value: row.oldClaim.claimText },
      { type: "insert" as const, value: row.newClaim.claimText }
    ];
  });
}
