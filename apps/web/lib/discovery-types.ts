export interface DiscoveryUniversity {
  slug: string;
  name: string;
  country?: string;
  region?: string;
  lastCheckedAt?: string;
  summary?: string;
  topics?: string[];
  relevance?: number;
}
export interface DiscoveryEvidence {
  id: string;
  slug: string;
  universityName: string;
  country?: string;
  topic: string;
  topics?: string[];
  claimText: string;
  snippet: string;
  official: boolean;
  sourceUrl: string;
  sourceTitle: string;
  sourceLanguage?: string;
  claimUrl: string;
}
