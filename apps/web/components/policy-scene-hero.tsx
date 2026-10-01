import React from "react";
import Image from "next/image";
import type { PolicyScenePilot } from "@/lib/policy-scene-pilot";

export function PolicySceneHero({ scene }: { scene: PolicyScenePilot }) {
  const scenarioChecks = scene.scenarioChecks;

  return (
    <section
      aria-labelledby="policy-scene-heading"
      className={`policy-scene-hero${scene.studentFirst ? " policy-scene-hero--student-first" : ""}${scene.quickGuide ? " policy-scene-hero--compact" : ""}${scene.artworkMobileSrc ? " policy-scene-hero--responsive-art" : ""}${scene.artworkLandscape ? " policy-scene-hero--landscape-art" : ""}${scene.storyLayout === "mechanisms" ? " policy-scene-hero--mechanism" : ""}`}
      data-policy-scene={scene.slug}
    >
      <div className="policy-scene-hero__copy">
        <p className="policy-scene-hero__eyebrow">{scene.eyebrow}</p>
        <h2 id="policy-scene-heading">{scene.title}</h2>
        {scene.guidance ? <p className="policy-scene-hero__guidance">{scene.guidance}</p> : null}
        {scene.snapshotNotice ? (
          <p className="policy-scene-hero__notice">{scene.snapshotNotice}</p>
        ) : null}
        <a className="policy-scene-hero__link" href={scene.evidenceHref} rel={scene.evidenceHref.startsWith("https://") ? "noopener noreferrer" : undefined} target={scene.evidenceHref.startsWith("https://") ? "_blank" : undefined}>
          {scene.evidenceLabel} <span aria-hidden="true">→</span>
        </a>
        {scene.studentFirst ? <nav aria-label="Student next steps" className="policy-scene-hero__actions">
          <a href="#snapshot-coursework">Coursework</a><a href="#snapshot-exams">Exams</a><a href="#snapshot-privacy_data">Data safety</a>
        </nav> : null}
      </div>
      <figure
        className={`policy-scene-hero__artwork${
          scenarioChecks && scenarioChecks.length > 0
            ? " policy-scene-hero__artwork--with-scenarios"
            : ""
        }${scene.artworkContainsText ? " policy-scene-hero__artwork--direct-text" : ""}${scene.artworkMobileSrc ? " policy-scene-hero__artwork--square-mobile" : ""}${scene.artworkSquare ? " policy-scene-hero__artwork--square" : ""}`}
      >
        <div className="policy-scene-hero__image-wrap">
          {scene.artworkMobileSrc ? (
            <picture>
              <source media="(max-width: 720px)" srcSet={scene.artworkMobileSrc} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={scene.artworkAlt}
                height={1024}
                loading="eager"
                src={scene.artworkSrc}
                width={1536}
              />
            </picture>
          ) : (
            <Image
              alt={scene.artworkAlt}
              height={scene.artworkLandscape ? 853 : 1024}
              preload
              sizes="(max-width: 720px) 100vw, 40vw"
              src={scene.artworkSrc}
              unoptimized
              width={scene.artworkSquare ? 1024 : scene.artworkLandscape ? 1280 : 1536}
            />
          )}
        </div>
        {scenarioChecks && scenarioChecks.length > 0 ? (
          <figcaption
            aria-label="Action-specific scenario checks"
            className="policy-scene-hero__scenarios"
          >
            {scenarioChecks.map((check, index) => {
              const isProhibited = check.status === "Do not";
              return (
                <div
                  className={`policy-scene-check policy-scene-check--${
                    isProhibited ? "prohibited" : "conditional"
                  }`}
                  data-scenario-scope={check.scope}
                  data-scenario-status={check.status}
                  key={`${check.scope}-${check.label}-${index}`}
                >
                  <div className="policy-scene-check__header">
                    <span className="policy-scene-check__scope">
                      {check.scope}
                    </span>
                    <span
                      className={`policy-scene-check__badge policy-scene-check__badge--${
                        isProhibited ? "prohibited" : "conditional"
                      }`}
                    >
                      {check.status}
                    </span>
                  </div>
                  <strong className="policy-scene-check__label">
                    {check.label}
                  </strong>
                  {check.detail ? (
                    <p className="policy-scene-check__detail">{check.detail}</p>
                  ) : null}
                </div>
              );
            })}
          </figcaption>
        ) : null}
      </figure>
    </section>
  );
}
