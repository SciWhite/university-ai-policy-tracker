import { DEFAULT_LOCALE, getPathnameWithoutLocale, type SupportedLocale } from "@/lib/i18n";

/**
 * P0 Google index-recovery pilot (2026-09-12).
 *
 * Scope: a fixed allowlist of twenty university detail pages receives
 * content-expression and metadata recovery only. Non-pilot pages keep the
 * pre-existing templates exactly. The initial ten-page pilot mixes universities
 * with an effective `strong` student policy snapshot (Harvard, UNSW, Sydney,
 * NUS, Oxford, Utrecht) and universities with no published snapshot
 * (Bristol, Manchester, Edinburgh, Deakin). The five-page V1-to-V3 extension
 * adds four strong snapshots and a claims-only Surrey page. The next five
 * add a strong Auckland snapshot and four claims-only records.
 *
 * Everything in this module is deterministic static data. No model calls and
 * no request-time generation: the curated summaries below were authored once
 * from the current agent-reviewed claims of each record (see
 * docs/google-index-recovery-p0-review.md for the claim-level evidence
 * basis). Fail-closed rules:
 * - `claimsSummary` renders only when the page has no effective strong
 *   snapshot; it never describes a student policy snapshot.
 * - Strong-snapshot pages derive their description from the reviewed
 *   snapshot summary, not from this curated text.
 * - A listed or university-provided tool is never described as permission
 *   for coursework or exams; local scope stays local.
 */

export const INDEX_RECOVERY_CONTENT_VERSION = "2026-09-27";

export const INDEX_RECOVERY_PILOT_SLUGS = [
  "harvard-university",
  "unsw-sydney",
  "university-of-sydney",
  "national-university-of-singapore",
  "university-of-oxford",
  "utrecht-university",
  "university-of-bristol",
  "manchester",
  "edinburgh",
  "deakin-university",
  "university-of-surrey",
  "imperial-college-london",
  "adelaide-university",
  "de-la-salle-university",
  "ubc",
  "university-of-queensland",
  "university-of-johannesburg",
  "anu",
  "durham-university",
  "university-of-auckland"
] as const;

export type IndexRecoveryPilotSlug = (typeof INDEX_RECOVERY_PILOT_SLUGS)[number];

export interface IndexRecoveryClaimsSummary {
  /** Visible SSR summary rendered in the Reviewed record section. */
  summary: string;
  /** Shorter meta/JSON-LD description consistent with `summary`. */
  metaDescription: string;
}

export interface IndexRecoveryPilotContent {
  /** Short title clause appended after "<Name> AI policy:". */
  titleTheme: string;
  /**
   * Claims-derived summary. Only defined for pilots without a published
   * snapshot (Bristol, Manchester, Edinburgh, Deakin, Surrey).
   */
  claimsSummary?: IndexRecoveryClaimsSummary;
}

export const indexRecoveryPilotContent: Record<
  IndexRecoveryPilotSlug,
  IndexRecoveryPilotContent
> = {
  "harvard-university": {
    titleTheme: "course-level rules and confidential-data limits"
  },
  "unsw-sydney": {
    titleTheme: "assessment-category framework"
  },
  "university-of-sydney": {
    titleTheme: "two-lane assessment model"
  },
  "national-university-of-singapore": {
    titleTheme: "assessment and approved-tool rules"
  },
  "university-of-oxford": {
    titleTheme: "assessment declarations and thesis rules"
  },
  "utrecht-university": {
    titleTheme: "AI index and tool allow-listing"
  },
  "university-of-bristol": {
    titleTheme: "four-category assessment rules",
    claimsSummary: {
      summary:
        "University of Bristol guidance for taught degree programmes uses a " +
        "four-category system for AI use in assessments, from Category 1 " +
        "(prohibited) to Category 4 (integral, AI required). Using AI or " +
        "translation tools for more than generating occasional short phrases " +
        "or checking basic grammar and spelling is treated as cheating unless " +
        "assessment instructions allow more comprehensive use. For research " +
        "degrees, generative AI tools may not be used to write any text used " +
        "in theses or APM reports.",
      metaDescription:
        "Bristol's taught-programme guidance sets four AI assessment " +
        "categories from prohibited to integral; AI use beyond occasional " +
        "phrases and grammar checking is treated as cheating unless assessment instructions allow more comprehensive use; PGR theses " +
        "and APM reports may not be written with generative AI."
    }
  },
  manchester: {
    titleTheme: "five principles and school-level course rules",
    claimsSummary: {
      summary:
        "The University of Manchester does not ban generative AI and asks all " +
        "staff and students to follow five core principles: transparency, " +
        "accountability, competence, responsible use, and respect. The " +
        "default AI position can be broadened or narrowed for specific course " +
        "units with School-level approval, students must cite or acknowledge " +
        "AI outputs they use, and submitting AI-created work as one's own is " +
        "plagiarism. University-approved enterprise AI tools must be used " +
        "whenever there is a risk of inappropriate disclosure.",
      metaDescription:
        "Manchester does not ban generative AI; five core principles apply, " +
        "the default position can be broadened or narrowed per course unit, " +
        "and students must cite or acknowledge AI outputs they use."
    }
  },
  edinburgh: {
    titleTheme: "assessment-level rules and the ELM platform",
    claimsSummary: {
      summary:
        "The University of Edinburgh does not ban generative AI by students, " +
        "though its use is restricted for much assessed work. Permissions are " +
        "set at assessment and course level, students must acknowledge GenAI " +
        "use before submitting assessed work, and AI agents or AI browsers " +
        "must not be used to complete work inside virtual learning " +
        "environments, with third-party AI translation apps also not " +
        "permitted in class. ELM (Edinburgh access to Language Models) is " +
        "the university's own platform for safer access to generative AI, and " +
        "presenting AI-generated content as one's own work is academic " +
        "misconduct.",
      metaDescription:
        "Edinburgh does not ban generative AI but restricts it for much " +
        "assessed work: permissions are set per assessment, GenAI use must be " +
        "acknowledged before submission, and ELM is the university's own AI " +
        "access platform."
    }
  },
  "deakin-university": {
    titleTheme: "acknowledgement and HDR thesis limits",
    claimsSummary: {
      summary:
        "Deakin guidance says generative AI may be used as a starting point " +
        "for some study tasks, but not to write the final assessment or do " +
        "the work being assessed. Students should acknowledge genAI use that " +
        "contributed to developing assessment work, including the tool, " +
        "access date, prompts, output, and where it was used. For HDR theses, " +
        "generative AI use is limited to copyediting and proofreading. Deakin " +
        "lists approved genAI and digital learning tools including Deakin " +
        "GEM, Studiosity+, Microsoft Copilot for web, and FeedbackFruits.",
      metaDescription:
        "Deakin allows genAI as a starting point for study tasks but not to " +
        "write assessed work, asks students to acknowledge genAI use in " +
        "assessment development, and limits HDR thesis use to copyediting " +
        "and proofreading."
    }
  },
  "university-of-surrey": {
    titleTheme: "assessment briefs and approved-tool data checks",
    claimsSummary: {
      summary:
        "Surrey advises students to check the assessment brief or module leader before using generative AI for a task. Its GenAI procedure requires users to read the procedure and restricts personal, confidential, and commercially sensitive information to tools approved for that data. My AI Surrey is listed as a university service, but that listing does not decide permission for an assessment.",
      metaDescription:
        "Surrey students should check their assessment brief or module leader for task-specific AI use; protected data requires an appropriately approved tool. No reviewed student policy snapshot is published."
    }
  },
  "imperial-college-london": {
    titleTheme: "department assessment rules and AI acknowledgement"
  },
  "adelaide-university": {
    titleTheme: "course, invigilated exam and acknowledgement rules"
  },
  "de-la-salle-university": {
    titleTheme: "syllabus AI levels and written disclosure"
  },
  ubc: {
    titleTheme: "express assessment permission and personal-data limits"
  },
  "university-of-queensland": {
    titleTheme: "course-profile AI rules and acknowledgement",
    claimsSummary: {
      summary: "UQ course profiles and assessment directions set when and how AI may be used, including machine translation. Students must acknowledge AI use in assessment, including brainstorming, editing and proofreading; unattributed use or use against staff directions can be academic misconduct. UQ has disabled Turnitin's AI writing indicator since Semester 2, 2025.",
      metaDescription: "UQ course profiles set task-specific AI rules, students must acknowledge AI use in assessment, and the Turnitin AI writing indicator has been disabled since Semester 2, 2025."
    }
  },
  "university-of-johannesburg": {
    titleTheme: "course rules and AI acknowledgement",
    claimsSummary: {
      summary: "University of Johannesburg students are directed to the applicable course, department, faculty and university AI rules before producing assignments. Its reviewed practice note says AI use should be acknowledged, and presenting AI-generated work as one's own is academic dishonesty. This is a summary of reviewed statements, not a complete student permission list.",
      metaDescription: "UJ students should check course, department and faculty AI rules, acknowledge AI use, and not present AI-generated work as their own."
    }
  },
  anu: {
    titleTheme: "course-convener rules and Law School limits",
    claimsSummary: {
      summary: "ANU lets course conveners and colleges set AI requirements for individual assessments, so students should check class summaries and assessment outlines. Submitting AI-generated content as one's own breaches academic integrity. ANU Law School has narrower rules: AI drafting is prohibited for graded assignments, while permitted limited use must be declared in the first footnote. Personal information needs express consent before use with AI.",
      metaDescription: "ANU assessment AI rules vary by course and college; AI-generated work must not be claimed as one's own. Law School drafting and disclosure rules are narrower, and personal information requires consent."
    }
  },
  "durham-university": {
    titleTheme: "four assessment tiers and Common Awards limits",
    claimsSummary: {
      summary: "Durham describes four assessment tiers: No GenAI Allowed, Selective, Allowed and Embedded. Students should use the tier and task instructions for their own assessment. The separate Common Awards rules require an AI declaration in summative assignments and prohibit presenting AI-generated substantive content as the student's own. Those Common Awards requirements are not a campus-wide rule for every module.",
      metaDescription: "Durham uses four GenAI assessment tiers. Common Awards summative assignments have a separate AI declaration and substantive-content rule; check the tier for your own task."
    }
  },
  "university-of-auckland": {
    titleTheme: "Two-Lane assessments and Law School limits"
  }
};

export function isIndexRecoveryPilotSlug(
  slug: string
): slug is IndexRecoveryPilotSlug {
  return (INDEX_RECOVERY_PILOT_SLUGS as readonly string[]).includes(slug);
}

/**
 * Resolves the pilot slug for a university detail path such as
 * `/universities/harvard-university` or `/zh/universities/harvard-university`.
 * Returns undefined for non-university or non-pilot paths.
 */
export function getIndexRecoveryPilotSlugFromPath(
  pathname: string
): IndexRecoveryPilotSlug | undefined {
  const path = getPathnameWithoutLocale(pathname);
  const match = path.match(/^\/universities\/([a-z0-9-]+)\/?$/);
  const slug = match?.[1];
  return slug && isIndexRecoveryPilotSlug(slug) ? slug : undefined;
}

/**
 * Original 10-school SEO restriction cohort from upstream main.
 * Preserved independently of the expanded 20 curated content/scene basis and 33 published V4 UI cohort.
 */
export const ORIGINAL_INDEX_RECOVERY_SEO_RESTRICTION_SLUGS = [
  "harvard-university",
  "unsw-sydney",
  "university-of-sydney",
  "national-university-of-singapore",
  "university-of-oxford",
  "utrecht-university",
  "university-of-bristol",
  "manchester",
  "edinburgh",
  "deakin-university"
] as const;

export function isOriginalIndexRecoverySeoRestrictionSlug(slug: string): boolean {
  return (ORIGINAL_INDEX_RECOVERY_SEO_RESTRICTION_SLUGS as readonly string[]).includes(slug);
}

export function getIndexRecoveryPilotLocaleRestriction(
  slug: string | undefined
): readonly SupportedLocale[] | undefined {
  // University detail pages have not passed any translation review for their
  // substantive body (claims, evidence, snapshot prose stay English/original
  // on every locale route), so original pilot pages only declare the English alternate.
  return slug && isOriginalIndexRecoverySeoRestrictionSlug(slug) ? [DEFAULT_LOCALE] : undefined;
}

export interface IndexRecoveryDescriptionInput {
  slug: string;
  /** Effective strong snapshot summary, when the page is strong. */
  strongSnapshotSummary?: string;
  /** Verified against the pinned reviewed claim and evidence basis. */
  basisVerified?: boolean;
  reviewedClaimCount: number;
  officialSourceCount: number;
}

/**
 * Builds the unique meta description for a pilot page. Strong pages quote the
 * reviewed snapshot summary; claims-summary pages use the curated
 * metaDescription. Returns undefined for non-pilot slugs.
 */
export function buildIndexRecoveryDescription(
  input: IndexRecoveryDescriptionInput
): string | undefined {
  if (!isIndexRecoveryPilotSlug(input.slug) || !input.basisVerified || input.reviewedClaimCount < 1) return undefined;

  const lead = input.strongSnapshotSummary
    ? input.strongSnapshotSummary
    : indexRecoveryPilotContent[input.slug].claimsSummary?.metaDescription;
  if (!lead) return undefined;

  return (
    `${lead} Reviewed ${input.reviewedClaimCount} policy claim` +
    `${input.reviewedClaimCount === 1 ? "" : "s"} from ` +
    `${input.officialSourceCount} official source` +
    `${input.officialSourceCount === 1 ? "" : "s"}.`
  );
}

export function buildIndexRecoveryTitle(
  displayName: string,
  slug: string,
  basisVerified = false
): string | undefined {
  if (!isIndexRecoveryPilotSlug(slug) || !basisVerified) return undefined;
  const content = indexRecoveryPilotContent[slug];

  return `${displayName} AI policy: ${content.titleTheme}`;
}
