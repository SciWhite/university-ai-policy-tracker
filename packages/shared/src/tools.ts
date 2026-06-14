import { z } from "zod";
import {
  DEFAULT_PUBLIC_SITE_BASE_URL,
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  claimReviewStateSchema,
  publicApiCitationSchema,
  trackerMetadataLicenseSchema,
  type ClaimReviewState,
  type PolicyClaim,
  type PublicEntitySummary
} from "./claims";
import {
  aiTools,
  findToolMentions,
  getAiToolCatalogEntry,
  serviceTreatments,
  type AiToolSlug,
  type ToolMention
} from "./taxonomy";

export const derivedAiTools = aiTools;

export const toolAvailabilitySchema = z.enum(serviceTreatments);

export const toolEndorsementTypeSchema = z.enum([
  "officially_endorsed",
  "institutionally_licensed_or_procured",
  "self_hosted_system",
  "third_party_service",
  "not_specified"
]);

export const derivedAiToolSchema = z.enum(derivedAiTools);

export const toolEvidenceRecordSchema = z.object({
  sourceUrl: z.string().url(),
  evidenceSnippet: z.string().min(1).max(700),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  reviewState: claimReviewStateSchema
});

export const universityToolRecordSchema = z.object({
  universitySlug: z.string().min(1),
  universityName: z.string().min(1),
  rawToolName: z.string().min(1),
  tool: derivedAiToolSchema,
  description: z.string().min(1).optional(),
  howToObtain: z.string().min(1).optional(),
  costToUser: z.string().min(1).optional(),
  availability: toolAvailabilitySchema,
  endorsementType: toolEndorsementTypeSchema,
  reviewState: claimReviewStateSchema,
  evidence: z.array(toolEvidenceRecordSchema).min(1)
});

export const publicToolsDataSchema = z.object({
  count: z.number().int().nonnegative(),
  records: z.array(universityToolRecordSchema),
  tools: z.array(
    z.object({
      tool: derivedAiToolSchema,
      universityCount: z.number().int().nonnegative(),
      evidenceCount: z.number().int().nonnegative()
    })
  ),
  universities: z.array(
    z.object({
      universitySlug: z.string().min(1),
      universityName: z.string().min(1),
      toolCount: z.number().int().nonnegative(),
      evidenceCount: z.number().int().nonnegative()
    })
  )
});

const publicToolsEnvelopeBaseSchema = z.object({
  apiVersion: z.literal(PUBLIC_API_VERSION),
  generatedAt: z.string().datetime(),
  canonicalUrl: z.string().url(),
  license: trackerMetadataLicenseSchema.default(TRACKER_METADATA_LICENSE),
  trackerMetadataLicense: trackerMetadataLicenseSchema.default(
    TRACKER_METADATA_LICENSE
  ),
  sourcePolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  sourceRightsPolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  limitations: z.array(z.string().min(1)).default([NO_ADVICE_BOUNDARY]),
  citation: publicApiCitationSchema
});

export const publicToolsResponseSchema = publicToolsEnvelopeBaseSchema.extend({
  data: publicToolsDataSchema
});

export type DerivedAiTool = z.infer<typeof derivedAiToolSchema>;
export type ToolAvailability = z.infer<typeof toolAvailabilitySchema>;
export type ToolEndorsementType = z.infer<typeof toolEndorsementTypeSchema>;
export type ToolEvidenceRecord = z.infer<typeof toolEvidenceRecordSchema>;
export type UniversityToolRecord = z.infer<typeof universityToolRecordSchema>;
export type PublicToolsData = z.infer<typeof publicToolsDataSchema>;
export type PublicToolsResponse = z.infer<typeof publicToolsResponseSchema>;

const normalizedToolClaimValueSchema = z
  .object({
    tool: derivedAiToolSchema.optional(),
    rawToolName: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    howToObtain: z.string().min(1).optional(),
    costToUser: z.string().min(1).optional(),
    availability: toolAvailabilitySchema.optional(),
    endorsementType: toolEndorsementTypeSchema.optional()
  })
  .passthrough();

type NormalizedToolClaimValue = z.infer<typeof normalizedToolClaimValueSchema>;

const genericToolPattern =
  /\b(?:ai tools?|generative ai tools?|genai tools?|ai services?|generative ai services?)\b/i;
const genericPlatformPattern =
  /\b(?:institutional|institutionally|university|campus|enterprise|managed|secure)\s+(?:ai|generative ai|genai)\s+(?:service|tool|platform|system)\b/i;
const selfHostedPattern =
  /\b(?:self-hosted|self hosted|locally hosted|hosted by|on-prem|on premise|university-hosted|mit-hosted|campus-hosted)\b/i;

export function deriveUniversityToolRecords(
  summaries: PublicEntitySummary[]
): UniversityToolRecord[] {
  const records = summaries.flatMap((summary) =>
    deriveUniversityToolRecordsForSummary(summary)
  );

  return records.sort(compareToolRecords);
}

export function deriveUniversityToolRecordsForSummary(
  summary: PublicEntitySummary
): UniversityToolRecord[] {
  const buckets = new Map<string, UniversityToolRecord>();

  for (const claim of summary.claims) {
    if (claim.claimType !== "ai_tool_treatment") continue;

    const normalizedValue = parseNormalizedToolClaimValue(claim.claimValue);
    const segments = getToolSegments(claim);

    for (const segment of segments) {
      const mentions = normalizedValue?.tool
        ? [
            {
              tool: normalizedValue.tool,
              rawToolName:
                normalizedValue.rawToolName ??
                getAiToolCatalogEntry(normalizedValue.tool).label,
              provider: getAiToolCatalogEntry(normalizedValue.tool).provider,
              label: getAiToolCatalogEntry(normalizedValue.tool).label
            }
          ]
        : getMentionedTools(segment.text, segment.rowLike);
      const segmentTools = mentions.length
        ? mentions
        : deriveFallbackToolMentions(segment.text);

      for (const mention of segmentTools) {
        const tool = mention.tool;
        const key = `${summary.entity.slug}:${tool}`;
        const evidence = toolEvidenceRecordSchema.parse({
          sourceUrl: segment.sourceUrl,
          evidenceSnippet: segment.evidenceSnippet,
          snapshotHash: segment.snapshotHash,
          reviewState: claim.reviewState
        });
        const nextAvailability =
          normalizedValue?.availability ?? classifyAvailability(segment.text);
        const nextEndorsementType =
          normalizedValue?.endorsementType ?? classifyEndorsement(segment.text);
        const existing = buckets.get(key);

        if (!existing) {
          buckets.set(
            key,
            universityToolRecordSchema.parse({
              universitySlug: summary.entity.slug,
              universityName: summary.entity.name,
              rawToolName: mention.rawToolName,
              tool,
              description: normalizedValue?.description,
              howToObtain: normalizedValue?.howToObtain,
              costToUser: normalizedValue?.costToUser,
              availability: nextAvailability,
              endorsementType: nextEndorsementType,
              reviewState: claim.reviewState,
              evidence: [evidence]
            })
          );
          continue;
        }

        existing.availability = chooseAvailability(
          existing.availability,
          nextAvailability
        );
        existing.rawToolName = chooseRawToolName(
          existing.rawToolName,
          mention.rawToolName
        );
        existing.endorsementType = chooseEndorsementType(
          existing.endorsementType,
          nextEndorsementType
        );
        existing.description = chooseOptionalToolText(
          existing.description,
          normalizedValue?.description
        );
        existing.howToObtain = chooseOptionalToolText(
          existing.howToObtain,
          normalizedValue?.howToObtain
        );
        existing.costToUser = chooseOptionalToolText(
          existing.costToUser,
          normalizedValue?.costToUser
        );
        existing.reviewState = aggregateClaimReviewState([
          existing.reviewState,
          claim.reviewState
        ]);
        if (!hasDuplicateEvidence(existing.evidence, evidence)) {
          existing.evidence.push(evidence);
        }
      }
    }
  }

  const records = Array.from(buckets.values()).map((record) =>
    universityToolRecordSchema.parse(record)
  );
  const hasSpecificToolRecord = records.some(
    (record) => record.tool !== "unspecified_ai_tool"
  );

  return records
    .filter(
      (record) =>
        !hasSpecificToolRecord || record.tool !== "unspecified_ai_tool"
    )
    .sort(compareToolRecords);
}

export function buildPublicToolsData(
  records: UniversityToolRecord[]
): PublicToolsData {
  const parsedRecords = records.map((record) =>
    universityToolRecordSchema.parse(record)
  );
  const tools = new Map<
    DerivedAiTool,
    { tool: DerivedAiTool; universities: Set<string>; evidenceCount: number }
  >();
  const universities = new Map<
    string,
    {
      universitySlug: string;
      universityName: string;
      tools: Set<DerivedAiTool>;
      evidenceCount: number;
    }
  >();

  for (const record of parsedRecords) {
    const toolBucket =
      tools.get(record.tool) ??
      {
        tool: record.tool,
        universities: new Set<string>(),
        evidenceCount: 0
      };
    toolBucket.universities.add(record.universitySlug);
    toolBucket.evidenceCount += record.evidence.length;
    tools.set(record.tool, toolBucket);

    const universityBucket =
      universities.get(record.universitySlug) ??
      {
        universitySlug: record.universitySlug,
        universityName: record.universityName,
        tools: new Set<DerivedAiTool>(),
        evidenceCount: 0
      };
    universityBucket.tools.add(record.tool);
    universityBucket.evidenceCount += record.evidence.length;
    universities.set(record.universitySlug, universityBucket);
  }

  return publicToolsDataSchema.parse({
    count: parsedRecords.length,
    records: parsedRecords,
    tools: Array.from(tools.values())
      .map((tool) => ({
        tool: tool.tool,
        universityCount: tool.universities.size,
        evidenceCount: tool.evidenceCount
      }))
      .sort((left, right) => left.tool.localeCompare(right.tool)),
    universities: Array.from(universities.values())
      .map((university) => ({
        universitySlug: university.universitySlug,
        universityName: university.universityName,
        toolCount: university.tools.size,
        evidenceCount: university.evidenceCount
      }))
      .sort((left, right) =>
        left.universityName.localeCompare(right.universityName)
      )
  });
}

export function buildPublicToolsResponse(
  records: UniversityToolRecord[],
  siteBaseUrl = DEFAULT_PUBLIC_SITE_BASE_URL,
  generatedAt = new Date().toISOString()
): PublicToolsResponse {
  const canonicalUrl = new URL("/tools", siteBaseUrl).toString();
  const publicJsonUrl = new URL(
    `/api/public/${PUBLIC_API_VERSION}/tools.json`,
    siteBaseUrl
  ).toString();

  return publicToolsResponseSchema.parse({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [
      NO_ADVICE_BOUNDARY,
      "Tool records are derived from source-backed claim and evidence text. They are discovery metadata, not official university statements."
    ],
    citation: {
      citationTitle: "University AI Policy Tracker AI tools dataset",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker AI tools dataset. University AI Policy Tracker. Version v1. " +
        canonicalUrl,
      sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT
    },
    data: buildPublicToolsData(records)
  });
}

export function formatToolLabel(tool: DerivedAiTool): string {
  return getAiToolCatalogEntry(tool).label;
}

export function formatToolAvailability(availability: ToolAvailability): string {
  const labels: Record<ToolAvailability, string> = {
    allowed: "Allowed",
    conditionally_allowed: "Conditionally allowed",
    restricted_or_blocked: "Blocked / restricted",
    not_mentioned: "Unknown"
  };

  return labels[availability];
}

export function formatToolEndorsementType(
  endorsementType: ToolEndorsementType
): string {
  const labels: Record<ToolEndorsementType, string> = {
    officially_endorsed: "Officially endorsed",
    institutionally_licensed_or_procured: "Licensed or procured",
    self_hosted_system: "Self-hosted",
    third_party_service: "Third-party service",
    not_specified: "Not specified"
  };

  return labels[endorsementType];
}

function getToolSegments(claim: PolicyClaim): ToolSegment[] {
  return claim.evidence.flatMap((evidence) => {
    const sourceUrl = evidence.sourceUrl;
    const snapshotHash = evidence.sourceSnapshotHash;
    const rowText = evidence.evidenceSnippet.includes("|")
      ? evidence.evidenceSnippet.split("|")[0].trim()
      : undefined;
    const fullText = [
      claim.claimText,
      claim.claimValue,
      evidence.evidenceSnippet,
      evidence.evidenceSnippetDisplay
    ]
      .filter(Boolean)
      .join(" ");
    const segments = rowText
      ? [rowText]
      : splitSentences(fullText).filter((sentence) => {
          const mentionsTool =
            getMentionedTools(sentence, false).length > 0 ||
            deriveFallbackToolMentions(sentence).length > 0 ||
            genericToolPattern.test(sentence);

          return mentionsTool;
        });

    return segments.map((sentence) => ({
      text: sentence,
      sourceUrl,
      snapshotHash,
      evidenceSnippet: clipSnippet(rowText ? evidence.evidenceSnippet : sentence),
      rowLike: Boolean(rowText)
    }));
  });
}

function parseNormalizedToolClaimValue(
  claimValue: string | undefined
): NormalizedToolClaimValue | undefined {
  if (!claimValue) return undefined;

  try {
    const parsed = JSON.parse(claimValue) as unknown;
    const result = normalizedToolClaimValueSchema.safeParse(parsed);

    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

interface ToolSegment {
  text: string;
  sourceUrl: string;
  snapshotHash: string;
  evidenceSnippet: string;
  rowLike: boolean;
}

function getMentionedTools(text: string, rowLike: boolean): ToolMention[] {
  const mentions = findToolMentions(text);
  const specificMentions = mentions.filter(
    ({ tool }) => !isGenericToolSlug(tool)
  );
  const selfHostedMentions = mentions.filter(({ tool }) => tool === "self_deploy");
  const institutionalMentions = mentions.filter(
    ({ tool }) => tool === "institutional_ai_service"
  );

  if (rowLike) {
    return specificMentions.length
      ? specificMentions
      : selfHostedMentions.length
        ? selfHostedMentions
        : institutionalMentions;
  }

  if (selfHostedMentions.length) {
    return selfHostedMentions;
  }

  if (specificMentions.length) {
    return specificMentions;
  }

  if (institutionalMentions.length) {
    return institutionalMentions;
  }

  return [];
}

function deriveFallbackToolMentions(text: string): ToolMention[] {
  if (genericPlatformPattern.test(text)) {
    return [
      {
        tool: "institutional_ai_service",
        rawToolName: "Institutional AI service",
        provider: "University",
        label: getAiToolCatalogEntry("institutional_ai_service").label
      }
    ];
  }

  if (genericToolPattern.test(text)) {
    return [
      {
        tool: "unspecified_ai_tool",
        rawToolName: "AI tools",
        provider: "Unknown",
        label: getAiToolCatalogEntry("unspecified_ai_tool").label
      }
    ];
  }

  return [];
}

function classifyAvailability(text: string): ToolAvailability {
  if (
    /\b(?:prohibit(?:ed)?|not\s+permitted|not\s+allowed|forbidden|blocked|must\s+not|may\s+not|cannot|can't|do\s+not\s+use|unauthori[sz]ed)\b/i.test(
      text
    )
  ) {
    return "restricted_or_blocked";
  }

  if (
    /\b(?:only\s+approved|approved\s+only|restricted|requires?\s+(?:approval|permission|review)|with\s+(?:approval|permission)|case-by-case|instructor\s+(?:approval|permission)|conditional(?:ly)?)\b/i.test(
      text
    )
  ) {
    return "conditionally_allowed";
  }

  if (
    /\b(?:approved|licensed|procured|provided|available|permitted|allowed|may\s+use|can\s+use|authorized|authorised|endorsed)\b/i.test(
      text
    )
  ) {
    return "allowed";
  }

  return "not_mentioned";
}

function classifyEndorsement(text: string): ToolEndorsementType {
  if (selfHostedPattern.test(text)) {
    return "self_hosted_system";
  }

  if (/\b(?:third-party|third party|external service|vendor|commercial service)\b/i.test(text)) {
    return "third_party_service";
  }

  if (
    !/\bnot\s+(?:institutionally\s+)?licensed\b/i.test(text) &&
    /\b(?:licensed|procured|enterprise|managed account|issued account|contracted|purchased)\b/i.test(text)
  ) {
    return "institutionally_licensed_or_procured";
  }

  if (/\b(?:officially endorsed|endorsed|recommended|approved|provided by|supported by|university-approved|university approved)\b/i.test(text)) {
    return "officially_endorsed";
  }

  return "not_specified";
}

function chooseAvailability(
  current: ToolAvailability,
  next: ToolAvailability
): ToolAvailability {
  const rank: Record<ToolAvailability, number> = {
    restricted_or_blocked: 4,
    conditionally_allowed: 3,
    allowed: 2,
    not_mentioned: 1
  };

  return rank[next] > rank[current] ? next : current;
}

function chooseEndorsementType(
  current: ToolEndorsementType,
  next: ToolEndorsementType
): ToolEndorsementType {
  const rank: Record<ToolEndorsementType, number> = {
    self_hosted_system: 5,
    institutionally_licensed_or_procured: 4,
    officially_endorsed: 3,
    third_party_service: 2,
    not_specified: 1
  };

  return rank[next] > rank[current] ? next : current;
}

function aggregateClaimReviewState(states: ClaimReviewState[]): ClaimReviewState {
  if (states.includes("rejected")) return "needs_review";
  if (states.includes("needs_review")) return "needs_review";
  if (states.includes("machine_candidate")) return "machine_candidate";
  if (states.includes("agent_reviewed")) return "agent_reviewed";
  return "human_reviewed";
}

function hasDuplicateEvidence(
  evidences: ToolEvidenceRecord[],
  evidence: ToolEvidenceRecord
): boolean {
  return evidences.some(
    (item) =>
      item.sourceUrl === evidence.sourceUrl &&
      item.snapshotHash === evidence.snapshotHash &&
      item.evidenceSnippet === evidence.evidenceSnippet
  );
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function clipSnippet(text: string): string {
  if (text.length <= 700) return text;

  return `${text.slice(0, 697).trimEnd()}...`;
}

function compareToolRecords(
  left: UniversityToolRecord,
  right: UniversityToolRecord
): number {
  return (
    left.rawToolName.localeCompare(right.rawToolName) ||
    left.tool.localeCompare(right.tool) ||
    left.universityName.localeCompare(right.universityName)
  );
}

function chooseRawToolName(current: string, next: string): string {
  if (next.length > current.length) return next;
  if (current.length > next.length) return current;

  return current.localeCompare(next) <= 0 ? current : next;
}

function chooseOptionalToolText(
  current: string | undefined,
  next: string | undefined
): string | undefined {
  const currentText = current?.trim();
  const nextText = next?.trim();

  if (!currentText) return nextText || undefined;
  if (!nextText) return currentText;
  if (nextText.length > currentText.length) return nextText;

  return currentText;
}

function isGenericToolSlug(tool: AiToolSlug): boolean {
  return tool === "institutional_ai_service" || tool === "unspecified_ai_tool";
}
