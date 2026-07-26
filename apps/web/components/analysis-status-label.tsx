import type { AnalysisDimensionStatus } from "@uapt/shared";
import { badgeToneClass, type BadgeTone } from "@/lib/badge-tones";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";
import { translateSurfaceText } from "@/lib/surface-localization";

interface AnalysisStatusLabelProps {
  status: AnalysisDimensionStatus;
  prefix?: string;
  locale?: SupportedLocale;
}

const analysisStatusLabels: Record<AnalysisDimensionStatus, string> = {
  allowed: "Allowed",
  conditionally_allowed: "Conditionally allowed",
  restricted: "Restricted",
  blocked: "Blocked",
  required: "Required",
  recommended: "Recommended",
  not_mentioned: "Not mentioned",
  unclear: "Unclear",
  insufficient_public_evidence: "Insufficient public evidence"
};

const analysisStatusTones: Record<AnalysisDimensionStatus, BadgeTone> = {
  allowed: "positive",
  recommended: "positive",
  required: "positive",
  conditionally_allowed: "warning",
  unclear: "warning",
  insufficient_public_evidence: "warning",
  not_mentioned: "warning",
  restricted: "danger",
  blocked: "danger"
};

export function AnalysisStatusLabel({
  locale = DEFAULT_LOCALE,
  prefix = "Status",
  status
}: AnalysisStatusLabelProps) {
  return (
    <span
      className={badgeToneClass("analysis-status-label", analysisStatusTones[status])}
      data-analysis-status={status}
    >
      {prefix ? `${translateSurfaceText(prefix, locale)}: ` : null}
      {translateSurfaceText(formatAnalysisStatus(status), locale)}
    </span>
  );
}

export function formatAnalysisStatus(status: AnalysisDimensionStatus): string {
  return analysisStatusLabels[status];
}
