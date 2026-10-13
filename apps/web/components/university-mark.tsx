import React from "react";
import marks from "@/lib/university-marks.json";

/** Only independently accepted, locally exported assets enter this registry. */
export function UniversityMark({
  slug,
  size = "small",
}: {
  slug: string;
  size?: "hero" | "small" | "chip";
}) {
  const mark = marks[slug as keyof typeof marks];
  const hero = size === "hero";
  const detailed = hero || Boolean(mark?.[6]);
  const width = mark ? Number(mark[detailed ? 3 : 1]) : 0;
  const height = mark ? Number(mark[detailed ? 4 : 2]) : 0;
  return (
    <span
      className={`university-mark university-mark--${size}${mark ? " university-mark--accepted" : ""}${mark?.[5] ? " university-mark--reversed" : ""}${mark?.[6] ? " university-mark--wide" : ""}`}
      data-university-mark={slug}
      data-mark-status={mark ? "accepted" : "unavailable"}
      aria-hidden="true"
    >
      {mark ? (
        <img
          src={`/assets/university-marks/20261013/${mark[0]}/${detailed ? "hero" : "small"}.webp`}
          alt=""
          width={width}
          height={height}
          loading={hero ? "eager" : "lazy"}
          decoding="async"
          style={{ maxWidth: width, maxHeight: height }}
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
