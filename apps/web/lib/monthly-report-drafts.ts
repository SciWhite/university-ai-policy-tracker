// Prepared for the next combined release. Keep drafts out of the public registry,
// feeds, sitemaps, and latest-report links until the actual publication date is set.
// The public report page renders this spec's findings, not content/reports MDX.
export const september2026ReportDraft = {
  type: "monthly",
  month: "2026-09",
  title: "University AI Policy Dataset Month-End Report: September 2026",
  description:
    "A September 2026 month-end dataset report covering 828 university records, with 19 added claims across 16 university records on AI detection, institutional tools, data protection, course disclosure, and agentic AI governance.",
  releaseLabel: "September 2026 month-end",
  releaseManifestPath: "data/public-releases/history/public-release-20260924-002.json",
  reportPeriod: "1–30 September 2026",
  summaryIntro:
    "The September snapshot contains 5,495 source-backed claims, 3,213 official source attributions, and 5,760 evidence records across 828 university records. Compared with the August report snapshot, it adds 19 claims across 16 distinct records. These are tracker additions, not a count of policies enacted in September.",
  reportFindings: [
    "Two dataset releases were recorded during September: public-release-20260921-001 and public-release-20260924-002. The latter is the selected month-end snapshot; it does not imply that every source was checked on 30 September.",
    "Compared with public-release-20260801-001, university coverage remains at 828 records; claims increase from 5,476 to 5,495, source attributions from 3,195 to 3,213, and evidence records from 5,741 to 5,760.",
    "The two batches add eight and eleven claims respectively. Pennsylvania appears in both batches, giving 16 distinct university records with added claims, rather than 17.",
    "NTHU advises against using third-party AI detection as primary evidence; Penn guidance tells faculty not to upload student work to detectors; Guelph guidance prohibits using detectors to support academic integrity allegations. Their scopes and requirements differ.",
    "Recorded institutional AI services include Queen's University Belfast tools, Penn licensed services, and Toronto's conditional ChatGPT Edu access. UNSW College Mentor AI access is scoped to ELICOS; tool access does not establish permission for every assessment.",
    "CUIMC, Oregon, WashU, and Waterloo additions address tool-specific data conditions. Medical-center, institutional data-classification, and protected-health-information rules must retain their original scope.",
    "UCI and USNH additions cover agentic or autonomous technical tools; Universidad Adolfo Ibáñez addresses institutional governance and research disclosure; Lund addresses consistent communication of course restrictions and reporting requirements.",
    "September collection does not establish September enactment: Lund's recorded guidelines took effect on 15 August, while the Universidad Adolfo Ibáñez policy is dated 6 July. These examples do not establish a measured global trend.",
    "Unpublished research, local redesigns, artwork, and monitoring-only signals are excluded from report findings and totals. Official source language and institutional scope remain controlling."
  ],
  shareImage: {
    alt: "University AI Policy Tracker September 2026 month-end report share image",
    headline: "September 2026 Month-End Report",
    localizedAlt: "University AI Policy Tracker localized September 2026 monthly report"
  }
} as const;
