import type { AnalysisDimensionStatus } from "@uapt/shared";

interface AnalysisStatusLabelProps {
  status: AnalysisDimensionStatus;
  prefix?: string;
}

export function AnalysisStatusLabel({
  prefix = "Status",
  status
}: AnalysisStatusLabelProps) {
  return (
    <span className="analysis-status-label" data-analysis-status={status}>
      {prefix ? `${prefix}: ` : null}
      {formatAnalysisStatus(status)}
    </span>
  );
}

export function formatAnalysisStatus(status: AnalysisDimensionStatus): string {
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
