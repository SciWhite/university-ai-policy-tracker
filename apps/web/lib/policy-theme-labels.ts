import type { PolicyClaimType } from "@uapt/shared";

const policyThemeLabels: Record<PolicyClaimType, string> = {
  academic_integrity: "Academic integrity",
  ai_tool_treatment: "AI tool treatment",
  other: "Other policy",
  privacy: "Privacy",
  procurement: "Procurement",
  research: "Research",
  security_review: "Security review",
  source_status: "Source status",
  teaching: "Teaching"
};

export function getPolicyThemeLabel(theme: PolicyClaimType): string {
  return policyThemeLabels[theme];
}

export function getPolicyThemeLabels(
  themes: PolicyClaimType[]
): Array<{ theme: PolicyClaimType; label: string }> {
  return themes.map((theme) => ({ theme, label: getPolicyThemeLabel(theme) }));
}
