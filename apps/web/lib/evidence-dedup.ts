import { cache } from "react";

/**
 * One full copy of each official quotation and claim text per page (docs/render-once.md §11,
 * 2026-11-22). The claim cards (#claims, ClaimEvidenceCard) are the canonical copy: always in
 * the server HTML, so crawlers and readers without JavaScript keep every quotation and claim.
 * Topic evidence popovers render an excerpt of a text that a claim card already holds and fill
 * in the full text from that card when opened (components/policy-v6-popover.tsx). The page registers
 * the canonical quotations before its components render; without a registration nothing is
 * shortened.
 */
const EXCERPT_CHARS = 120;
const store = cache(() => ({ quotes: new Set<string>() }));

export function normalizeQuote(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** FNV-1a (32-bit) of the normalized text: a short, stable DOM key, not a security boundary. */
export function quoteKey(text: string): string {
  let hash = 0x811c9dc5;
  for (const char of normalizeQuote(text)) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function registerCanonicalQuotes(texts: Iterable<string | undefined | null>): void {
  const quotes = store().quotes;
  for (const text of texts) if (text && normalizeQuote(text)) quotes.add(quoteKey(text));
}

/** The excerpt to render instead of a quotation held by a claim card, or undefined to render it in full. */
export function deferredQuoteExcerpt(text: string): string | undefined {
  const normalized = normalizeQuote(text);
  if (normalized.length <= EXCERPT_CHARS + 40 || !store().quotes.has(quoteKey(text))) return undefined;
  const cut = normalized.lastIndexOf(" ", EXCERPT_CHARS);
  return normalized.slice(0, cut > EXCERPT_CHARS / 2 ? cut : EXCERPT_CHARS) + "…";
}

/** Register what a claim-card section renders (call before the page's components render). */
export function registerClaimCardTexts(claims: ReadonlyArray<{ claimText: string; evidence: ReadonlyArray<{ evidenceSnippet: string }> }>): void {
  registerCanonicalQuotes(claims.flatMap(claim => [claim.claimText, ...claim.evidence.map(evidence => evidence.evidenceSnippet)]));
}
