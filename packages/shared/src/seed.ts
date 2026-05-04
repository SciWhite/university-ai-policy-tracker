import type { SeedUniversity } from "./schemas";

export const seedUniversities: SeedUniversity[] = [
  {
    slug: "harvard",
    name: "Harvard University",
    country: "United States",
    region: "Massachusetts",
    website: "https://www.harvard.edu",
    summary:
      "Seed placeholder for university-wide and unit-level AI policy tracking.",
    sources: [
      {
        title: "Generative AI guidance placeholder",
        url: "https://www.harvard.edu",
        documentStatus: "specific_unit_policy_or_guidance",
        serviceTreatment: "conditionally_allowed",
        reviewState: "needs_review",
        themes: ["academic_integrity", "teaching", "privacy"],
        tools: ["chatgpt", "microsoft_copilot"],
        lastCheckedAt: "2026-05-03T00:00:00.000Z"
      }
    ]
  },
  {
    slug: "mit",
    name: "Massachusetts Institute of Technology",
    country: "United States",
    region: "Massachusetts",
    website: "https://www.mit.edu",
    summary:
      "Seed placeholder for source-backed AI policy status and change history.",
    sources: [
      {
        title: "Academic integrity and AI placeholder",
        url: "https://www.mit.edu",
        documentStatus: "specific_unit_policy_or_guidance",
        serviceTreatment: "not_mentioned",
        reviewState: "needs_review",
        themes: ["academic_integrity", "research"],
        tools: ["chatgpt", "deepseek"],
        lastCheckedAt: "2026-05-03T00:00:00.000Z"
      }
    ]
  },
  {
    slug: "stanford",
    name: "Stanford University",
    country: "United States",
    region: "California",
    website: "https://www.stanford.edu",
    summary:
      "Seed placeholder for academic integrity, privacy, and classroom AI guidance tracking.",
    sources: [
      {
        title: "AI teaching guidance placeholder",
        url: "https://www.stanford.edu",
        documentStatus: "specific_unit_policy_or_guidance",
        serviceTreatment: "conditionally_allowed",
        reviewState: "needs_review",
        themes: ["teaching", "academic_integrity", "copyright"],
        tools: ["chatgpt", "gemini"],
        lastCheckedAt: "2026-05-04T00:00:00.000Z"
      }
    ]
  },
  {
    slug: "university-of-toronto",
    name: "University of Toronto",
    country: "Canada",
    region: "Ontario",
    website: "https://www.utoronto.ca",
    summary:
      "Seed placeholder for institutional AI services, privacy, and teaching policy tracking.",
    sources: [
      {
        title: "Institutional AI services placeholder",
        url: "https://www.utoronto.ca",
        documentStatus: "specific_unit_policy_or_guidance",
        serviceTreatment: "conditionally_allowed",
        reviewState: "needs_review",
        themes: ["privacy", "data_entry", "security_review", "teaching"],
        tools: ["microsoft_copilot", "institutional_ai_service"],
        lastCheckedAt: "2026-05-03T00:00:00.000Z"
      }
    ]
  },
  {
    slug: "oxford",
    name: "University of Oxford",
    country: "United Kingdom",
    region: "England",
    website: "https://www.ox.ac.uk",
    summary:
      "Seed placeholder for university guidance, research use, and data-entry policy tracking.",
    sources: [
      {
        title: "Generative AI policy placeholder",
        url: "https://www.ox.ac.uk",
        documentStatus: "specific_unit_policy_or_guidance",
        serviceTreatment: "not_mentioned",
        reviewState: "needs_review",
        themes: ["research", "data_entry", "privacy"],
        tools: ["chatgpt", "claude"],
        lastCheckedAt: "2026-05-04T00:00:00.000Z"
      }
    ]
  }
];

export function findSeedUniversity(slug: string): SeedUniversity | undefined {
  return seedUniversities.find((university) => university.slug === slug);
}
