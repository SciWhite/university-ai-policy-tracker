import registry from "./university-marks-local.json";
import published from "./university-marks-published.json";

export type UniversityMarkSize = "hero" | "small" | "chip" | "directory";

interface LocalCompactMark {
  file: string;
  width: number;
  height: number;
  minimumWidth: number;
  maximumWidth: number | null;
  minimumDisplaySlot?: number[] | null;
  actual32Accepted: boolean;
  backing: string;
  role: string;
  limitations: string[];
  publicationApproved: boolean;
  publicUseReviewRequired: boolean;
  legacyGeometryCorrection?: boolean;
}

/** Explicit local preview; this registry never supplies a production mark. */
export function getLocalCompactMark(slug: string, size: UniversityMarkSize) {
  if (process.env.NODE_ENV !== "development" || size === "hero") return undefined;
  return selectCompactMark(registry.entries, slug, size);
}

/** Explicitly exported compact assets; source approval flags and use limits stay intact. */
export function getPublishedCompactMark(slug: string, size: UniversityMarkSize) {
  if (size === "hero") return undefined;
  const mark = selectCompactMark(published.entries, slug, size);
  return mark ? {...mark, source: `${published.assetPrefix}/${mark.file}`} : undefined;
}

function selectCompactMark(entries: Record<string, LocalCompactMark>, slug: string, size: UniversityMarkSize) {
  const mark = entries[slug];
  const slot = size === "directory" ? Math.max(64, mark?.minimumWidth ?? 0) : size === "chip" ? 24 : 32;
  if (!mark || mark.role !== "compact" || slot < mark.minimumWidth) return undefined;
  if (mark.minimumDisplaySlot && (slot < mark.minimumDisplaySlot[0] || slot < mark.minimumDisplaySlot[1])) return undefined;
  if (slot <= 32 && !mark.actual32Accepted) return undefined;
  const dedicatedSlot = mark.minimumDisplaySlot?.[0] === 44 && mark.minimumDisplaySlot?.[1] === 56;
  const scale = Math.min(1, dedicatedSlot ? Math.min(44 / mark.width, 56 / mark.height) : slot / Math.max(mark.width, mark.height),
    mark.maximumWidth ? mark.maximumWidth / mark.width : 1);
  const displayWidth = mark.width * scale;
  const displayHeight = mark.height * scale;
  // Larger minimum widths refer to visible content, not just the carrier box.
  if (mark.minimumWidth > 32 && displayWidth < mark.minimumWidth - 0.01) return undefined;
  return { ...mark, displayWidth, displayHeight,
    frameWidth: size === "directory" ? Math.max(64, displayWidth + 8) : undefined,
    frameHeight: size === "directory" ? Math.max(64, displayHeight + 8) : undefined,
  };
}

export function isLocalMarkFile(filename: string) {
  return process.env.NODE_ENV === "development" && /^[a-f0-9]{64}\.webp$/.test(filename)
    && Object.values(registry.entries).some(mark => mark.file === filename);
}

/** Prevent an old undersized image from bypassing the current role minimum. */
export function requiresLocalCompactGeometry(slug: string) {
  const entries: Record<string, LocalCompactMark> = registry.entries;
  return process.env.NODE_ENV === "development" && Boolean(entries[slug]?.legacyGeometryCorrection);
}

export function requiresPublishedCompactGeometry(slug: string) {
  return Boolean((published.entries as Record<string, LocalCompactMark>)[slug]?.legacyGeometryCorrection);
}
