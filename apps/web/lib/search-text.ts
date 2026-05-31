const FOLD_CHARACTERS: Record<string, string> = {
  "ł": "l",
  "Ł": "L",
  "đ": "d",
  "Đ": "D",
  "ı": "i",
  "ø": "o",
  "Ø": "O",
  "þ": "th",
  "Þ": "Th"
};

export function normalizeForSearch(value: string): string {
  return value
    .replace(/[łŁđĐıøØþÞ]/g, (character) => FOLD_CHARACTERS[character] ?? character)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      normalizeForSearch(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length > 1)
    )
  );
}

export function textMatchesNormalized(
  value: string,
  normalizedQuery: string
): boolean {
  if (normalizedQuery.length <= 3) {
    return tokenize(value).includes(normalizedQuery);
  }

  return normalizeForSearch(value).includes(normalizedQuery);
}
