"use client";
import { useLayoutEffect, useRef } from "react";
import { safeDiscoveryReturn } from "./discovery-query";
interface Position {
  y: number;
  anchor?: string;
  offset?: number;
  savedAt: number;
}
const prefix = "uapt-discovery-position-v2:",
  intentKey = "uapt-discovery-return-intent-v2",
  returnKey = "uapt-discovery-return-v1";
/** How long a remembered directory/ranking view stays the "back" target of a school page. */
const RETURN_TTL_MS = 6 * 60 * 60 * 1000;
interface ReturnEntry {
  url: string;
  target: string;
  at: number;
}

/**
 * School links in the directory and ranking views carry no `?returnTo=`
 * (2026-11-21 audit, phase 2.1): every variant was a separate origin and edge
 * cache key for the same page. The view the reader came from is kept in this
 * tab's sessionStorage instead, keyed by the school page path it opened.
 */
export function rememberDiscoveryReturn(returnTo: string, target: string) {
  const url = safeDiscoveryReturn(returnTo);
  if (!url) return;
  let path: string;
  try {
    path = new URL(target, location.href).pathname;
  } catch {
    return;
  }
  try {
    sessionStorage.setItem(
      returnKey,
      JSON.stringify({ url, target: path, at: Date.now() } satisfies ReturnEntry),
    );
  } catch {}
}

/** Props for a school link inside a directory or ranking view (no query string). */
export function discoveryReturnLinkProps(returnTo: string | undefined) {
  if (!returnTo) return {};
  return {
    "data-discovery-return": "",
    onClick: (event: { currentTarget: HTMLAnchorElement }) =>
      rememberDiscoveryReturn(returnTo, event.currentTarget.href),
  };
}

/** Pure part of {@link takeDiscoveryReturn}; exported for tests. */
export function selectDiscoveryReturn(
  pathname: string,
  search: string,
  stored: string | null,
  now: number,
): { href: string | null; legacy: string | null; cleanSearch: string } {
  const params = new URLSearchParams(search);
  const legacyRaw = params.get("returnTo");
  params.delete("returnTo");
  const rest = params.toString();
  const cleanSearch = rest ? "?" + rest : "";
  const legacy = safeDiscoveryReturn(legacyRaw);
  if (legacyRaw !== null) return { href: legacy, legacy, cleanSearch };
  let entry: ReturnEntry | null = null;
  try {
    entry = JSON.parse(stored ?? "null");
  } catch {}
  const href =
    entry &&
    entry.target === pathname &&
    Number.isFinite(entry.at) &&
    now - entry.at >= 0 &&
    now - entry.at <= RETURN_TTL_MS
      ? safeDiscoveryReturn(entry.url)
      : null;
  return { href, legacy: null, cleanSearch };
}

/**
 * The "back to the directory" target for the current school page. Old
 * `?returnTo=` links (bookmarks, other sites, cached pages) still work: the
 * value is adopted into sessionStorage and removed from the address bar.
 */
export function takeDiscoveryReturn(): string | null {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(returnKey);
  } catch {}
  const { href, legacy, cleanSearch } = selectDiscoveryReturn(
    location.pathname,
    location.search,
    stored,
    Date.now(),
  );
  if (cleanSearch !== location.search) {
    if (legacy) rememberDiscoveryReturn(legacy, location.pathname);
    window.history.replaceState(
      window.history.state,
      "",
      location.pathname + cleanSearch + location.hash,
    );
  }
  return href;
}
export function saveDiscoveryPosition(url: string, element?: Element | null) {
  const safe = safeDiscoveryReturn(url);
  if (!safe) return;
  const result = element?.closest("[data-result-id]");
  const value: Position = {
    y: window.scrollY,
    savedAt: Date.now(),
    ...(result
      ? { anchor: result.id, offset: result.getBoundingClientRect().top }
      : {}),
  };
  try {
    sessionStorage.setItem(prefix + safe, JSON.stringify(value));
  } catch {}
}
export function requestDiscoveryPosition(url: string) {
  const safe = safeDiscoveryReturn(url);
  if (!safe) return;
  try {
    sessionStorage.setItem(
      intentKey,
      JSON.stringify({ url: safe, at: Date.now() }),
    );
  } catch {}
}
export function useDiscoveryPosition(url: string) {
  const initialUrl = useRef(url);
  useLayoutEffect(() => {
    let saved: Position;
    try {
      const intent = JSON.parse(sessionStorage.getItem(intentKey) ?? "null");
      const back =
        (
          performance.getEntriesByType("navigation")[0] as
            | PerformanceNavigationTiming
            | undefined
        )?.type === "back_forward" && url === initialUrl.current;
      if (
        !back &&
        (!intent || intent.url !== url || Date.now() - intent.at > 60000)
      )
        return;
      const raw = sessionStorage.getItem(prefix + url);
      if (!raw) return;
      saved = JSON.parse(raw);
    } catch {
      return;
    }
    if (
      !Number.isFinite(saved.y) ||
      Date.now() - saved.savedAt > 30 * 60 * 1000
    )
      return;
    let cancelled = false,
      frame = 0;
    const deadline = performance.now() + 750;
    const consume = () => {
      try {
        const intent = JSON.parse(sessionStorage.getItem(intentKey) ?? "null");
        if (intent?.url === url) sessionStorage.removeItem(intentKey);
      } catch {}
    };
    const cancel = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      consume();
    };
    const onKey = (event: KeyboardEvent) => {
      if (
        [
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        cancel();
    };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", onKey);
    const restore = () => {
      if (cancelled) return;
      const anchor = saved.anchor
        ? document.getElementById(saved.anchor)
        : null;
      const wanted =
        anchor && Number.isFinite(saved.offset)
          ? window.scrollY + anchor.getBoundingClientRect().top - saved.offset!
          : saved.y;
      const top = Math.max(
        0,
        Math.min(wanted, document.documentElement.scrollHeight - innerHeight),
      );
      if (Math.abs(window.scrollY - top) > 1)
        window.scrollTo({ top, behavior: "instant" });
      if (performance.now() < deadline) frame = requestAnimationFrame(restore);
      else consume();
    };
    restore();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", onKey);
    };
  }, [url]);
}
