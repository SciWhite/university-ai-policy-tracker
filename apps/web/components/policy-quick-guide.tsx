import type { SupportedLocale } from "@/lib/i18n";
import { translatePolicyReferenceUi as translate } from "@/lib/policy-reference-ui";
import Image from "next/image";
import { PolicySceneCard } from "@/components/policy-scene-story";
import type {
  PolicyScenePilot,
  PolicySceneQuickGuidePanel
} from "@/lib/policy-scene-pilot";

export function PolicyQuickGuide({
  scene,
  headingId = "policy-quick-guide-heading"
}: {
  scene: PolicyScenePilot;
  headingId?: string;
}) {
  const guide = scene.quickGuide;
  if (!guide) return null;

  return (
    <div className={`policy-quick-guide${guide.do.artworkLandscape ? " policy-quick-guide--mechanism" : ""}`} id="quick-guide">
      <div className="policy-quick-guide__heading">
        <div>
          <p className="student-policy__eyebrow">Policy at a glance</p>
          <h2 id={headingId}>Do this. Avoid that.</h2>
          <p className="policy-quick-guide__scope">{guide.scopeNote}</p>
          {scene.scopeDetail ? <details className="policy-scope-detail"><summary>Scope and transition details</summary><p>{scene.scopeDetail}</p></details> : null}
          {scene.sourceUpdate ? <p className="policy-quick-guide__scope"><a href="#current-source-supplement">Current source differs from the retained reviewed record ↓</a></p> : null}
        </div>
        <nav aria-label="Policy evidence shortcuts" className="policy-quick-guide__links">
          <a href="#claims">Reviewed claims</a>
          <a href="#sources">Official sources</a>
        </nav>
      </div>
      <div className="policy-quick-guide__grid">
        <QuickGuidePanel kind="do" panel={guide.do} />
        <QuickGuidePanel kind="dont" panel={guide.dont} />
      </div>
    </div>
  );
}

function QuickGuidePanel({
  kind,
  panel
}: {
  kind: "do" | "dont";
  panel: PolicySceneQuickGuidePanel;
}) {
  const label = kind === "do" ? "Do" : "Don't";
  return (
    <article className={`policy-quick-panel policy-quick-panel--${kind}`}>
      <Image
        alt={panel.artworkAlt}
        className={`policy-quick-panel__art${panel.artworkLandscape ? " policy-quick-panel__art--landscape" : ""}`}
        height={panel.artworkLandscape ? 853 : 1024}
        loading="lazy"
        sizes="(max-width: 720px) 100vw, 45vw"
        src={panel.artworkSrc}
        unoptimized
        width={panel.artworkLandscape ? 1280 : 1024}
      />
      <div className="policy-quick-panel__content">
        <h3>{label}</h3>
        <ul>
          {panel.checks.map((check) => (
            <li key={`${check.evidenceHref}:${check.text}`}>
              <a href={check.evidenceHref} rel={check.evidenceHref.startsWith("https://") ? "noopener noreferrer" : undefined} target={check.evidenceHref.startsWith("https://") ? "_blank" : undefined}>
                {check.text} <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function PolicySceneGallery({ scene, locale = "en" }: { scene: PolicyScenePilot; locale?: SupportedLocale }) {
  const cards = scene.storyCards?.filter((card) => card.audience !== "research") ?? [];
  const researchCards = scene.storyCards?.filter((card) => card.audience === "research") ?? [];
  if (!cards.length && !researchCards.length) return null;

  return (
    <section aria-labelledby="policy-scene-gallery-heading" className="policy-scene-gallery">
      <div className="policy-scene-gallery__heading">
        <p className="student-policy__eyebrow">{translate("Common situations", locale)}</p>
        <h2 id="policy-scene-gallery-heading">{translate("Find your next step", locale)}</h2>
      </div>
      <div className="policy-scene-gallery__grid">
        {cards.map((card) => (
          <PolicySceneCard
            card={card}
            compact={!scene.showGallerySummaries}
            readableArtwork={Boolean(scene.showGallerySummaries)}
            evidenceLabel="View evidence"
            locale={locale}
            key={card.artworkSrc}
          />
        ))}
      </div>
      {researchCards.length ? (
        <details className="policy-scene-research">
          <summary>{translate("Research guidance", locale)} ({researchCards.length})</summary>
          {researchCards.map((card) => (
            <PolicySceneCard
              card={card}
              compact={!scene.showGallerySummaries}
              readableArtwork={Boolean(scene.showGallerySummaries)}
              evidenceLabel="View evidence"
            locale={locale}
              key={card.artworkSrc}
            />
          ))}
        </details>
      ) : null}
    </section>
  );
}
