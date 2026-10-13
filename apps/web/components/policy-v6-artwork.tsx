import React from "react";
import Image from "next/image";
import type { SupportedLocale } from "@/lib/i18n";
import artwork from "@/lib/policy-v6-art.json";
import artPins from "@/lib/policy-v6-illustration-pins.json";
type Art = {
  src: string;
  alt: string;
  width: number;
  height: number;
  scope?: { en: string; zh: string };
};
/** Illustrates an activity. Native policy text and source scope remain authoritative. */
export function PolicyV6Artwork({
  section,
  schoolSlug,
  basisFingerprint,
  className = "policy-v6-topic-art",
  locale = "en",
}: {
  section: string;
  schoolSlug?: string;
  basisFingerprint?: string;
  className?: string;
  locale?: SupportedLocale;
}) {
  const scoped = artwork.schoolTopics as Record<string, Record<string, Art>>;
  const shared = artwork.assets as Record<string, Art>;
  const pins = artPins as Record<string, { fingerprint: string }>;
  const accepted =
    schoolSlug &&
    basisFingerprint &&
    pins[schoolSlug]?.fingerprint === basisFingerprint;
  const art =
    (accepted ? scoped[schoolSlug]?.[section] : undefined) ?? shared[section];
  if (!art) return null;
  return (
    <figure className={className} data-v6-art-section={section}>
      <Image
        src={art.src}
        alt={art.alt}
        width={art.width}
        height={art.height}
        sizes="(max-width: 600px) 100vw, (max-width: 1000px) 70vw, 420px"
        loading="lazy"
        unoptimized
      />
      {art.scope ? (
        <figcaption lang={locale === "zh" ? "zh" : "en"} data-i18n="preserve">
          {art.scope[locale === "zh" ? "zh" : "en"]}
        </figcaption>
      ) : null}
    </figure>
  );
}
