/** Color reflects the existing status; it never changes the policy or its scope. */
export function policyV6StatusTone(
  status: string,
  universitySlug?: string,
): "allowed" | "caution" | "prohibited" | "neutral" {
  if (universitySlug === "imperial-college-london") {
    if (status === "restricted") return "prohibited";
    if (status === "recommended") return "allowed";
  }
  if (status === "blocked") return "prohibited";
  if (status === "allowed") return "allowed";
  if (
    ["conditionally_allowed", "restricted", "required", "unclear"].includes(
      status,
    )
  )
    return "caution";
  return "neutral";
}
