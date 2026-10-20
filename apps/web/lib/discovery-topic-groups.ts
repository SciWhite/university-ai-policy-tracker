// Presentation facets over unchanged published claims. Raw claim types remain available.
export const discoveryPrimaryTopics = [
  "coursework",
  "disclosure",
  "data_safety",
  "tools",
] as const;
export function getDiscoveryTopicKeys(claim: {
  claimType: string;
  claimText: string;
}): string[] {
  const topics = [claim.claimType],
    text = claim.claimText.toLowerCase();
  if (
    claim.claimType === "teaching" ||
    /coursework|assignment|assessment|syllab|classroom|exam|作业|考核|课程/.test(
      text,
    )
  )
    topics.push("coursework");
  if (
    /disclos|declar|acknowledg|attribution|cite|citing|声明|申报|披露/.test(
      text,
    )
  )
    topics.push("disclosure");
  if (
    ["privacy", "security_review"].includes(claim.claimType) ||
    /personal data|confidential|sensitive data|privacy|data protection|隐私|保密|数据保护/.test(
      text,
    )
  )
    topics.push("data_safety");
  if (["ai_tool_treatment", "procurement"].includes(claim.claimType))
    topics.push("tools");
  return [...new Set(topics)];
}
