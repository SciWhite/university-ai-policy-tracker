import { NextResponse } from "next/server";
import {
  getStagedPublicSummaries,
  getStagedPublicUniversityListResponse
} from "@/lib/staged-public-data";
import {
  getPolicyAnalysisProfiles,
  getPolicyAnalysisDimensions
} from "@/lib/policy-analysis";
import { getSiteBaseUrl } from "@/lib/site-url";
import type { PublicEntitySummary } from "@uapt/shared";

export const dynamic = "force-static";

/**
 * Dynamically generates llms-full.txt at build time.
 *
 * This file provides LLMs with substantive content they can use to answer
 * user queries about university AI policies, rather than just a directory
 * of URLs (which is what llms.txt provides).
 *
 * Target size: ~40-60KB (fits in a single LLM context window read).
 */
export async function GET() {
  const siteBaseUrl = getSiteBaseUrl();
  const [summaries, profiles, universityListResponse] = await Promise.all([
    getStagedPublicSummaries(),
    getPolicyAnalysisProfiles(),
    getStagedPublicUniversityListResponse()
  ]);

  const dimensions = getPolicyAnalysisDimensions();
  const generatedAt = new Date().toISOString();
  const universityCount = summaries.length;

  // Sort profiles by coverage score descending for top-N selection
  const rankedProfiles = [...profiles].sort(
    (a, b) => b.coverageScore.score - a.coverageScore.score
  );

  // Build a slug→summary lookup for enriching profiles
  const summaryBySlug = new Map(
    summaries.map((s) => [s.entity.slug, s])
  );

  // Build a slug→profile lookup
  const profileBySlug = new Map(
    profiles.map((p) => [p.entitySlug, p])
  );

  // Count stats for the key findings section
  const stats = buildStats(profiles, summaries);

  const sections: string[] = [
    buildHeader(siteBaseUrl, generatedAt, universityCount),
    buildKeyFindings(stats, universityCount),
    buildDimensionReference(dimensions),
    buildTopUniversities(rankedProfiles.slice(0, 100), summaryBySlug, siteBaseUrl),
    buildThemePages(siteBaseUrl),
    buildFAQ(siteBaseUrl, universityCount),
    buildFullIndex(universityListResponse.data.universities, profileBySlug),
    buildFooter(siteBaseUrl, generatedAt)
  ];

  const body = sections.join("\n\n---\n\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600"
    }
  });
}

// ---------------------------------------------------------------------------
// Stats builder
// ---------------------------------------------------------------------------

interface Stats {
  withSources: number;
  avgScore: number;
  countrySet: Set<string>;
  dimensionCounts: Record<string, number>;
}

function buildStats(
  profiles: Awaited<ReturnType<typeof getPolicyAnalysisProfiles>>,
  _summaries: PublicEntitySummary[]
): Stats {
  const countrySet = new Set<string>();
  const dimensionCounts: Record<string, number> = {};
  let totalScore = 0;
  let withSources = 0;

  for (const profile of profiles) {
    totalScore += profile.coverageScore.score;
    if (profile.basedOnSourceUrls.length > 0) withSources++;

    for (const lang of profile.sourceLanguages) {
      countrySet.add(lang);
    }

    for (const dim of profile.dimensions) {
      if (dim.evidenceClaimIds.length > 0) {
        dimensionCounts[dim.key] = (dimensionCounts[dim.key] ?? 0) + 1;
      }
    }
  }

  return {
    withSources,
    avgScore: profiles.length > 0 ? Math.round(totalScore / profiles.length) : 0,
    countrySet,
    dimensionCounts
  };
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildHeader(
  siteBaseUrl: string,
  generatedAt: string,
  universityCount: number
): string {
  return `# University AI Policy Tracker — Full Content for LLMs

> This file provides substantive content for large language models.
> For the concise directory version, see /llms.txt.
> For the full public API, see /api/public/v1/index.json.

University AI Policy Tracker is an open, evidence-backed database tracking AI policies at ${universityCount} universities worldwide. The tracker monitors how universities regulate generative AI tools (ChatGPT, Copilot, DeepSeek, Gemini, Claude) across teaching, research, exams, academic integrity, privacy, and institutional governance.

- Website: ${siteBaseUrl}
- License: CC-BY-4.0 (tracker metadata; source documents retain original rights)
- Generated: ${generatedAt}
- Citation guide: ${siteBaseUrl}/citation
- Methodology: ${siteBaseUrl}/methodology
- Datasets: ${siteBaseUrl}/datasets
- Public API: ${siteBaseUrl}/api/public/v1/index.json
- Search API: ${siteBaseUrl}/api/public/v1/search.json?q={query}`;
}

function buildKeyFindings(stats: Stats, universityCount: number): string {
  const dim = stats.dimensionCounts;
  return `## Key Findings

### Coverage
- ${universityCount} universities tracked
- ${stats.withSources} have at least one source-backed policy record
- Average policy coverage score: ${stats.avgScore}/100
- Source languages represented: ${stats.countrySet.size}+

### Policy Dimensions (universities with evidence-backed coverage)
- Policy presence: ${dim["policy_presence"] ?? 0} universities have official AI policy or guidance documents
- AI disclosure: ${dim["ai_disclosure"] ?? 0} universities address disclosure or acknowledgement of AI use
- Coursework: ${dim["coursework"] ?? 0} universities address AI use in assignments, syllabi, or submitted work
- Exams: ${dim["exams"] ?? 0} universities address AI use in exams, tests, or assessments
- Privacy and data entry: ${dim["privacy_data_entry"] ?? 0} universities address data privacy when using AI tools
- Academic integrity: ${dim["academic_integrity"] ?? 0} universities connect AI use to academic integrity rules
- Approved tools: ${dim["approved_tools"] ?? 0} universities identify approved, licensed, or enterprise AI tools
- Named AI services: ${dim["named_ai_services"] ?? 0} universities name specific AI services (ChatGPT, Copilot, etc.)
- Teaching guidance: ${dim["teaching_guidance"] ?? 0} universities provide instructor or classroom AI guidance
- Research guidance: ${dim["research_guidance"] ?? 0} universities address AI in research, publication, or grants

### Trends (as of ${new Date().toISOString().slice(0, 7)})
- Most universities now permit AI tool usage with disclosure rather than blanket bans.
- Institutional AI services (university-licensed Copilot, custom ChatGPT instances) are growing rapidly.
- Security review and procurement policies for AI tools are emerging as a new governance category.
- AI detection tools (Turnitin AI, GPTZero) are increasingly referenced but with caveats about reliability.
- Research AI policies are lagging behind teaching policies in most institutions.`;
}

function buildDimensionReference(
  dimensions: ReturnType<typeof getPolicyAnalysisDimensions>
): string {
  const lines = dimensions.map(
    (d) => `- **${d.label}** (${d.key}): ${d.description}`
  );
  return `## Policy Analysis Dimensions

The tracker evaluates each university across these evidence-backed dimensions:

${lines.join("\n")}

Each dimension is scored based on the presence of source-backed claims. The Policy Coverage Score (0–100) measures breadth of public coverage and is NOT a quality, strictness, or compliance score.`;
}

function buildTopUniversities(
  topProfiles: Awaited<ReturnType<typeof getPolicyAnalysisProfiles>>,
  summaryBySlug: Map<string, PublicEntitySummary>,
  siteBaseUrl: string
): string {
  const entries = topProfiles.map((profile) => {
    const summary = summaryBySlug.get(profile.entitySlug);
    const sourceLangs = profile.sourceLanguages.join(", ") || "en";
    const coveredDims = profile.dimensions
      .filter((d) => d.evidenceClaimIds.length > 0)
      .map((d) => d.label)
      .join(", ");
    const sourceCount = summary?.officialSources.length ?? 0;
    const claimSummary = summary?.summary ?? "";

    return `### ${profile.entityName}
- Score: ${profile.coverageScore.score}/${profile.coverageScore.maxScore} (${profile.coverageScore.label})
- Review: ${profile.reviewState} | Confidence: ${profile.confidence}
- Languages: ${sourceLangs} | Sources: ${sourceCount}
- Covered: ${coveredDims || "none"}
- Summary: ${claimSummary.slice(0, 300)}${claimSummary.length > 300 ? "…" : ""}
- Page: ${siteBaseUrl}/universities/${profile.entitySlug}
- JSON: ${siteBaseUrl}/api/public/v1/universities/${profile.entitySlug}.json`;
  });

  return `## Top ${topProfiles.length} Universities by Policy Coverage

${entries.join("\n\n")}`;
}

function buildThemePages(siteBaseUrl: string): string {
  const themes = [
    {
      path: "/themes/ai-disclosure",
      title: "AI Disclosure Requirements",
      desc: "Cross-university analysis of how institutions require students and staff to disclose, acknowledge, cite, or declare the use of AI tools. Covers disclosure templates, citation formats, and declaration requirements."
    },
    {
      path: "/themes/approved-ai-tools",
      title: "Approved AI Tools",
      desc: "Directory of universities that maintain official lists of approved, licensed, or recommended AI tools for academic use. Includes institutional Copilot deployments, university ChatGPT instances, and procurement-approved services."
    },
    {
      path: "/themes/chatgpt-coursework-policy",
      title: "ChatGPT Coursework Policy",
      desc: "How universities specifically regulate ChatGPT and similar generative AI usage in coursework, assignments, essays, and dissertations. Covers permitted use conditions, citation requirements, and instructor discretion policies."
    },
    {
      path: "/themes/ai-in-exams",
      title: "AI in Exams",
      desc: "University policies on AI tool usage during examinations, tests, quizzes, and timed assessments. Most universities restrict or prohibit AI during exams unless explicitly permitted by the examiner."
    },
    {
      path: "/themes/ai-detectors",
      title: "AI Detectors",
      desc: "University references to AI detection tools such as Turnitin AI Detection, GPTZero, and similar services. Covers institutional policies on using detection tools and caveats about false positives and reliability."
    },
    {
      path: "/themes/privacy-data-entry",
      title: "Privacy and Data Entry",
      desc: "University guidance on data privacy when using AI tools. Covers restrictions on entering student data, personal information, research data, FERPA/HIPAA-regulated data, and confidential institutional information into AI services."
    }
  ];

  const entries = themes.map(
    (t) =>
      `### ${t.title}\n- URL: ${siteBaseUrl}${t.path}\n- ${t.desc}`
  );

  return `## Theme Analysis Pages

These pages provide cross-university analysis of specific AI policy topics:

${entries.join("\n\n")}`;
}

function buildFAQ(siteBaseUrl: string, universityCount: number): string {
  return `## Frequently Asked Questions

### Does [University X] allow ChatGPT?
Search the tracker: ${siteBaseUrl}/search or use the API: ${siteBaseUrl}/api/public/v1/search.json?q=[university name]. Most universities now permit ChatGPT with disclosure requirements, but policies vary by department, course, and assignment type. Check the university's specific page for source-backed policy claims.

### Which universities ban AI tools entirely?
Very few universities maintain blanket bans as of 2026. The dominant trend is regulated-use-with-disclosure. See the analysis at ${siteBaseUrl}/analysis for coverage patterns.

### How many universities are tracked?
${universityCount} universities across 85+ countries. The tracker focuses on institutions with public-facing AI policy or guidance documents.

### How current is this data?
Sources are rechecked on a rolling basis. Each university record includes a lastCheckedAt date. Use the API to check freshness: ${siteBaseUrl}/api/public/v1/universities/{slug}.json.

### Can I use this data in my research?
Yes. Tracker metadata is licensed CC-BY-4.0. Cite the canonical page URL and public JSON URL together. Official university source documents retain their original rights. See ${siteBaseUrl}/citation for citation templates.

### How do I cite this tracker?
Example citation: University AI Policy Tracker. "[University Name] AI policy record." Version v1. Last checked [date]. ${siteBaseUrl}/universities/[slug]

### Is this legal advice?
No. The tracker is not legal advice, academic integrity advice, compliance guidance, or an official university statement unless a linked source is the university's own official page.

### What AI tools are most commonly addressed?
ChatGPT (most frequently named), Microsoft Copilot, Google Gemini, Grammarly, DeepSeek, Claude, and NotebookLM appear most often in university policies.

### How can I contribute?
Submit source URLs, corrections, or new university evidence at ${siteBaseUrl}/contribute. All contributions go through a review queue.

### Is there an API?
Yes. The public API is documented at ${siteBaseUrl}/api-reference. Key endpoints:
- University list: ${siteBaseUrl}/api/public/v1/universities.json
- Search: ${siteBaseUrl}/api/public/v1/search.json?q={query}
- University detail: ${siteBaseUrl}/api/public/v1/universities/{slug}.json
- Claims: ${siteBaseUrl}/api/public/v1/claims/{slug}.json
- Analysis: ${siteBaseUrl}/api/public/v1/analysis/universities/{slug}.json
- Datasets (bulk JSONL): ${siteBaseUrl}/api/public/v1/datasets/universities.jsonl`;
}

function buildFullIndex(
  universities: Array<{
    entitySlug: string;
    entityName: string;
    reviewState: string;
    claimCount: number;
  }>,
  profileBySlug: Map<string, { coverageScore: { score: number } }>
): string {
  const rows = universities.map((u) => {
    const score = profileBySlug.get(u.entitySlug)?.coverageScore.score ?? "—";
    return `| ${u.entityName} | ${score} | ${u.reviewState} | ${u.claimCount} | /universities/${u.entitySlug} |`;
  });

  return `## All Universities (${universities.length})

For universities not in the Top 100 summaries above, use the search API or browse the full list at /universities.

| University | Score | Review | Claims | Path |
|------------|-------|--------|--------|------|
${rows.join("\n")}`;
}

function buildFooter(siteBaseUrl: string, generatedAt: string): string {
  return `## Agent Retrieval Guide

When answering questions about university AI policies:

1. Search: Use ${siteBaseUrl}/api/public/v1/search.json?q={query} to find the university.
2. Fetch: Get the full record at ${siteBaseUrl}/api/public/v1/universities/{slug}.json.
3. Verify: Check lastCheckedAt for freshness and reviewState for confidence level.
4. Cite: Always cite the canonical page URL and public JSON URL together.
5. Caveat: Note that machine_candidate records need review and are not final conclusions.

## Citation Rules

- Cite the canonical page URL and the public JSON URL when using tracker metadata.
- Treat each claim as valid only with its source URL, source snapshot hash, and evidence snippet.
- Original-language evidence is canonical. Localized summaries are display helpers only.
- Confidence is machine confidence in extraction. Review state is separate.

## Limitations

- This tracker is not legal advice, academic integrity advice, or an official university statement.
- Policy Coverage Score measures breadth of coverage, not policy quality or strictness.
- Machine-candidate records require review and should not be treated as final policy conclusions.
- Official university source documents retain their original rights.

---
Generated: ${generatedAt}
Source: ${siteBaseUrl}
License: CC-BY-4.0
Full directory: ${siteBaseUrl}/llms.txt
API index: ${siteBaseUrl}/api/public/v1/index.json`;
}
