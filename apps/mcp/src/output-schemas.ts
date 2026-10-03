import { z } from "zod";
import { policyClaimSchema, policySnapshotSchema } from "@uapt/shared";
import { topicSchema } from "./catalog.js";

const base = {
  releaseId: z.string(),
  releasePublishedAt: z.string().datetime(),
  limitations: z.array(z.string()).describe("Scope and time limitations that must accompany the answer")
};
export const resolutionOutput = z.object({
  ...base,
  status: z.enum(["resolved", "ambiguous", "not_found"]),
  slug: z.string().optional(),
  candidates: z.array(z.object({ slug: z.string(), name: z.string(), country: z.string().optional(), trackerUrl: z.string().url() })),
  moreCandidates: z.boolean().optional()
});
export const policyOutput = z.object({
  ...base,
  status: z.enum(["ok", "insufficient_evidence", "not_found"]),
  message: z.string().optional(),
  university: z.string().optional(), slug: z.string().optional(),
  lastCheckedAt: z.string().datetime().optional(),
  trackerUrl: z.string().url().optional(), publicJsonUrl: z.string().url().optional(),
  snapshotStatus: z.enum(["strong", "unavailable"]).optional(),
  scope: policySnapshotSchema.shape.scope.optional(),
  audiences: policySnapshotSchema.shape.audiences.optional(),
  summary: z.string().optional(),
  dimensions: z.array(policySnapshotSchema.shape.dimensions.element).optional(),
  claims: z.array(z.object({
    id: z.string(), claimType: policyClaimSchema.shape.claimType, text: z.string(),
    confidence: z.number(), reviewState: policyClaimSchema.shape.reviewState,
    lastCheckedAt: z.string().datetime().optional(), trackerEvidenceUrl: z.string().url(), officialSourceUrls: z.array(z.string().url())
  })).optional(),
  totalRelevantClaims: z.number().int().nonnegative().optional(),
  remainingClaimIds: z.array(z.string()).optional(),
  insufficientTopics: z.array(topicSchema).optional(), evidenceNotice: z.string().optional()
});
export const evidenceOutput = z.object({
  ...base,
  status: z.enum(["ok", "insufficient_evidence", "not_found"]),
  slug: z.string().optional(), trackerUrl: z.string().url().optional(), evidenceUrl: z.string().url().optional(),
  claims: z.array(policyClaimSchema.extend({ trackerEvidenceUrl: z.string().url() })), missingClaimIds: z.array(z.string()).optional()
});
