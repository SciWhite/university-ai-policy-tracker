import type { PublicEntitySummary } from "@uapt/shared";
import { publishedV6Enabled, isPublishedV6Slug } from "./policy-v6-published-gate";
import { v6RecordRevision } from "./v6-effective-records";
import { readingSummaryBasis, verifiedV6ReadingBasis } from "./reading-translations";

/**
 * Published V6 pages use their verified V6 summary revision as the reading
 * basis. Other pages retain the existing canonical/API summary basis.
 */
export function universityReadingBasis(slug: string, summary: PublicEntitySummary) {
  if (!publishedV6Enabled() || !isPublishedV6Slug(slug)) return readingSummaryBasis(summary);
  try {
    const revision = v6RecordRevision(slug);
    return revision ? verifiedV6ReadingBasis(summary, revision.recordSha256) : undefined;
  } catch {
    return undefined;
  }
}
