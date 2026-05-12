const stateLabels: Record<string, string> = {
  machine_candidate: "Machine candidate",
  agent_reviewed: "Agent reviewed",
  human_reviewed: "Human reviewed",
  institution_verified: "Institution verified",
  needs_review: "Needs review",
  rejected: "Rejected"
};

interface StateLabelProps {
  reviewState: string;
  prefix?: string;
}

export function StateLabel({ reviewState, prefix = "Review" }: StateLabelProps) {
  const label = stateLabels[reviewState] ?? formatUnknownState(reviewState);
  const knownState = Object.prototype.hasOwnProperty.call(stateLabels, reviewState);

  return (
    <span
      className="state-label"
      data-review-state={knownState ? reviewState : "unknown"}
    >
      {prefix ? `${prefix}: ` : null}
      {label}
    </span>
  );
}

function formatUnknownState(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Unknown";
}
