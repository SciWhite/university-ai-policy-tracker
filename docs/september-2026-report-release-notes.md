# September 2026 report — combined release preparation

Status: local draft; publish with the pending site changes in one build.

## Prepared content and snapshot

- Editorial draft: `content/reports/2026-09.mdx`.
- Route-ready report spec: `apps/web/lib/monthly-report-drafts.ts`.
- Fixed month-end manifest: `data/public-releases/history/public-release-20260924-002.json`.
- July and August registry references now use the fixed 1 August manifest.

The existing public report route renders registry findings, not MDX. The draft
spec is deliberately inactive so it cannot inherit the dataset's 24 September
timestamp as the report's publication date. No draft report is advertised by
feeds, sitemaps, or latest-report links.

## Complete when scheduling the combined release

1. Add `"2026-09"` to `monthlyReportRegistry` using
   `september2026ReportDraft` and an explicit `publishedAt` equal to the actual
   report publication timestamp. Replace the editorial draft's status and
   pending publication line at the same time.
2. Change `currentMonthlyReportSlug` in `reports.ts` to `2026-09` and update both
   August latest-report pointers in `apps/web/public/llms.txt` to September.
3. Preserve the selected September manifest even if a newer dataset is
   published before this combined release.
4. Validate the generated report, chart JSON, feeds, sitemap links, and share
   image alongside the pending site changes. Perform one combined build and
   deployment; verify the report publication date and snapshot after release.

## Local evidence

Counts were reconstructed using `getDatasetReleaseForPublicManifest` for the
August and September manifests: 828/5,476/3,195/5,741 versus
828/5,495/3,213/5,760 (universities/claims/source attributions/evidence records).
Comparison of claim IDs confirms 19 additions. The September artifacts contain
19 approved claim candidates across 16 distinct entity slugs. All 19 additions
are agent-reviewed; this is not a claim of independent human review.

The draft's university-specific statements use the included artifact evidence,
not a fresh live-source audit. Review the selected snapshot's source context
if changing any finding before release. Do not equate these additions with
newly enacted policy documents or a complete month-end monitoring census.

Local checks passed: reconstructed snapshot counts and added claim IDs; fixed
July/August report output (5,476 claims); September draft absent from public
registry; appendix totals; exact September manifest copy; `git diff --check`.
The original dirty checkout had duplicate generated `.next/types/* 2.ts`
declarations. The isolated production-baseline worktree passes normal web
typechecking without modifying that checkout. The report remains inactive;
its production build and report browser acceptance are pending the combined
release. The new support/MCP page browser checks are recorded separately in
`docs/student-plugin-release.md`.
