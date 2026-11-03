import type { AnalysisDimensionStatus } from "@uapt/shared";
import { badgeToneClass, type BadgeTone } from "@/lib/badge-tones";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";
import { translateSurfaceText } from "@/lib/surface-localization";
import type { ReadingLocale } from "@/lib/language-catalog";

interface AnalysisStatusLabelProps {
  status: AnalysisDimensionStatus;
  prefix?: string;
  locale?: SupportedLocale;
  readingLocale?: ReadingLocale;
  sharedUiText?: Readonly<Record<string, string>>;
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
  readingLocale = locale,
  sharedUiText = {},
  prefix = "Status",
  status
}: AnalysisStatusLabelProps) {
  return (
    <span
      className={badgeToneClass("analysis-status-label", analysisStatusTones[status])}
      data-analysis-status={status}
    >
      {prefix ? `${translateSurfaceText(prefix, readingLocale, sharedUiText)}: ` : null}
      {translateSurfaceText(formatAnalysisStatus(status), readingLocale, sharedUiText)}
    </span>
  );
}

export function formatAnalysisStatus(status: AnalysisDimensionStatus): string {
  return analysisStatusLabels[status];
}
