import { contentScoped, readContentJson } from "./content-runtime";

export interface SupplementRecord {
  key: string;
  slug: string;
  collection: string;
  traceable: true;
  semanticReview: "prior_local_review_retained" | "current_local_source_review";
  fact: {
    id: string;
    statement: string;
    topic: string;
    modality: string;
    appliesToAI?: string;
    aiBridge?: string | null;
    deadline?: unknown;
    scope: {
      audience?: string;
      level?: string;
      unit?: string;
      qualifiers?: string[];
    };
    evidence: {
      sourceLanguage?: string;
      sourceUrl: string;
      quote: string;
      sourceSnapshotHash: string;
      lineStart: number;
      lineEnd: number;
      retrievedAt: string;
    }[];
    localSummary?: Record<string, string>;
    emphasis?: Partial<Record<string, string[]>>;
    translationSourceHash?: string;
  };
}

// Reviewed admitted-record whitelist; ships in the content release (data/).
const records = () => readContentJson<SupplementRecord[]>("data/policy-supplements-approved.json");

/** Only the fixed 2026-10-07 admitted-record whitelist is available to public pages. */
export function getApprovedPolicySupplements(slug: string): SupplementRecord[] {
  return records().filter((record) => record.slug === slug);
}

export const approvedPolicySupplementSlugs = (): string[] => contentScoped("policy-supplement-slugs", () => [...new Set(records().map((record) => record.slug))]);
