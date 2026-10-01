import { translatePolicyReferenceUi } from "@/lib/policy-reference-ui";
import type { SupportedLocale } from "@/lib/i18n";
import Image from "next/image";
import type { PolicyScenePilot, PolicySceneStoryCard } from "@/lib/policy-scene-pilot";

export function policySceneCardId(card: PolicySceneStoryCard): string {
  return `policy-scene-${card.artworkSrc.split("/").at(-1)?.replace(/\.[^.]+$/, "")}`;
}

export function PolicySceneCard({
  card,
  evidenceLabel,
  compact = false,
  readableArtwork = false,
  locale = "en"
}: {
  card: PolicySceneStoryCard;
  locale?: SupportedLocale;
  evidenceLabel: string;
  compact?: boolean;
  readableArtwork?: boolean;
}) {
  return (
    <figure className={`policy-scene-card${compact ? " policy-scene-card--compact" : " policy-scene-card--with-summary"}${readableArtwork ? " policy-scene-card--readable-art" : ""}`} id={policySceneCardId(card)}>
      <Image
        alt={card.artworkAlt}
        className={`policy-scene-card__image${card.artworkLandscape ? " policy-scene-card__image--landscape" : ""}`}
        height={card.artworkLandscape ? 853 : 1024}
        loading="lazy"
        sizes="(max-width: 720px) 100vw, 240px"
        src={card.artworkSrc}
        unoptimized
        width={card.artworkLandscape ? 1280 : 1024}
      />
      <figcaption className="policy-scene-card__caption">
        <strong>{card.title}</strong>
        {compact ? null : <span>{card.summary}</span>}
        <a href={card.evidenceHref} rel={card.evidenceHref.startsWith("https://") ? "noopener noreferrer" : undefined} target={card.evidenceHref.startsWith("https://") ? "_blank" : undefined}>
          {translatePolicyReferenceUi(evidenceLabel, locale)} <span aria-hidden="true">→</span>
        </a>
      </figcaption>
    </figure>
  );
}

/** A short table of contents; the artwork itself sits beside its policy basis. */
export function PolicySceneStory({ scene }: { scene: PolicyScenePilot }) {
  const studentCards = scene.storyCards?.filter((card) => card.audience !== "research") ?? [];
  if (!studentCards.length) return null;

  return (
    <nav aria-label="Illustrated policy guide" className="policy-scene-guide" data-policy-scene-story={scene.slug}>
      <span>Explore the illustrated checks</span>
      <div>
        {studentCards.map((card) => (
          <a href={`#${policySceneCardId(card)}`} key={card.artworkSrc}>
            {card.title} <span aria-hidden="true">↘</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
