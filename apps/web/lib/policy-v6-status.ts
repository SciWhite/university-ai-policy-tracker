/** Color reflects the existing status; it never changes the policy or its scope. */
export function policyV6StatusTone(
  status: string,
): "allowed" | "caution" | "prohibited" | "neutral" {
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
