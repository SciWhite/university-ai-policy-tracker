import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiCitation
} from "@uapt/shared";
import { getChangeRecords } from "./change-records";
import {
  getPolicyAnalysisProfileBySlug
} from "./policy-analysis";
import { getSourceHealthDashboardData } from "./review-dashboards";
import { getAbsoluteSiteUrl } from "./site-url";
import {
  getStagedPublicSummaries,
  getStagedPublicSummaryBySlug
} from "./staged-public-data";
import type { PolicyClaim, PublicEntitySummary } from "@uapt/shared";

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
    name: "get_api_index",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/index.json`,
    description:
      "Read public endpoint, trust page, limitation, and citation metadata."
  },
  {
    name: "search_universities",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/search.json?q={query}`,
    description:
      "Search public university records by canonical name, alias, official source title, claim summary, domain, or analysis dimension."
  },
  {
    name: "resolve_entity",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/entities/index.json`,
    description:
      "Read canonical university entities and retrieval aliases. Aliases improve recall and do not create new policy facts."
  },
  {
    name: "get_university_policy_record",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/universities/{slug}.json`,
    description:
      "Read one citation-ready university record with claims, evidence, source URLs, review states, and caveats."
  },
  {
    name: "get_policy_claims",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/claims/{slug}.json`,
    description:
      "Read claim/evidence rows for one public university record with source URL, source language, snapshot hash, review state, and confidence."
  },
  {
    name: "get_analysis_profile",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/analysis/universities/{slug}.json`,
    description:
      "Read one deterministic policy analysis profile derived from public claim/evidence records."
  },
  {
    name: "get_qs_coverage_gap",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/coverage/qs-2026.json`,
    description:
      "Read QS 2026 collection coverage rows. Coverage status is not a policy quality or maturity score."
  },
  {
    name: "get_source_health",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/source-health.json`,
    description:
      "Read public source snapshot and staging source/fetch health metadata for compliant repair planning."
  },
  {
    name: "get_recent_changes",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`,
    description:
      "Read recent public source checks and changed institution records."
  },
  {
    name: "get_citation",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/citation.json`,
    description:
      "Read citation templates, required fields, source rights caveat, and no-advice boundary."
  },
  {
    name: "get_dataset_release",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`,
    description:
      "Read the latest dataset release manifest, artifacts, checksums, and citation fields."
  },
  {
    name: "get_mcp_tool_catalog",
    method: "GET",
    path: `/api/public/${PUBLIC_API_VERSION}/mcp/tool-catalog.json`,
    description:
      "Read the full alpha tool catalog, required output fields, prohibited actions, and example queries."
  }
] as const;

export const exampleAgentQueries = [
  "Find universities whose public AI policy records mention approved AI tools, and include review state and source URL for each answer.",
  "Summarize the latest checked record for Massachusetts Institute of Technology, but separate reviewed claims from needs-review claims.",
  "List recent university AI policy records that changed this month and provide canonical page URLs plus public JSON URLs.",
  "Resolve MIT or ANU to canonical tracker entity records before summarizing policy claims.",
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
            `data-widget="university-status" data-slug="anu"></script>`,
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
        },
        {
          type: "policy-coverage",
          description:
            "Compact policy coverage badge with source-backed analysis coverage score, review state, and canonical links.",
          exampleHtml:
            `<script async src="${getAbsoluteSiteUrl(widgetScriptPath)}" ` +
            `data-widget="policy-coverage" data-slug="anu"></script>`,
          dataEndpointTemplate: getAbsoluteSiteUrl(
            `/api/public/${PUBLIC_API_VERSION}/widgets/policy-coverage/{slug}.json`
          )
        },
        {
          type: "source-freshness",
          description:
            "Compact source freshness badge with last checked date, source count, and public source-health counts.",
          exampleHtml:
            `<script async src="${getAbsoluteSiteUrl(widgetScriptPath)}" ` +
            `data-widget="source-freshness" data-slug="anu"></script>`,
          dataEndpointTemplate: getAbsoluteSiteUrl(
            `/api/public/${PUBLIC_API_VERSION}/widgets/source-freshness/{slug}.json`
          )
        },
        {
          type: "review-state",
          description:
            "Compact review-state badge that shows review state, confidence, and candidate/reviewed claim counts.",
          exampleHtml:
            `<script async src="${getAbsoluteSiteUrl(widgetScriptPath)}" ` +
            `data-widget="review-state" data-slug="anu"></script>`,
          dataEndpointTemplate: getAbsoluteSiteUrl(
            `/api/public/${PUBLIC_API_VERSION}/widgets/review-state/{slug}.json`
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

  return buildUniversityStatusWidget(summary);
}

export function buildUniversityStatusWidget(summary: PublicEntitySummary) {
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

export async function getPolicyCoverageWidget(slug: string) {
  const profile = await getPolicyAnalysisProfileBySlug(slug);
  const summary = await getStagedPublicSummaryBySlug(slug);

  if (!profile || !summary) return undefined;

  const evidenceBackedDimensionCount = profile.dimensions.filter(
    (dimension) => dimension.evidenceCount > 0
  ).length;

  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl: profile.canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    limitations: profile.limitations,
    widget: {
      type: "policy-coverage",
      embedScriptUrl: getAbsoluteSiteUrl(widgetScriptPath),
      sourceRecordUrl: profile.publicJsonUrl
    },
    data: {
      entitySlug: profile.entitySlug,
      entityName: profile.entityName,
      publicPageUrl: summary.publicPageUrl ?? summary.canonicalUrl,
      publicJsonUrl:
        summary.apiUrl ??
        getAbsoluteSiteUrl(
          `/api/public/${PUBLIC_API_VERSION}/universities/${profile.entitySlug}.json`
        ),
      analysisJsonUrl: profile.publicJsonUrl,
      reviewState: profile.reviewState,
      confidence: profile.confidence,
      coverageScore: profile.coverageScore.score,
      coverageMaxScore: profile.coverageScore.maxScore,
      coverageLabel: profile.coverageScore.label,
      dimensionCount: profile.dimensions.length,
      evidenceBackedDimensionCount,
      sourceLanguageCount: profile.sourceLanguages.length,
      summaryPreview:
        "Policy Coverage Score measures breadth of source-backed public coverage, not policy quality."
    }
  };
}

export async function getSourceFreshnessWidget(slug: string) {
  const summary = await getStagedPublicSummaryBySlug(slug);
  if (!summary) return undefined;

  const health = await getSourceHealthDashboardData();
  const sourceRows = health.rows.filter(
    (row) => row.scope === "public_release" && row.entitySlug === slug
  );
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
    limitations: [
      "Public source freshness is based on promoted snapshot metadata and is not a live recrawl guarantee.",
      NO_ADVICE_BOUNDARY
    ],
    widget: {
      type: "source-freshness",
      embedScriptUrl: getAbsoluteSiteUrl(widgetScriptPath),
      sourceRecordUrl: publicJsonUrl
    },
    data: {
      entitySlug: summary.entity.slug,
      entityName: summary.entity.name,
      publicPageUrl: summary.publicPageUrl ?? summary.canonicalUrl,
      publicJsonUrl,
      lastCheckedAt: summary.lastCheckedAt,
      lastChangedAt: summary.lastChangedAt,
      reviewState: summary.reviewState,
      officialSourceCount: summary.officialSources.length,
      sourceHealthCounts: countWidgetStatuses(sourceRows),
      summaryPreview:
        "Promoted source snapshot metadata is available. Open the canonical record for source URLs and evidence."
    }
  };
}

export async function getReviewStateWidget(slug: string) {
  const summary = await getStagedPublicSummaryBySlug(slug);
  if (!summary) return undefined;

  const reviewedClaimCount = summary.claims.filter((claim) =>
    isReviewedState(claim.reviewState)
  ).length;
  const candidateClaimCount = summary.claims.length - reviewedClaimCount;
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
      type: "review-state",
      embedScriptUrl: getAbsoluteSiteUrl(widgetScriptPath),
      sourceRecordUrl: publicJsonUrl
    },
    data: {
      entitySlug: summary.entity.slug,
      entityName: summary.entity.name,
      publicPageUrl: summary.publicPageUrl ?? summary.canonicalUrl,
      publicJsonUrl,
      reviewState: summary.reviewState,
      confidence: summary.confidence,
      claimCount: summary.claims.length,
      reviewedClaimCount,
      candidateClaimCount,
      summaryPreview:
        candidateClaimCount > 0
          ? "Some claims remain candidate or needs-review. Treat the linked source-backed record as the authority."
          : "Published claims are labeled with review state and linked source evidence."
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

export function buildRecentChangesWidgetFromPublicChanges(
  changes: Array<{
    canonicalUrl: string;
    claims: PolicyClaim[];
    entityName: string;
    entitySlug: string;
    lastChangedAt?: string;
    lastCheckedAt?: string;
    reviewState: string;
  }>,
  limit = 5
) {
  const records = changes.slice(0, clampLimit(limit));

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
      changes: records.map((record) => {
        const reviewedClaimCount = record.claims.filter((claim) =>
          isReviewedState(claim.reviewState)
        ).length;
        const sourceCount = new Set(
          record.claims.flatMap((claim) =>
            claim.evidence.map((evidence) => evidence.sourceUrl)
          )
        ).size;

        return {
          entitySlug: record.entitySlug,
          entityName: record.entityName,
          publicPageUrl: getAbsoluteSiteUrl(
            `/universities/${record.entitySlug}`
          ),
          changeUrl: getAbsoluteSiteUrl(`/changes/${record.entitySlug}`),
          publicJsonUrl: getAbsoluteSiteUrl(
            `/api/public/${PUBLIC_API_VERSION}/universities/${record.entitySlug}.json`
          ),
          summaryPreview: isReviewedState(record.reviewState)
            ? "Public source-check record with canonical links and labeled review state."
            : "Review pending. Use canonical source-backed records before treating this as a policy conclusion.",
          lastCheckedAt: record.lastCheckedAt,
          lastChangedAt: record.lastChangedAt,
          reviewState: record.reviewState,
          claimCount: record.claims.length,
          reviewedClaimCount,
          candidateClaimCount: record.claims.length - reviewedClaimCount,
          sourceCount
        };
      })
    }
  };
}

export async function getMcpManifestResponse() {
  const catalog = getMcpToolCatalogData();

  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl: getAbsoluteSiteUrl("/mcp"),
    license: TRACKER_METADATA_LICENSE,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker read-only MCP alpha manifest",
      canonicalUrl: getAbsoluteSiteUrl("/mcp"),
      publicJsonUrl: getAbsoluteSiteUrl(
        `/api/public/${PUBLIC_API_VERSION}/mcp/manifest.json`
      ),
      suggestedCitation:
        "University AI Policy Tracker read-only MCP alpha manifest. University AI Policy Tracker. Version v1. " +
        getAbsoluteSiteUrl("/mcp")
    }),
    data: {
      name: "University AI Policy Tracker read-only MCP alpha",
      status: "design-alpha",
      readOnly: true,
      toolCatalogUrl: getAbsoluteSiteUrl(
        `/api/public/${PUBLIC_API_VERSION}/mcp/tool-catalog.json`
      ),
      mutationPolicy: catalog.mutationPolicy,
      tools: catalog.tools,
      responseRequirements: catalog.responseRequirements,
      exampleAgentQueries
    }
  };
}

export function getMcpToolCatalogResponse() {
  const canonicalUrl = getAbsoluteSiteUrl("/mcp");
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/mcp/tool-catalog.json`
  );

  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker MCP tool catalog",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker MCP tool catalog. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    data: getMcpToolCatalogData()
  };
}

export function getCitationMetadataResponse() {
  const canonicalUrl = getAbsoluteSiteUrl("/citation");
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/citation.json`
  );

  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker citation metadata",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker citation metadata. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    data: {
      requiredFields: [
        "canonicalUrl",
        "publicJsonUrl",
        "lastCheckedAt",
        "lastChangedAt",
        "reviewState",
        "sourceUrls",
        "sourceLanguages",
        "sourceSnapshotHashes"
      ],
      citationTemplates: [
        {
          type: "university_policy_page",
          template:
            'University AI Policy Tracker. "{entityName} AI policy record." Version {apiVersion}. Last checked {lastCheckedAt}. {canonicalUrl}'
        },
        {
          type: "dataset_release",
          template:
            "University AI Policy Tracker dataset release. Release {releaseId}. {canonicalUrl}"
        },
        {
          type: "change_or_report_page",
          template:
            'University AI Policy Tracker. "{title}." {periodOrDate}. {canonicalUrl}'
        },
        {
          type: "widget_or_agent_summary",
          template:
            "Use the canonical tracker page and public JSON URL shown by the widget or MCP result; cite linked university source URLs separately."
        }
      ],
      evidenceRules: [
        "Original-language evidence remains canonical.",
        "Localized display text is helper text only.",
        "Confidence and review state must remain separate.",
        "Machine-candidate or needs-review records must not be presented as final policy conclusions."
      ]
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
    summaries.find((summary) => summary.entity.slug === "anu") ??
    summaries.find((summary) => isReviewedState(summary.reviewState)) ??
    summaries[0];

  return {
    policyCoverageWidget: preferred
      ? await getPolicyCoverageWidget(preferred.entity.slug)
      : undefined,
    reviewStateWidget: preferred
      ? await getReviewStateWidget(preferred.entity.slug)
      : undefined,
    sourceFreshnessWidget: preferred
      ? await getSourceFreshnessWidget(preferred.entity.slug)
      : undefined,
    statusWidget: preferred
      ? await getUniversityStatusWidget(preferred.entity.slug)
      : undefined,
    recentChangesWidget: await getRecentChangesWidget(5)
  };
}

function getMcpToolCatalogData() {
  return {
    name: "University AI Policy Tracker read-only MCP tool catalog",
    status: "design-alpha",
    readOnly: true,
    mutationPolicy: {
      allowed: false,
      prohibitedActions: [
        "create_claim",
        "publish_record",
        "promote_staging",
        "write_db",
        "operate_openclaw",
        "deploy",
        "push_main",
        "bypass_review_state",
        "bypass_robots_or_access_controls"
      ]
    },
    tools: mcpToolSpecs.map((tool) => ({
      ...tool,
      readOnly: true,
      requiredOutputFields: [
        "canonicalUrl",
        "publicJsonUrl",
        "reviewState",
        "sourceUrl",
        "sourceLanguage",
        "sourceRightsPolicy",
        "limitations"
      ],
      inputSchema: buildToolInputSchema(tool.path)
    })),
    responseRequirements: [
      "Return canonical page URL and public JSON URL with answers.",
      "Return review state next to any summarized claim.",
      "Return confidence where the public endpoint provides confidence.",
      "Return source URL, source language, and source snapshot hash for claim evidence.",
      "Preserve original-language evidence as canonical evidence.",
      "Label candidate or needs-review records clearly.",
      NO_ADVICE_BOUNDARY,
      OFFICIAL_SOURCE_RIGHTS_CAVEAT
    ],
    exampleAgentQueries
  };
}

function buildToolInputSchema(path: string) {
  if (path.includes("{query}")) {
    return {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query such as a university name, abbreviation, source domain, AI service, or policy theme."
        }
      },
      required: ["query"]
    };
  }

  if (path.includes("{slug}")) {
    return {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Canonical university slug from the public university list."
        }
      },
      required: ["slug"]
    };
  }

  return {
    type: "object",
    properties: {}
  };
}

function countWidgetStatuses(
  rows: Array<{
    status: string;
  }>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

function isReviewedState(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 5;

  return Math.max(1, Math.min(Math.trunc(value), 10));
}
