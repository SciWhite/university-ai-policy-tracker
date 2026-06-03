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

const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

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
  const tokens = new Set<string>();

  for (const token of normalizeForSearch(value).split(" ")) {
    const trimmed = token.trim();
    if (trimmed.length <= 1) continue;

    tokens.add(trimmed);
    if (containsCjk(trimmed)) {
      for (const ngram of buildCjkNgrams(trimmed)) {
        tokens.add(ngram);
      }
    }
  }

  return Array.from(tokens);
}

export function textMatchesNormalized(
  value: string,
  normalizedQuery: string
): boolean {
  if (containsCjk(normalizedQuery) && normalizedQuery.length >= 2) {
    return normalizeForSearch(value).includes(normalizedQuery);
  }

  if (normalizedQuery.length <= 3) {
    return tokenize(value).includes(normalizedQuery);
  }

  return normalizeForSearch(value).includes(normalizedQuery);
}

export function containsCjk(value: string): boolean {
  return CJK_PATTERN.test(value);
}

function buildCjkNgrams(value: string): string[] {
  const chars = Array.from(value).filter((character) => containsCjk(character));
  const ngrams = new Set<string>();

  for (const size of [2, 3]) {
    for (let index = 0; index <= chars.length - size; index += 1) {
      ngrams.add(chars.slice(index, index + size).join(""));
    }
  }

  return Array.from(ngrams);
}
