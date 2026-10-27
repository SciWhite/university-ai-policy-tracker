"use client";

import { useEffect } from "react";

/** The policy itself remains server-rendered; only anchor/print disclosure state is enhanced. */
export function PolicyReferenceInteractions() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".policy-reference");
    if (!root) return;
    const revealHash = () => {
      let id: string;
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      const target = document.getElementById(id);
      if (!target || !root.contains(target)) return;
      if (id === "sources" || id === "record-info") {
        const disclosure = target.querySelector("details");
        if (disclosure) disclosure.open = true;
      }
      for (
        let parent: HTMLElement | null = target;
        parent && root.contains(parent);
        parent = parent.parentElement
      ) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      }
      const popover = target.closest<HTMLElement>("[popover]");
      if (popover && typeof popover.showPopover === "function") {
        const button = document.querySelector<HTMLButtonElement>(
          `[popovertarget="${CSS.escape(popover.id)}"]`,
        );
        if (button && !(popover.dataset.reader && popover.matches(":popover-open"))) {
          const box = button.getBoundingClientRect();
          window.scrollTo({
            top:
              window.scrollY + box.top - (window.innerHeight - box.height) / 2,
          });
        }
        const positionClaim = () =>
          requestAnimationFrame(() => {
            if (target !== popover) {
              const scroller = popover.dataset.reader
                ? popover.querySelector<HTMLElement>(".policy-v6-popoverBody") ?? popover
                : popover;
              scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - (popover.dataset.reader ? 16 : 72);
            }
          });
        // Place the panel first; its toggle handler establishes the final viewport bounds.
        if (popover.matches(":popover-open")) positionClaim();
        else {
          popover.addEventListener("toggle", positionClaim, { once: true });
          popover.showPopover();
        }
        return;
      }
      requestAnimationFrame(() =>
        window.scrollTo({
          top: window.scrollY + target.getBoundingClientRect().top - 96,
        }),
      );
    };
    let pendingHash: number | undefined;
    const queueRevealHash = () => {
      if (pendingHash !== undefined) cancelAnimationFrame(pendingHash);
      pendingHash = requestAnimationFrame(() => {
        pendingHash = requestAnimationFrame(() => {
          pendingHash = undefined;
          revealHash();
        });
      });
    };
    const onClick = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href^="#"]')
          : null;
      if (link && root.contains(link) && link.hash === window.location.hash)
        queueRevealHash();
    };
    // Native find reveals until-found content. Keyboard find also prepares clipped
    // readers for engines whose window.find / find UI does not emit beforematch.
    const readers = () => root.querySelectorAll<HTMLElement>("[data-v6-reading-layout] [data-reader]");
    const revealFind = (target: Node | null) => {
      const element = target instanceof Element ? target : target?.parentElement;
      const reader = element?.closest<HTMLElement>("[data-reader]");
      if (!reader || !root.contains(reader)) return;
      for (let parent = reader.parentElement; parent && root.contains(parent); parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      }
      reader.dataset.readerFindReveal = "true";
      reader.querySelector(".policy-v6-popoverBody")?.removeAttribute("hidden");
      reader.removeAttribute("aria-hidden");
      if (!reader.matches(":popover-open")) reader.showPopover();
    };
    // Let the browser finish fragment/find reveal and its first layout before moving the same subtree
    // into the popover top layer. Synchronous movement can crash Blink during
    // same-document navigation into a closed until-found reader.
    let pendingMatch: number | undefined;
    const queueRevealFind = (target: Node) => {
      if (pendingMatch !== undefined) cancelAnimationFrame(pendingMatch);
      pendingMatch = requestAnimationFrame(() => {
        pendingMatch = requestAnimationFrame(() => {
          pendingMatch = undefined;
          if (target.isConnected) revealFind(target);
        });
      });
    };
    const beforeMatch = (event: Event) => queueRevealFind(event.target as Node);
    const selectionMatch = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.anchorNode) return;
      const node = selection.anchorNode;
      const element = node instanceof Element ? node : node.parentElement;
      // A fragment can also change selection. Only the keyboard-find fallback
      // needs this listener; native matches have their own beforematch event.
      if (element?.closest("[data-reader-search-prepared]")) queueRevealFind(node);
    };
    const restoreFind = () => readers().forEach(reader => {
      if (reader.hasAttribute("data-reader-search-prepared") && !reader.matches(":popover-open")) {
        reader.querySelector(".policy-v6-popoverBody")?.setAttribute("hidden", "until-found");
        reader.removeAttribute("aria-hidden");
        reader.removeAttribute("data-reader-search-prepared");
      }
    });
    const prepareFind = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        readers().forEach(reader => {
          if (!reader.matches(":popover-open")) {
            reader.querySelector(".policy-v6-popoverBody")?.removeAttribute("hidden");
            reader.dataset.readerSearchPrepared = "true";
            reader.setAttribute("aria-hidden", "true");
          }
        });
      } else if ((event.key === "Escape" || event.key === "Tab")) restoreFind();
    };
    let printState: Array<[HTMLDetailsElement, boolean]> = [];
    const beforePrint = () => {
      if (printState.length) return;
      printState = Array.from(root.querySelectorAll("details"), (node) => [
        node,
        node.open,
      ]);
      printState.forEach(([node]) => {
        node.open = true;
      });
    };
    const afterPrint = () => {
      printState.forEach(([node, open]) => {
        node.open = open;
      });
      printState = [];
    };
    root.addEventListener("beforematch", beforeMatch);
    document.addEventListener("selectionchange", selectionMatch);
    document.addEventListener("keydown", prepareFind);
    document.addEventListener("pointerdown", restoreFind);
    queueRevealHash();
    window.addEventListener("hashchange", queueRevealHash);
    root.addEventListener("click", onClick);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      afterPrint();
      root.removeEventListener("beforematch", beforeMatch);
      if (pendingMatch !== undefined) cancelAnimationFrame(pendingMatch);
      document.removeEventListener("selectionchange", selectionMatch);
      document.removeEventListener("keydown", prepareFind);
      document.removeEventListener("pointerdown", restoreFind);
      if (pendingHash !== undefined) cancelAnimationFrame(pendingHash);
      window.removeEventListener("hashchange", queueRevealHash);
      root.removeEventListener("click", onClick);
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);
  return null;
}
