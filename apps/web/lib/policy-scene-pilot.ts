import { hasCurrentIndexRecoveryBasis } from "@/lib/index-recovery-basis";
import type { PolicyClaim } from "@uapt/shared";

export interface PolicyScenePilot {
  slug: "harvard-university" | "manchester";
  eyebrow: string;
  title: string;
  guidance: string;
  evidenceLabel: string;
  evidenceHref: "#student-policy-heading" | "#claims";
  artworkAlt: string;
  artworkSrc: string;
  snapshotNotice?: string;
}

const scenes: Record<PolicyScenePilot["slug"], PolicyScenePilot> = {
  "harvard-university": {
    slug: "harvard-university",
    eyebrow: "Start with your course",
    title: "Check the assignment rule before you use AI.",
    guidance:
      "Harvard course and unit policies set the context. Check approved-tool status before sharing confidential information.",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt:
      "Student and AI guide reviewing a course syllabus in a campus study space",
    artworkSrc: "/assets/policy-scenes/harvard.jpg"
  },
  manchester: {
    slug: "manchester",
    eyebrow: "Before you submit",
    title: "Check your course rule and acknowledge AI use.",
    guidance:
      "Manchester course-unit rules may broaden or narrow the default. Cite or acknowledge AI outputs you use.",
    evidenceLabel: "Read the reviewed claims",
    evidenceHref: "#claims",
    artworkAlt:
      "Student and AI guide reviewing course instructions and an acknowledgement note",
    artworkSrc: "/assets/policy-scenes/manchester.jpg",
    snapshotNotice: "No reviewed student policy snapshot has been published yet."
  }
};

export function getPolicyScenePilot(
  slug: string,
  claims: PolicyClaim[],
  hasStrongSnapshot: boolean,
  hasClaimsSummary: boolean
): PolicyScenePilot | undefined {
  if (slug !== "harvard-university" && slug !== "manchester") return undefined;
  if (!hasCurrentIndexRecoveryBasis(slug, claims)) return undefined;
  if (slug === "harvard-university" && !hasStrongSnapshot) return undefined;
  if (slug === "manchester" && (hasStrongSnapshot || !hasClaimsSummary)) return undefined;
  return scenes[slug];
}
