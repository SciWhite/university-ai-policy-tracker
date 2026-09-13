import { DEFAULT_LOCALE, getPathnameWithoutLocale, type SupportedLocale } from "@/lib/i18n";

/**
 * P0 Google index-recovery pilot (2026-09-12).
 *
 * Scope: a fixed allowlist of ten university detail pages receives
 * content-expression and metadata recovery only. Non-pilot pages keep the
 * pre-existing templates exactly. The pilot deliberately mixes universities
 * with an effective `strong` student policy snapshot (Harvard, UNSW, Sydney,
 * NUS, Oxford, Utrecht) and universities with no published snapshot
 * (Bristol, Manchester, Edinburgh, Deakin).
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

export const INDEX_RECOVERY_CONTENT_VERSION = "2026-09-13";

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
  "deakin-university"
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
   * snapshot (Bristol, Manchester, Edinburgh, Deakin).
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

export function getIndexRecoveryPilotLocaleRestriction(
  slug: string | undefined
): readonly SupportedLocale[] | undefined {
  // University detail pages have not passed any translation review for their
  // substantive body (claims, evidence, snapshot prose stay English/original
  // on every locale route), so pilot pages only declare the English alternate.
  return slug && isIndexRecoveryPilotSlug(slug) ? [DEFAULT_LOCALE] : undefined;
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
