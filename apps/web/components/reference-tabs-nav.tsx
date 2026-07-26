"use client";

import { useEffect, useState } from "react";

interface ReferenceTabNavItem {
  href: `#${string}`;
  label: string;
  // Sticky-sidebar anchors opt out of the scroll spy: their boxes hover near
  // the viewport top on desktop and would otherwise always win.
  spy?: boolean;
}

interface ReferenceTabsNavProps {
  ariaLabel: string;
  tabs: readonly ReferenceTabNavItem[];
}

// Anchor tabs with a scroll-spy active state. Labels and the aria-label arrive
// pre-localized from the server wrapper so this island stays free of the
// surface-translation dictionaries.
export function ReferenceTabsNav({ ariaLabel, tabs }: ReferenceTabsNavProps) {
  const [activeHref, setActiveHref] = useState<string | null>(null);

  useEffect(() => {
    const targets = tabs
      .filter((tab) => tab.spy !== false)
      .map((tab) => document.getElementById(tab.href.slice(1)))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!targets.length) return;

    const pickActive = () => {
      // The section whose top is closest to (but above) the reading line wins;
      // fall back to the first section before any scrolling happens.
      const readingLine = 120;
      let current = targets[0];
      for (const target of targets) {
        if (target.getBoundingClientRect().top <= readingLine) current = target;
      }
      setActiveHref(`#${current.id}`);
    };

    pickActive();
    const onScroll = () => window.requestAnimationFrame(pickActive);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [tabs]);

  return (
    <nav aria-label={ariaLabel} className="reference-tabs">
      {tabs.map((tab) => (
        <a
          aria-current={activeHref === tab.href ? "location" : undefined}
          href={tab.href}
          key={tab.href}
          onClick={() => setActiveHref(tab.href)}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
