"use client";
import { useEffect } from "react";
import { readingDirection, type ReadingLocale } from "@/lib/language-catalog";
import { adoptUiLocaleFragment, readUiLocale } from "@/lib/ui-locale-preference";

/**
 * UI-language preference on English content pages (lib/content-locales.ts, 2026-11-22). The
 * server renders one English page; this swaps the interface text (navigation, labels,
 * headings, buttons) for the reader's UI locale from a content-hashed dictionary
 * (/ui-text/manifest.json -> /ui-text/<locale>.<hash>.json). Content stays as authored: only
 * exact matches of English UI strings change, never text whose own element (or its parent) is
 * [data-i18n="preserve"], anything under [translate="no"], an element with another `lang`, or
 * code/pre/script/style. A replaced element whose only child is the text gets
 * `lang`/`dir`; the English original is kept so the switch back is exact.
 */
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "TEMPLATE", "SVG"]);
const ATTRIBUTES = ["aria-label", "title", "placeholder", "alt"] as const;
const dictionaries = new Map<string, Promise<Record<string, string> | undefined>>();

export function loadUiDictionary(locale: ReadingLocale, fetcher: typeof fetch = fetch): Promise<Record<string, string> | undefined> {
  const cached = dictionaries.get(locale);
  if (cached) return cached;
  const load = (async () => {
    for (const cache of ["default", "no-cache"] as const) {
      const manifest = await fetcher("/ui-text/manifest.json", { cache }).then(r => r.ok ? r.json() : undefined).catch(() => undefined) as { files?: Record<string, string> } | undefined;
      const file = manifest?.files?.[locale];
      if (!file) return undefined;
      const response = await fetcher(`/ui-text/${file}`).catch(() => undefined);
      if (response?.ok) return ((await response.json()) as { text?: Record<string, string> }).text;
      // A stale manifest named a replaced file: ask once more past the caches.
    }
    return undefined;
  })();
  dictionaries.set(locale, load);
  load.then(value => { if (!value) dictionaries.delete(locale); }, () => dictionaries.delete(locale));
  return load;
}

// English original and the value written, so a later React update (new English text) is seen.
const originalText = new WeakMap<Text, { raw: string; applied: string }>();
const originalAttributes = new WeakMap<Element, Map<string, { raw: string; applied: string }>>();
const touchedText = new Set<Text>();
const touchedElements = new Set<Element>();
const marked = new Set<Element>();
let originalTitle: string | undefined;

function skipped(element: Element | null): boolean {
  let depth = 0;
  for (let node = element; node && node !== document.body; node = node.parentElement, depth++) {
    if (SKIP.has(node.tagName.toUpperCase())) return true;
    if (node.getAttribute("translate") === "no" || node.hasAttribute("data-ui-locale-skip")) return true;
    // Authored text is marked on its own element (<p data-i18n="preserve">, maybe with one
    // inline wrapper). Large containers also carry the marker against server re-translation of
    // copy that is already localized (the home page), so a distant marker does not count.
    if (depth <= 1 && node.getAttribute("data-i18n") === "preserve") return true;
    const lang = node.getAttribute("lang");
    if (lang && !lang.toLowerCase().startsWith("en") && !marked.has(node)) return true;
  }
  return false;
}

/** Replace exact matches (whitespace kept) in `root`. Returns how many strings changed. */
export function applyUiText(root: ParentNode, text: Record<string, string>, locale: ReadingLocale): number {
  let changed = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const current = node.nodeValue ?? "", saved = originalText.get(node);
    const raw = saved && saved.applied === current ? saved.raw : current;
    const key = raw.trim();
    const target = key && text[key];
    if (!target || skipped(node.parentElement)) continue;
    const next = raw.replace(key, target);
    if (current !== next) { originalText.set(node, { raw, applied: next }); node.nodeValue = next; touchedText.add(node); changed++; }
    const parent = node.parentElement;
    if (parent && parent.childNodes.length === 1 && !parent.hasAttribute("lang") && !parent.hasAttribute("dir")) {
      parent.setAttribute("lang", locale); parent.setAttribute("dir", readingDirection(locale)); marked.add(parent);
    }
  }
  const elements = root instanceof Element ? [root, ...root.querySelectorAll("[aria-label],[title],[placeholder],[alt]")] : [...root.querySelectorAll("[aria-label],[title],[placeholder],[alt]")];
  for (const element of elements) {
    if (skipped(element)) continue;
    for (const name of ATTRIBUTES) {
      const current = element.getAttribute(name), saved = originalAttributes.get(element)?.get(name);
      if (current === null) continue;
      const value = saved && saved.applied === current ? saved.raw : current;
      const target = text[value.trim()];
      if (!target || current === target) continue;
      const map = originalAttributes.get(element) ?? new Map<string, { raw: string; applied: string }>();
      map.set(name, { raw: value, applied: target });
      originalAttributes.set(element, map); touchedElements.add(element);
      element.setAttribute(name, target); changed++;
    }
  }
  return changed;
}

export function restoreUiText() {
  for (const node of touchedText) { const saved = originalText.get(node); if (saved && node.nodeValue === saved.applied) node.nodeValue = saved.raw; originalText.delete(node); }
  for (const element of touchedElements) { for (const [name, saved] of originalAttributes.get(element) ?? []) if (element.getAttribute(name) === saved.applied) element.setAttribute(name, saved.raw); originalAttributes.delete(element); }
  for (const element of marked) { element.removeAttribute("lang"); element.removeAttribute("dir"); }
  touchedText.clear(); touchedElements.clear(); marked.clear();
  if (originalTitle !== undefined) { document.title = originalTitle; originalTitle = undefined; }
  delete document.documentElement.dataset.uiLocale;
}

export function UiLocaleOverlay() {
  useEffect(() => {
    let active: ReadingLocale | undefined, dictionary: Record<string, string> | undefined, observer: MutationObserver | undefined, frame = 0;
    let cancelled = false;
    const stop = () => { observer?.disconnect(); observer = undefined; cancelAnimationFrame(frame); };
    const update = async () => {
      adoptUiLocaleFragment();
      // Only English content pages take a UI preference; /zh/ and native pages are already localized.
      const wanted = document.documentElement.lang.toLowerCase().startsWith("en") ? readUiLocale() : undefined;
      if (wanted === active) return;
      stop(); restoreUiText(); active = wanted; dictionary = undefined;
      if (!wanted) return;
      const text = await loadUiDictionary(wanted);
      if (cancelled || active !== wanted) return;
      // A failed load is retried on the next change or navigation, not remembered as applied.
      if (!text) { active = undefined; return; }
      dictionary = text;
      document.documentElement.dataset.uiLocale = wanted;
      applyUiText(document.body, text, wanted);
      if (document.title && text[document.title.trim()]) { originalTitle = document.title; document.title = text[document.title.trim()]; }
      // React re-renders put English text back; apply again once per frame.
      observer = new MutationObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => { if (dictionary && active) applyUiText(document.body, dictionary, active); });
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    // Listeners fire while update() runs (adopting a fragment writes the preference): one at a time.
    let running = false, again = false;
    const run = () => {
      if (running) { again = true; return; }
      running = true;
      void update().finally(() => { running = false; if (again) { again = false; run(); } });
    };
    // After hydration: changing server text before React attaches would be a mismatch.
    // requestIdleCallback alone can wait indefinitely on a busy or background tab: cap it.
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(run, { timeout: 1500 }) : window.setTimeout(run, 200);
    window.addEventListener("hashchange", run);
    window.addEventListener("uapt-ui-locale-change", run);
    window.addEventListener("storage", run);
    return () => {
      cancelled = true; stop();
      if (!idle) window.clearTimeout(handle as number);
      window.removeEventListener("hashchange", run);
      window.removeEventListener("uapt-ui-locale-change", run);
      window.removeEventListener("storage", run);
    };
  }, []);
  return null;
}
