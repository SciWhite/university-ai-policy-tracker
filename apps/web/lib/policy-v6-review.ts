import approval from "./policy-v6-review.json";
import type { SupportedLocale } from "./i18n";
/** User-confirmed ChatGPT agent approval of the six local V6 views; not a public snapshot promotion. */
export function policyV6AgentReviewLabel(locale: SupportedLocale): string {
  return {
    en: "Reviewed",
    zh: "已审核",
    fr: "Vérifié",
    pl: "Zweryfikowano",
    es: "Revisado",
    nl: "Beoordeeld",
    ms: "Disemak",
  }[locale];
}

export function policyV6ReviewState(
  slug: string,
  fingerprint: string,
): "agent_reviewed" | undefined {
  const pins = approval.universities as Record<string, { fingerprint: string }>;
  const corrections=approval.scopedCorrections as Record<string,{fingerprint:string}>;
  return pins[slug]?.fingerprint === fingerprint || corrections[slug]?.fingerprint===fingerprint ? "agent_reviewed" : undefined;
}
