// Semantic badge tones. Status enums map onto a tone in the component that
// renders them (Record<Status, BadgeTone>, so the compiler flags unmapped new
// enum values); the four .tone-* classes in globals.css carry the colors.
// "neutral" is the unstyled base badge look.
export type BadgeTone = "positive" | "warning" | "danger" | "neutral";

export function badgeToneClass(base: string, tone: BadgeTone): string {
  return tone === "neutral" ? base : `${base} tone-${tone}`;
}
