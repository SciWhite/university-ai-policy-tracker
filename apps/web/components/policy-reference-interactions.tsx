"use client";

import { useEffect } from "react";

/** The policy itself remains server-rendered; only anchor/print disclosure state is enhanced. */
export function PolicyReferenceInteractions() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".policy-reference");
    if (!root) return;
    const revealHash = () => {
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      const target = document.getElementById(id);
      if (!target || !root.contains(target)) return;
      if (id === "sources" || id === "record-info") {
        const disclosure = target.querySelector("details");
        if (disclosure) disclosure.open = true;
      }
      for (let parent: HTMLElement | null = target; parent && root.contains(parent); parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      }
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    };
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
      if (link && root.contains(link) && link.hash === window.location.hash) revealHash();
    };
    let printState: Array<[HTMLDetailsElement, boolean]> = [];
    const beforePrint = () => {
      if (printState.length) return;
      printState = Array.from(root.querySelectorAll("details"), node => [node, node.open]);
      printState.forEach(([node]) => { node.open = true; });
    };
    const afterPrint = () => {
      printState.forEach(([node, open]) => { node.open = open; });
      printState = [];
    };
    revealHash();
    window.addEventListener("hashchange", revealHash);
    root.addEventListener("click", onClick);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      afterPrint();
      window.removeEventListener("hashchange", revealHash);
      root.removeEventListener("click", onClick);
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);
  return null;
}
