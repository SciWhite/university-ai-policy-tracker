import {publishedV6Enabled,publishedV6SchoolNames,publishedV6School} from "./policy-v6-published";
import { createHash } from "node:crypto";
import type { PolicyClaim, PolicyAnalysisDimensionKey } from "@uapt/shared";
import { getPublicUniversitySummaryBySlug } from "./catalog";
import { getLoadedPolicySnapshotBySlug } from "./policy-snapshots";
import {
  isStrongStudentSnapshot,
  getSnapshotDimensions,
} from "@/components/student-policy-snapshot";
import { policyV6RecordCopy } from "./policy-v6-record-copy";
import { translatePolicyReferenceUi } from "./policy-reference-ui";
import { buildPolicyAnalysisProfile } from "./policy-analysis";
import { getRepairAnalysisContext } from "./public-record-repairs";
import mitPin from "../../../data/public-record-repairs/current.json";
import { policyV6Slugs, policyV6BundlePreviewSlugs } from "./policy-v6-gate";
import type { SupportedLocale } from "./i18n";
import { policyV6ReviewState } from "./policy-v6-review";
import {getV6StudentActions,type V6StudentActions} from './policy-v6-student-actions';
import { getLocalV6Bundle, getLocalV6StudentActions } from "./policy-v6-bundle";
import {
  getLocalV6Evidence,
  type LocalV6Evidence,
} from "./policy-v6-local-evidence";
export { isPolicyV6Preview } from "./policy-v6-gate";

export interface LabTopic {
  key: string;
  title: string;
  status: string;
  statusLabel: string;
  summary: string;
  scope: string;
  basisKind: "strong_snapshot" | "record_analysis" | "local_agent_reviewed" | "local_reviewed_bundle";
  actions: string[];
  sources: { url: string; hash: string }[];
  claims: {
    id: string;
    text: string;
    checkedAt?: string;
    basisObjectType?: "source";
    evidence: {
      quote: string;
      url: string;
      title: string;
      language: string;
      location?: string;
      retrievedAt?: string;
    }[];
  }[];
}
export interface LabSchool {
  v6ReviewState?: "agent_reviewed";
  slug: string;
  name: string;
  checkedAt: string;
  generatedAt?: string;
  fingerprint: string;
  revision: string;
  snapshotStatus: string;
  newReviewPending: boolean;
  reviewedClaimCount: number;
  heldClaims: { id: string; text: string }[];
  topics: LabTopic[];
  additionalTopics: LabTopic[];
}
export interface PolicyV6Data {
  locale: SupportedLocale;
  published?: boolean;
  currentSlug: string;
  /** Names only; other schools' evidence is fetched when selected for comparison. */
  schoolNames?: Record<string, string>;
  schools: LabSchool[];
  studentActions?: V6StudentActions;
  studentActionsPilot?: boolean;
}
const titles: Record<string, string> = {
  coursework: "Coursework",
  exams: "Exams",
  disclosure: "Disclosure",
  privacy_data: "Privacy & sensitive data",
  approved_tools: "Approved tools",
  research_publication: "Research & publication",
  academic_integrity: "Academic integrity",
  teaching_guidance: "Teaching guidance",
  security_procurement: "Security and procurement",
};
const labels: Record<string, string> = {
  allowed: "Allowed in this scope",
  conditionally_allowed: "Conditional",
  restricted: "Restricted",
  blocked: "Blocked",
  required: "Required",
  recommended: "Recommended",
  not_mentioned: "Not mentioned in reviewed sources",
  unclear: "Unclear",
  insufficient_public_evidence: "Insufficient public evidence",
};
const analysisKey: Record<string, PolicyAnalysisDimensionKey> = {
  coursework: "coursework",
  exams: "exams",
  disclosure: "ai_disclosure",
  privacy_data: "privacy_data_entry",
  approved_tools: "approved_tools",
  research_publication: "research_guidance",
};
const reviewed = (c: PolicyClaim) =>
  ["agent_reviewed", "human_reviewed"].includes(c.reviewState);

function localSchool(
  local: LocalV6Evidence,
  locale: SupportedLocale,
): LabSchool {
  const topic = (d: LocalV6Evidence["dimensions"][number]): LabTopic => {
    const ids = d.basis?.claimIds ?? d.evidenceClaimIds ?? [];
    const claims = local.record.claims.filter((c) => ids.includes(c.id ?? ""));
    const title =
      (
        {
          academic_integrity: policyV6RecordCopy(locale).academicIntegrity,
          teaching_guidance: policyV6RecordCopy(locale).teachingGuidance,
          security_procurement: policyV6RecordCopy(locale).securityProcurement,
        } as Record<string, string>
      )[d.key] ?? translatePolicyReferenceUi(titles[d.key] ?? d.key, locale);
    return {
      key: d.key,
      title,
      status: d.status,
      statusLabel: translatePolicyReferenceUi(
        labels[d.status] ?? d.status,
        locale,
      ),
      summary:
        local.record.entity.slug === "harvard-university" &&
        d.key === "coursework"
          ? "Permission depends on the School and task. HGSE permits learning uses such as clarification and brainstorming, but submitting AI-created assignments as your own is prohibited unless the instructor specifies otherwise. Social Studies has a broader default prohibition covering submitted work and thesis stages, with scoped course alternatives and approved thesis exceptions."
          : local.record.entity.slug === "university-of-cambridge" &&
              d.key === "disclosure"
            ? "In summative assessment, presenting unacknowledged AI-generated content as your own is misconduct unless the brief explicitly states otherwise. Engineering requires declaring preparation use unless the brief says otherwise. General educational advice uses the significant AND unrevised contribution condition."
            : local.record.entity.slug === "university-of-cambridge" &&
                d.key === "coursework"
              ? "Appropriate personal study and formative use is broadly permitted subject to local rules. In summative assessment, presenting unacknowledged AI-generated content as your own is misconduct unless the assessment brief explicitly states otherwise. Engineering and Manufacturing Engineering Triposes have additional conditions."
              : d.summary,
      scope:
        locale === "zh"
          ? "请按引文中的学院、课程、评估及人员范围阅读"
          : "Read the school, course, assessment and audience scope in each quoted claim",
      basisKind: "local_agent_reviewed",
      actions: [],
      sources: sourceView(claims),
      claims: claimView(claims),
    };
  };
  return {
    slug: local.record.entity.slug,
    name: local.record.entity.name,
    checkedAt: local.record.lastCheckedAt ?? "",
    fingerprint: local.fingerprint,
    revision: local.revision,
    snapshotStatus: "v6_agent_reviewed",
    v6ReviewState: policyV6ReviewState(
      local.record.entity.slug,
      local.fingerprint,
    ),
    newReviewPending: false,
    reviewedClaimCount: local.record.claims.length,
    heldClaims: [],
    topics: local.dimensions.map(topic),
    additionalTopics: local.additionalDimensions.map(topic),
  };
}
function claimView(claims: PolicyClaim[]): LabTopic["claims"] {
  return claims.map((c) => ({
    id: c.id ?? "",
    text: c.claimText,
    checkedAt: c.lastCheckedAt,
    evidence: c.evidence.map((e) => ({
      quote: e.evidenceSnippet,
      url: e.sourceUrl,
      title: e.attribution.citationTitle,
      language: e.sourceLanguage ?? "und",
      location: e.snippetLocation,
      retrievedAt: e.retrievedAt,
    })),
  }));
}
function sourceView(claims: PolicyClaim[]): LabTopic["sources"] {
  const seen = new Set<string>();
  return claims
    .flatMap((c) => c.evidence)
    .flatMap((e) => {
      const key = e.sourceUrl + ":" + e.sourceSnapshotHash;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ url: e.sourceUrl, hash: e.sourceSnapshotHash }];
    });
}

/** Uses current published repair loaders; held snapshots are never presented as approved summaries.
 * Harvard's incomplete private crawl is intentionally excluded until separately accepted. */
export async function getPolicyV6Data(
  locale: SupportedLocale,
  currentSlug = "harvard-university",
): Promise<PolicyV6Data> {
  if (process.env.UAPT_CANDIDATE_REPAIR_SLUG)
    throw new Error(
      "V6 published-basis preview must not activate a private candidate loader",
    );
  const current = publishedV6School(currentSlug, locale);
  if(current) {
    const publishedBundle = getLocalV6Bundle(currentSlug, locale);
    const acceptedActions = publishedBundle ? getLocalV6StudentActions(publishedBundle) : undefined;
    const studentActionsPilot=true;
    return {
      locale,
      currentSlug,
      schools: [structuredClone(current)],
      schoolNames: publishedV6SchoolNames(locale),
      published: true,
      ...(studentActionsPilot ? {studentActionsPilot, studentActions:acceptedActions ?? getV6StudentActions(current)} : {}),
    };
  }
  const slugs: string[] = [...policyV6Slugs];
  if (policyV6BundlePreviewSlugs.some((slug) => slug === currentSlug)) slugs.push(currentSlug);
  const schools = await Promise.all(slugs.map((slug) => getPolicyV6School(locale, slug)));
  const localCurrent = schools.find((school) => school?.slug === currentSlug);
  const localBundle = process.env.NODE_ENV === "development" ? getLocalV6Bundle(currentSlug, locale) : undefined;
  const localActions = localBundle ? getLocalV6StudentActions(localBundle) : undefined;
  return {
    locale,
    currentSlug,
    schools: schools.filter((s): s is NonNullable<typeof s> => Boolean(s)),
    ...(localActions && localCurrent ? { studentActionsPilot: true, studentActions: localActions } : {}),
  };
}

/** On-demand comparison uses the same published loaders; local accepted records stay development-only. */
export async function getPolicyV6School(
  locale: SupportedLocale,
  slug: string,
): Promise<LabSchool | undefined> {
  if (process.env.UAPT_CANDIDATE_REPAIR_SLUG)
    throw new Error(
      "V6 comparison must not activate an unrelated candidate loader",
    );
  const published=publishedV6School(slug,locale);
  if(published)return published;
  const local = getLocalV6Evidence(slug);
  if (local) return localSchool(local, locale);
  const bundle = getLocalV6Bundle(slug, locale);
  if (bundle) return bundle.school;
  const [summary, loaded] = await Promise.all([
    getPublicUniversitySummaryBySlug(slug),
    getLoadedPolicySnapshotBySlug(slug),
  ]);
  if (!summary) return undefined;
  const snapshot = isStrongStudentSnapshot(loaded)
    ? loaded.snapshot
    : undefined;
  const claims = summary.claims.filter(reviewed);
  const context = getRepairAnalysisContext(summary);
  const revision =
    context?.revision ??
    (slug === mitPin.slug ? mitPin.revision : "published baseline");
  const profile = buildPolicyAnalysisProfile(summary);
  const recordTopic = (
    key: string,
    mapped: PolicyAnalysisDimensionKey,
  ): LabTopic => {
    const dimension = profile.dimensions.find((d) => d.key === mapped)!;
    const basis = claims.filter((c) =>
      dimension.evidenceClaimIds.includes(c.id ?? ""),
    );
    const complete = dimension.evidenceClaimIds.every((id) =>
      basis.some((c) => c.id === id),
    );
    return {
      key,
      title:
        (
          {
            academic_integrity: policyV6RecordCopy(locale).academicIntegrity,
            teaching_guidance: policyV6RecordCopy(locale).teachingGuidance,
            security_procurement:
              policyV6RecordCopy(locale).securityProcurement,
          } as Record<string, string>
        )[key] ??
        translatePolicyReferenceUi(titles[key] ?? dimension.label, locale),
      status: complete ? dimension.status : "insufficient_public_evidence",
      statusLabel: translatePolicyReferenceUi(
        labels[complete ? dimension.status : "insufficient_public_evidence"] ??
          dimension.status,
        locale,
      ),
      summary: complete
        ? dimension.summary
        : translatePolicyReferenceUi(
            "No reviewed evidence is included in this dimension.",
            locale,
          ),
      scope: "Scope stated in the cited claims",
      basisKind: "record_analysis",
      actions: [],
      sources: sourceView(basis),
      claims: claimView(basis),
    };
  };
  const topics = snapshot
    ? getSnapshotDimensions(snapshot).map(
        (d): LabTopic => ({
          key: d.key,
          title: translatePolicyReferenceUi(titles[d.key], locale),
          status: d.status,
          statusLabel: translatePolicyReferenceUi(labels[d.status], locale),
          summary: d.summary,
          scope: {
            university_wide: "University-wide",
            unit_specific: "Unit-specific",
            course_or_assessment: "Course or assessment",
            research_or_thesis: "Research or thesis",
            mixed: "Mixed scope",
          }[snapshot.scope],
          basisKind: "strong_snapshot",
          actions: d.actions.do,
          sources: d.basis.sources.map((s) => ({
            url: s.sourceUrl,
            hash: s.sourceSnapshotHash,
          })),
          claims: claimView(
            claims.filter((c) => d.basis.claimIds.includes(c.id ?? "")),
          ),
        }),
      )
    : Object.entries(analysisKey).map(([key, mapped]) =>
        recordTopic(key, mapped),
      );
  return {
    v6ReviewState: policyV6ReviewState(
      slug,
      snapshot?.basisFingerprint ??
        createHash("sha256")
          .update(JSON.stringify(summary.claims))
          .digest("hex"),
    ),
    slug,
    name: summary.entity.name,
    checkedAt: summary.lastCheckedAt ?? "",
    generatedAt: snapshot?.generatedAt,
    fingerprint:
      snapshot?.basisFingerprint ??
      createHash("sha256").update(JSON.stringify(summary.claims)).digest("hex"),
    revision,
    snapshotStatus: loaded?.validation.effectiveStatus ?? "not_available",
    newReviewPending: slug === "harvard-university",
    reviewedClaimCount: claims.length,
    heldClaims: summary.claims
      .filter((c) => !reviewed(c))
      .map((c) => ({ id: c.id ?? "", text: c.claimText })),
    topics,
    additionalTopics: [
      "academic_integrity",
      "teaching_guidance",
      "security_procurement",
    ].map((key) => recordTopic(key, key as PolicyAnalysisDimensionKey)),
  } satisfies LabSchool;
}
