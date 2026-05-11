import {
  NO_ADVICE_BOUNDARY,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE
} from "@uapt/shared";
import { getChangeRecords } from "./change-records";
import { getAbsoluteSiteUrl } from "./site-url";
import {
  getStagedPublicSummaries,
  getStagedPublicSummaryBySlug
} from "./staged-public-data";

export const widgetScriptPath = "/widgets/embed.js";

export const widgetCorsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=3600, s-maxage=3600"
} as const;

export const rateLimitPolicy = {
  policyType: "soft-public-read-policy",
  unauthenticatedUse: true,
  recommendedClientCacheSeconds: 3600,
  suggestedLimit: "60 requests per minute per client for public JSON usage",
  bulkUse:
    "Use dataset release artifacts instead of repeatedly walking per-university endpoints.",
  widgetUse:
    "Embeddable widgets should use the widget JSON endpoints and cache rendered output where possible.",
  crawlerUse:
    "Use the sitemap, llms.txt, dataset manifest, and public API index. Do not bypass robots, login walls, paywalls, or university source-site terms.",
  changeNotice:
    "This is a public fair-use policy, not a paid API SLA. Limits may be enforced or adjusted as traffic grows."
} as const;

export const mcpToolSpecs = [
  {
    name: "uapt.get_api_index",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/index.json`,
    description:
      "Read public endpoint, trust page, limitation, and citation metadata."
  },
  {
    name: "uapt.list_universities",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/universities.json`,
    description:
      "Read the public university record list. Client-side filtering is expected in the alpha design."
  },
  {
    name: "uapt.get_university_policy",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/universities/{slug}.json`,
    description:
      "Read one citation-ready university record with claims, evidence, source URLs, review states, and caveats."
  },
  {
    name: "uapt.get_recent_changes",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`,
    description:
      "Read recent public source checks and changed institution records."
  },
  {
    name: "uapt.get_dataset_release",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`,
    description:
      "Read the latest dataset release manifest, artifacts, checksums, and citation fields."
  }
] as const;

export const exampleAgentQueries = [
  "Find universities whose public AI policy records mention approved AI tools, and include review state and source URL for each answer.",
  "Summarize the latest checked record for Massachusetts Institute of Technology, but separate reviewed claims from needs-review claims.",
  "List recent university AI policy records that changed this month and provide canonical page URLs plus public JSON URLs.",
  "Compare Harvard and Stanford policy metadata, using only source-backed public claims and preserving original evidence language.",
  "Generate a citation for the latest dataset release and include the release manifest URL."
] as const;

export async function getWidgetIndexResponse() {
  const generatedAt = new Date().toISOString();
  const canonicalUrl = getAbsoluteSiteUrl("/widgets");
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/widgets/index.json`
  );

  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    limitations: [NO_ADVICE_BOUNDARY],
    citation: {
      citationTitle: "University AI Policy Tracker embeddable widgets",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker embeddable widgets. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    },
    data: {
      embedScriptUrl: getAbsoluteSiteUrl(widgetScriptPath),
      widgets: [
        {
          type: "university-status",
          description:
            "Compact university AI policy status card with review state, last checked date, source count, and canonical links.",
          exampleHtml:
            `<script async src="${getAbsoluteSiteUrl(widgetScriptPath)}" ` +
            `data-widget="university-status" data-slug="harvard-university"></script>`,
          dataEndpointTemplate: getAbsoluteSiteUrl(
            `/api/public/${PUBLIC_API_VERSION}/widgets/university-status/{slug}.json`
          )
        },
        {
          type: "recent-changes",
          description:
            "Compact recent public source-check and change list with review-state labels.",
          exampleHtml:
            `<script async src="${getAbsoluteSiteUrl(widgetScriptPath)}" ` +
            `data-widget="recent-changes" data-limit="5"></script>`,
          dataEndpoint: getAbsoluteSiteUrl(
            `/api/public/${PUBLIC_API_VERSION}/widgets/recent-changes.json`
          )
        }
      ],
      constraints: [
        "Widgets must link back to canonical tracker pages.",
        "Widgets display review state and last checked or changed date.",
        "Widgets do not expose unreviewed claim text; candidate counts remain labeled.",
        "Original source documents retain their original rights."
      ]
    }
  };
}

export async function getUniversityStatusWidget(slug: string) {
  const summary = await getStagedPublicSummaryBySlug(slug);

  if (!summary) return undefined;

  const reviewedClaimCount = summary.claims.filter((claim) =>
    isReviewedState(claim.reviewState)
  ).length;
  const candidateClaimCount = summary.claims.length - reviewedClaimCount;
  const sourceLanguages = Array.from(
    new Set(
      summary.claims.flatMap((claim) =>
        claim.evidence
          .map((evidence) => evidence.sourceLanguage)
          .filter((language): language is string => Boolean(language))
      )
    )
  ).sort();
  const reviewedRecord = isReviewedState(summary.reviewState);
  const publicJsonUrl =
    summary.apiUrl ??
    getAbsoluteSiteUrl(
      `/api/public/${PUBLIC_API_VERSION}/universities/${summary.entity.slug}.json`
    );

  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl: summary.canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    limitations: summary.limitations,
    widget: {
      type: "university-status",
      embedScriptUrl: getAbsoluteSiteUrl(widgetScriptPath),
      sourceRecordUrl: publicJsonUrl
    },
    data: {
      entitySlug: summary.entity.slug,
      entityName: summary.entity.name,
      publicPageUrl: summary.publicPageUrl ?? summary.canonicalUrl,
      publicJsonUrl,
      summaryPreview: reviewedRecord
        ? summary.summary
        : "Review pending. Use the canonical record and linked source URLs before treating this as a policy conclusion.",
      lastCheckedAt: summary.lastCheckedAt,
      lastChangedAt: summary.lastChangedAt,
      reviewState: summary.reviewState,
      confidence: summary.confidence,
      claimCount: summary.claims.length,
      reviewedClaimCount,
      candidateClaimCount,
      officialSourceCount: summary.officialSources.length,
      sourceLanguages
    }
  };
}

export async function getRecentChangesWidget(limit = 5) {
  const records = (await getChangeRecords()).slice(0, clampLimit(limit));

  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl: getAbsoluteSiteUrl("/changes"),
    license: TRACKER_METADATA_LICENSE,
    limitations: [NO_ADVICE_BOUNDARY],
    widget: {
      type: "recent-changes",
      embedScriptUrl: getAbsoluteSiteUrl(widgetScriptPath),
      sourceRecordUrl: getAbsoluteSiteUrl(
        `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`
      )
    },
    data: {
      count: records.length,
      changes: records.map((record) => ({
        entitySlug: record.slug,
        entityName: record.name,
        publicPageUrl: getAbsoluteSiteUrl(record.universityUrl),
        changeUrl: getAbsoluteSiteUrl(record.changeUrl),
        publicJsonUrl: record.publicJsonUrl,
        summaryPreview: isReviewedState(record.reviewState)
          ? record.summary
          : "Review pending. Use canonical source-backed records before treating this as a policy conclusion.",
        lastCheckedAt: record.lastCheckedAt,
        lastChangedAt: record.lastChangedAt,
        reviewState: record.reviewState,
        claimCount: record.claimCount,
        reviewedClaimCount: record.reviewedClaimCount,
        candidateClaimCount: record.candidateClaimCount,
        sourceCount: record.sourceCount
      }))
    }
  };
}

export async function getMcpManifestResponse() {
  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl: getAbsoluteSiteUrl("/mcp"),
    license: TRACKER_METADATA_LICENSE,
    limitations: [NO_ADVICE_BOUNDARY],
    data: {
      name: "University AI Policy Tracker read-only MCP alpha",
      status: "design-alpha",
      readOnly: true,
      mutationPolicy: {
        allowed: false,
        prohibitedActions: [
          "write production DB",
          "publish canonical claims",
          "push main",
          "bypass review state",
          "operate OpenClaw",
          "crawl source sites from the MCP surface"
        ]
      },
      tools: mcpToolSpecs,
      citationRequirements: [
        "Return canonical page URL and public JSON URL with answers.",
        "Keep review state separate from confidence.",
        "Preserve original-language evidence as canonical evidence.",
        "Do not present candidate or needs-review claims as final policy conclusions."
      ],
      exampleAgentQueries
    }
  };
}

export async function getRateLimitPolicyResponse() {
  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl: getAbsoluteSiteUrl("/api-reference#rate-limits"),
    license: TRACKER_METADATA_LICENSE,
    limitations: [NO_ADVICE_BOUNDARY],
    data: rateLimitPolicy
  };
}

export async function getWidgetPreviewRecords() {
  const summaries = await getStagedPublicSummaries();
  const preferred =
    summaries.find((summary) => summary.entity.slug === "harvard-university") ??
    summaries.find((summary) => isReviewedState(summary.reviewState)) ??
    summaries[0];

  return {
    statusWidget: preferred
      ? await getUniversityStatusWidget(preferred.entity.slug)
      : undefined,
    recentChangesWidget: await getRecentChangesWidget(5)
  };
}

function isReviewedState(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 5;

  return Math.max(1, Math.min(Math.trunc(value), 10));
}
