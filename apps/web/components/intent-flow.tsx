import { DocumentLink as Link } from "@/components/document-link";
import type { SupportedLocale } from "@/lib/i18n";

type IntentIcon = "search" | "person" | "check" | "source";

interface IntentStep {
  href: string;
  icon: IntentIcon;
  label: string;
}

const copy = {
  en: {
    title: "A clear path from question to source",
    steps: [
      { href: "/search", icon: "search", label: "Find a university" },
      { href: "/universities", icon: "person", label: "Choose your role" },
      { href: "/universities", icon: "check", label: "See the rules" },
      { href: "/sources", icon: "source", label: "Open official source" }
    ]
  },
  zh: {
    title: "从问题到来源，一条清晰路径",
    steps: [
      { href: "/search", icon: "search", label: "查找高校" },
      { href: "/universities", icon: "person", label: "选择你的身份" },
      { href: "/universities", icon: "check", label: "查看规则" },
      { href: "/sources", icon: "source", label: "打开官方来源" }
    ]
  },
  fr: {
    title: "Du besoin à la source, un chemin clair",
    steps: [
      { href: "/search", icon: "search", label: "Trouver une université" },
      { href: "/universities", icon: "person", label: "Choisir votre rôle" },
      { href: "/universities", icon: "check", label: "Voir les règles" },
      { href: "/sources", icon: "source", label: "Ouvrir la source officielle" }
    ]
  },
  pl: {
    title: "Od pytania do źródła, jasna ścieżka",
    steps: [
      { href: "/search", icon: "search", label: "Znajdź uczelnię" },
      { href: "/universities", icon: "person", label: "Wybierz swoją rolę" },
      { href: "/universities", icon: "check", label: "Zobacz zasady" },
      { href: "/sources", icon: "source", label: "Otwórz oficjalne źródło" }
    ]
  },
  es: {
    title: "De la pregunta a la fuente, un camino claro",
    steps: [
      { href: "/search", icon: "search", label: "Encuentra una universidad" },
      { href: "/universities", icon: "person", label: "Elige tu rol" },
      { href: "/universities", icon: "check", label: "Consulta las reglas" },
      { href: "/sources", icon: "source", label: "Abre la fuente oficial" }
    ]
  },
  nl: {
    title: "Van vraag naar bron, een duidelijke route",
    steps: [
      { href: "/search", icon: "search", label: "Vind een universiteit" },
      { href: "/universities", icon: "person", label: "Kies je rol" },
      { href: "/universities", icon: "check", label: "Bekijk de regels" },
      { href: "/sources", icon: "source", label: "Open de officiële bron" }
    ]
  },
  ms: {
    title: "Daripada soalan ke sumber, laluan yang jelas",
    steps: [
      { href: "/search", icon: "search", label: "Cari universiti" },
      { href: "/universities", icon: "person", label: "Pilih peranan anda" },
      { href: "/universities", icon: "check", label: "Lihat peraturan" },
      { href: "/sources", icon: "source", label: "Buka sumber rasmi" }
    ]
  }
} satisfies Record<SupportedLocale, { title: string; steps: IntentStep[] }>;

interface IntentFlowProps {
  locale: SupportedLocale;
}

export function IntentFlow({ locale }: IntentFlowProps) {
  const strings = copy[locale];
  const titleId = `intent-flow-title-${locale}`;

  return (
    <section aria-labelledby={titleId} className="intent-flow">
      <div className="intent-flow__heading">
        <h2 id={titleId}>{strings.title}</h2>
      </div>
      <figure aria-hidden="true" className="intent-flow__texture">
        <img
          alt=""
          decoding="async"
          height="720"
          loading="lazy"
          src="/assets/intent-path-texture.png"
          width="720"
        />
      </figure>
      <ol className="intent-flow__steps">
        {strings.steps.map((step, index) => (
          <li className="intent-flow__item" key={step.label}>
            <Link
              aria-label={step.label}
              className="intent-flow__step"
              href={step.href}
            >
              <span aria-hidden="true" className="intent-flow__icon">
                <IntentIcon kind={step.icon} />
              </span>
              <span>{step.label}</span>
            </Link>
            {index < strings.steps.length - 1 ? (
              <span aria-hidden="true" className="intent-flow__connector">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function IntentIcon({ kind }: { kind: IntentIcon }) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8
  };

  if (kind === "search") {
    return (
      <svg aria-hidden="true" height="24" viewBox="0 0 24 24" width="24">
        <circle {...commonProps} cx="10.5" cy="10.5" r="5.5" />
        <path {...commonProps} d="m15 15 4.5 4.5" />
      </svg>
    );
  }

  if (kind === "person") {
    return (
      <svg aria-hidden="true" height="24" viewBox="0 0 24 24" width="24">
        <circle {...commonProps} cx="12" cy="8" r="3.2" />
        <path {...commonProps} d="M5.5 19.5c.8-3.1 3.1-4.8 6.5-4.8s5.7 1.7 6.5 4.8" />
      </svg>
    );
  }

  if (kind === "check") {
    return (
      <svg aria-hidden="true" height="24" viewBox="0 0 24 24" width="24">
        <path {...commonProps} d="m5 12.5 4.2 4.2L19 7" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" height="24" viewBox="0 0 24 24" width="24">
      <path {...commonProps} d="M6.5 3.5h8l3 3v14h-11z" />
      <path {...commonProps} d="M14.5 3.5v3h3M9 11h6M9 14.5h6M9 18h4" />
    </svg>
  );
}
