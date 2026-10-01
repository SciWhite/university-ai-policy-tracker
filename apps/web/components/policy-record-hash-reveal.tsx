"use client";

import { useEffect } from "react";

/** Keeps claim deep links usable when the reviewed record is collapsed. */
export function PolicyRecordHashReveal() {
  useEffect(() => {
    const reveal = (hash: string, reposition: boolean) => {
      if (!hash.startsWith("#claim-")) return;
      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        return;
      }
      const target = document.getElementById(id);
      if (!target) return;
      const parents: HTMLDetailsElement[] = [];
      for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) parents.push(parent);
      }
      parents.reverse().forEach((parent) => { parent.open = true; });
      if (reposition) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - 20 });
        });
      }
    };
    const onHashChange = () => reveal(window.location.hash, true);
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a[href^='#claim-']");
      if (anchor) reveal(anchor.getAttribute("href") ?? "", false);
    };
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
