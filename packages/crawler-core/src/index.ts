export type FetchMode = "http" | "playwright" | "opencli" | "firecrawl";

export interface CrawlTarget {
  url: string;
  universitySlug?: string;
  fetchMode?: FetchMode;
  expectedThemes?: string[];
}

export interface CrawlResult {
  target: CrawlTarget;
  finalUrl?: string;
  httpStatus?: number;
  fetchedAt: string;
  contentHash?: string;
  normalizedText?: string;
  failureReason?: string;
}

export function normalizePolicyText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function shouldExtract(previousHash: string | null, nextHash: string): boolean {
  return previousHash !== nextHash;
}
