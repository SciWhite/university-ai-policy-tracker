import React from "react";
import Image from "next/image";
import type { PolicyScenePilot } from "@/lib/policy-scene-pilot";

export function PolicySceneHero({ scene }: { scene: PolicyScenePilot }) {
  return (
    <section
      aria-labelledby="policy-scene-heading"
      className="policy-scene-hero"
      data-policy-scene={scene.slug}
    >
      <div className="policy-scene-hero__copy">
        <p className="policy-scene-hero__eyebrow">{scene.eyebrow}</p>
        <h2 id="policy-scene-heading">{scene.title}</h2>
        <p className="policy-scene-hero__guidance">{scene.guidance}</p>
        {scene.snapshotNotice ? (
          <p className="policy-scene-hero__notice">{scene.snapshotNotice}</p>
        ) : null}
        <a className="policy-scene-hero__link" href={scene.evidenceHref}>
          {scene.evidenceLabel} <span aria-hidden="true">→</span>
        </a>
      </div>
      <div className="policy-scene-hero__artwork">
        <Image
          alt={scene.artworkAlt}
          height={1024}
          preload
          sizes="(max-width: 720px) 100vw, 40vw"
          src={scene.artworkSrc}
          unoptimized
          width={1536}
        />
      </div>
    </section>
  );
}
