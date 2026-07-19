import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";

const stateLabels: Record<SupportedLocale, Record<string, string>> = {
  en: { machine_candidate: "Machine candidate", agent_reviewed: "Agent reviewed", human_reviewed: "Human reviewed", institution_verified: "Institution verified", needs_review: "Needs review", rejected: "Rejected" },
  zh: { machine_candidate: "机器候选", agent_reviewed: "智能体已审核", human_reviewed: "人工已审核", institution_verified: "机构已核验", needs_review: "需要审核", rejected: "已拒绝" },
  fr: { machine_candidate: "Candidat machine", agent_reviewed: "Révisé par un agent", human_reviewed: "Révisé par une personne", institution_verified: "Vérifié par l’établissement", needs_review: "À réviser", rejected: "Rejeté" },
  pl: { machine_candidate: "Kandydat maszynowy", agent_reviewed: "Sprawdzone przez agenta", human_reviewed: "Sprawdzone przez człowieka", institution_verified: "Zweryfikowane przez uczelnię", needs_review: "Wymaga przeglądu", rejected: "Odrzucone" },
  es: { machine_candidate: "Candidato automático", agent_reviewed: "Revisado por un agente", human_reviewed: "Revisado por una persona", institution_verified: "Verificado por la institución", needs_review: "Requiere revisión", rejected: "Rechazado" },
  nl: { machine_candidate: "Machinekandidaat", agent_reviewed: "Door agent beoordeeld", human_reviewed: "Door mens beoordeeld", institution_verified: "Door instelling geverifieerd", needs_review: "Beoordeling nodig", rejected: "Afgewezen" },
  ms: { machine_candidate: "Calon mesin", agent_reviewed: "Disemak oleh ejen", human_reviewed: "Disemak oleh manusia", institution_verified: "Disahkan oleh institusi", needs_review: "Perlu semakan", rejected: "Ditolak" }
};

const reviewPrefixes: Record<SupportedLocale, string> = {
  en: "Review",
  zh: "审核",
  fr: "Révision",
  pl: "Przegląd",
  es: "Revisión",
  nl: "Beoordeling",
  ms: "Semakan"
};

interface StateLabelProps {
  reviewState: string;
  prefix?: string;
  locale?: SupportedLocale;
}

export function StateLabel({ locale = DEFAULT_LOCALE, reviewState, prefix = "Review" }: StateLabelProps) {
  const label = stateLabels[locale][reviewState] ?? formatUnknownState(reviewState);
  const knownState = Object.prototype.hasOwnProperty.call(stateLabels.en, reviewState);
  const localizedPrefix = prefix === "Review" ? reviewPrefixes[locale] : prefix;

  return (
    <span
      className="state-label"
      data-review-state={knownState ? reviewState : "unknown"}
    >
      {prefix ? `${localizedPrefix}: ` : null}
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
