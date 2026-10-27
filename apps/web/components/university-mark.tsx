"use client";

import React, { useState, useRef, useEffect, type CSSProperties } from "react";
import marks from "@/lib/university-marks.json";
import displayOverrides from "@/lib/university-mark-display-overrides.json";
import { getLocalTitleMark, getLocalCompactMark, getPublishedCompactMark, requiresPublishedCompactGeometry, requiresLocalCompactGeometry, type UniversityMarkSize } from "@/lib/local-university-marks";
import { universityIdentitySlugs } from "@/lib/canonical-university-slug";

/** Accepted assets win; additional compact candidates are development-only. */
const compactMark = (slug: string, size: UniversityMarkSize) => getLocalTitleMark(slug, size) ?? getPublishedCompactMark(slug, size) ?? getLocalCompactMark(slug, size);

export function UniversityMark({
  slug: requestedSlug,
  size = "small",
}: {
  slug: string;
  size?: UniversityMarkSize;
}) {
  // Marks stay bound to the slug they were accepted under; a merged identity
  // reuses an accepted mark filed under a retired alias slug before any
  // development-only candidate.
  const identitySlugs = universityIdentitySlugs(requestedSlug);
  const slug = identitySlugs.find((item) => item in marks)
    ?? identitySlugs.find((item) => compactMark(item, size))
    ?? requestedSlug;
  const legacyMark = marks[slug as keyof typeof marks];
  const mark = size !== "hero" && (requiresPublishedCompactGeometry(slug) || requiresLocalCompactGeometry(slug)) ? undefined : legacyMark;
  const candidate = compactMark(slug, size);
  const local = mark && !(size === "directory" && candidate?.legacyGeometryCorrection) ? undefined : candidate;
  const displayOverride = process.env.NODE_ENV === "development"
    ? displayOverrides[slug as keyof typeof displayOverrides] : undefined;
  const darkBacking = Boolean(mark?.[5] || local?.backing === "dark" || displayOverride?.backing === "dark");
  const [failedSource, setFailedSource] = useState<string>();
  const hero = size === "hero";
  const detailed = hero || Boolean(mark?.[6]);
  const width = mark ? Number(mark[detailed ? 3 : 1]) : 0;
  const height = mark ? Number(mark[detailed ? 4 : 2]) : 0;
  const source = local ? ("source" in local ? String(local.source) : `/api/local/university-marks/${local.file}`) : mark
    ? `/assets/university-marks/20261013/${mark[0]}/${detailed ? "hero" : "small"}.webp`
    : undefined;
  const imageAvailable = source && source !== failedSource;
  const image = useRef<HTMLImageElement>(null);
  useEffect(()=>{const node=image.current;if(source&&node?.complete&&node.naturalWidth===0)setFailedSource(source);},[source]);
  const localStyle = local ? {
    "--local-mark-width": `${local.displayWidth}px`,
    "--local-mark-height": `${local.displayHeight}px`,
    "--local-mark-frame-width": local.frameWidth ? `${local.frameWidth}px` : undefined,
    "--local-mark-frame-height": local.frameHeight ? `${local.frameHeight}px` : undefined,
  } as CSSProperties : undefined;
  return (
    <span
      className={`university-mark university-mark--${size}${mark && !local && imageAvailable ? " university-mark--accepted" : ""}${local && imageAvailable ? " university-mark--local" : ""}${darkBacking && imageAvailable ? " university-mark--reversed" : ""}${mark?.[6] && !local ? " university-mark--wide" : ""}`}
      data-university-mark={requestedSlug}
      data-mark-status={!imageAvailable ? source ? "image-failed" : "unavailable" : local ? ("source" in local ? "published-compact" : "local-candidate") : "accepted"}
      data-mark-publication-approved={local ? "false" : undefined}
      data-mark-minimum-width={local?.minimumWidth}
      style={localStyle}
      aria-hidden="true"
    >
      {imageAvailable ? (
        <img
          ref={image}
          src={source}
          alt=""
          width={local?.width ?? width}
          height={local?.height ?? height}
          loading={hero ? "eager" : "lazy"}
          decoding="async"
          style={local ? undefined : { maxWidth: width, maxHeight: height }}
          onError={() => setFailedSource(source)}
        />
      ) : <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 8 9-5 9 5H3Zm2 3v8m5-8v8m4-8v8m5-8v8M3 21h18" />
      </svg>}
    </span>
  );
}
