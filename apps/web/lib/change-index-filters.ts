import type {
  ChangeIndexRecord,
  ChangeIndexSourceHealthSeverity
} from "@/lib/change-records";
import { normalizeForSearch, textMatchesNormalized } from "@/lib/search-text";

export type ChangeSortKey =
  | "changed"
  | "checked"
  | "claims"
  | "sources"
  | "firstSeen";
export type ChangeReviewFilter =
  | "all"
  | "agent_reviewed"
  | "human_reviewed"
  | "machine_candidate"
  | "needs_review"
  | "rejected";
export type ChangeSourceHealthFilter = "all" | ChangeIndexSourceHealthSeverity;

export interface ChangeIndexFilters {
  q: string;
  review: ChangeReviewFilter;
  sort: ChangeSortKey;
  sourceHealth: ChangeSourceHealthFilter;
  theme: string;
}

export const defaultChangeIndexFilters: ChangeIndexFilters = {
  q: "",
  review: "all",
  sort: "changed",
  sourceHealth: "all",
  theme: ""
};

export function parseChangeIndexFilters(
  params: URLSearchParams
): ChangeIndexFilters {
  return {
    q: (params.get("q") ?? "").trim(),
    review: normalizeChangeReviewFilter(params.get("review") ?? ""),
    sort: normalizeChangeSortKey(params.get("sort") ?? ""),
    sourceHealth: normalizeChangeSourceHealthFilter(params.get("sourceHealth") ?? ""),
    theme: (params.get("theme") ?? "").trim()
  };
}

export function isDefaultChangeIndexFilters(
  filters: ChangeIndexFilters
): boolean {
  return (
    !filters.q &&
    !filters.theme &&
    filters.review === defaultChangeIndexFilters.review &&
    filters.sort === defaultChangeIndexFilters.sort &&
    filters.sourceHealth === defaultChangeIndexFilters.sourceHealth
  );
}

export function filterChangeIndexRecords(
  records: ChangeIndexRecord[],
  filters: ChangeIndexFilters
): ChangeIndexRecord[] {
  const normalizedQuery = normalizeForSearch(filters.q);

  return records
    .filter((record) => {
      if (filters.review !== "all" && record.reviewState !== filters.review) {
        return false;
      }

      if (
        filters.sourceHealth !== "all" &&
        record.sourceHealth !== filters.sourceHealth
      ) {
        return false;
      }

      if (
        filters.theme &&
        !record.themes.some((theme) => theme.theme === filters.theme)
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const searchable = [
        record.name,
        record.summary,
        record.sourceHealthLabel,
        record.themes.map((theme) => theme.label).join(" "),
        record.primaryDiff?.changeExplanation,
        record.primaryDiff?.oldClaimText,
        record.primaryDiff?.newClaimText
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ");

      return textMatchesNormalized(searchable, normalizedQuery);
    })
    .sort((left, right) => compareChangeIndexRecords(left, right, filters.sort));
}

export function compareChangeIndexRecords(
  left: ChangeIndexRecord,
  right: ChangeIndexRecord,
  sort: ChangeSortKey
): number {
  switch (sort) {
    case "checked":
      return compareDate(
        right.lastCheckedAt ?? right.lastChangedAt ?? right.firstSeenAt,
        left.lastCheckedAt ?? left.lastChangedAt ?? left.firstSeenAt
      );
    case "claims":
      return (
        right.claimCount - left.claimCount ||
        compareDate(
          right.lastChangedAt ?? right.lastCheckedAt ?? right.firstSeenAt,
          left.lastChangedAt ?? left.lastCheckedAt ?? left.firstSeenAt
        )
      );
    case "sources":
      return (
        right.sourceCount - left.sourceCount ||
        compareDate(
          right.lastChangedAt ?? right.lastCheckedAt ?? right.firstSeenAt,
          left.lastChangedAt ?? left.lastCheckedAt ?? left.firstSeenAt
        )
      );
    case "firstSeen":
      return compareDate(right.firstSeenAt, left.firstSeenAt);
    case "changed":
    default:
      return compareDate(
        right.lastChangedAt ?? right.lastCheckedAt ?? right.firstSeenAt,
        left.lastChangedAt ?? left.lastCheckedAt ?? left.firstSeenAt
      );
  }
}

export interface ChangeIndexVisibleSummary {
  claimCount: number;
  newlyExtractedClaimsCount: number;
  policyTextChangedCount: number;
  recordCount: number;
  reviewedClaimCount: number;
  sourceHealthIssueCount: number;
  sourceSnapshotChangedCount: number;
  sourceTextChangedCount: number;
}

export function summarizeChangeIndexRecords(
  records: ChangeIndexRecord[]
): ChangeIndexVisibleSummary {
  return {
    claimCount: records.reduce((total, record) => total + record.claimCount, 0),
    newlyExtractedClaimsCount: records.reduce(
      (total, record) => total + record.newlyExtractedClaims,
      0
    ),
    policyTextChangedCount: records.reduce(
      (total, record) => total + record.policyTextChanged,
      0
    ),
    recordCount: records.length,
    reviewedClaimCount: records.reduce(
      (total, record) => total + record.reviewedClaimCount,
      0
    ),
    sourceHealthIssueCount: records.filter(
      (record) => record.sourceHealth !== "healthy"
    ).length,
    sourceSnapshotChangedCount: records.reduce(
      (total, record) => total + record.sourceSnapshotChanged,
      0
    ),
    sourceTextChangedCount: records.reduce(
      (total, record) => total + record.sourceTextChanged,
      0
    )
  };
}

export function formatChangeReviewStateLabel(reviewState: string): string {
  switch (reviewState) {
    case "agent_reviewed":
      return "Agent reviewed";
    case "human_reviewed":
      return "Human reviewed";
    case "machine_candidate":
      return "Machine candidate";
    case "needs_review":
      return "Needs review";
    case "rejected":
      return "Rejected";
    default:
      return reviewState;
  }
}

export function formatChangeSourceHealthLabel(value: string): string {
  switch (value) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
    case "unknown":
      return "Unknown";
    default:
      return value;
  }
}

export function normalizeChangeSortKey(value: string): ChangeSortKey {
  switch (value.trim()) {
    case "checked":
    case "claims":
    case "sources":
    case "firstSeen":
      return value.trim() as ChangeSortKey;
    default:
      return defaultChangeIndexFilters.sort;
  }
}

export function normalizeChangeReviewFilter(value: string): ChangeReviewFilter {
  switch (value.trim()) {
    case "agent_reviewed":
    case "human_reviewed":
    case "machine_candidate":
    case "needs_review":
    case "rejected":
      return value.trim() as ChangeReviewFilter;
    default:
      return "all";
  }
}

export function normalizeChangeSourceHealthFilter(value: string): ChangeSourceHealthFilter {
  switch (value.trim()) {
    case "healthy":
    case "warning":
    case "error":
    case "unknown":
      return value.trim() as ChangeSourceHealthFilter;
    default:
      return "all";
  }
}

function compareDate(left?: string, right?: string): number {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return leftTime - rightTime;
}
