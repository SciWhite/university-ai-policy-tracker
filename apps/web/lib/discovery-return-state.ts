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
  intentKey = "uapt-discovery-return-intent-v2";
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
