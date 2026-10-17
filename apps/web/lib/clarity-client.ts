import { analyticsOptedOut } from "./analytics-preference";
import { clarityAllowed, clearClarityCookies, CLARITY_PREFERENCE_EVENT } from "./clarity-preference";
import { publishedV6Slugs } from "./policy-v6-published-gate";

type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global { interface Window { clarity?: Clarity } }

export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "ye6c4h9822";
let installed = false;

export function isClarityPageEligible(href: string, referrer = ""): boolean {
  try {
    const url = new URL(href);
    const path = decodeURIComponent(url.pathname).replace(/^\/(?:en|zh|fr|pl|es|nl|ms)(?=\/|$)/, "") || "/";
    if (url.search || /^(?:\/(?:internal|api|search|review|contribute|admin|account|auth|login))(?:\/|$)/.test(path)) return false;
    // Referrer URLs can contain the preceding search or authentication query.
    if (referrer && new URL(referrer).search) return false;
    const match = /^\/universities\/([^/]+)\/?$/.exec(path);
    return Boolean(match && publishedV6Slugs.includes(match[1]));
  } catch { return false; }
}

export function installClarity(projectId = CLARITY_PROJECT_ID) {
  if (installed || typeof window === "undefined" || !/^[a-z0-9]+$/.test(projectId)) return;
  if (!["eduaipolicy.org", "www.eduaipolicy.org"].includes(window.location.hostname)) return;
  installed = true;
  let requested = false;
  let stopped = false;
  const eligible = () => isClarityPageEligible(location.href, document.referrer);
  const stop = () => {
    if (requested) {
      window.clarity?.("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" });
      window.clarity?.("stop");
      stopped = true;
    }
    // Privacy pages intentionally have no SDK. Clear cookies there too, and
    // after stopping an existing SDK so its final flush cannot restore them.
    clearClarityCookies();
  };
  const update = () => {
    if (!clarityAllowed() || !eligible()) {
      stop();
      // Removing a script element cannot unload an SDK. Reload after revocation
      // so the next document has no Clarity code or event listeners at all.
      if (requested) location.reload();
      return;
    }
    if (stopped || requested) return;
    requested = true;
    const queue: Clarity = (...args: unknown[]) => { (queue.q ??= []).push(args); };
    window.clarity = queue;
    queue("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    const script = document.createElement("script");
    script.id = "uapt-clarity";
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${projectId}`;
    document.head.appendChild(script);
  };

  // A full document navigation into an excluded surface keeps the loaded SDK
  // out of the destination, including when a Next Link would use soft routing.
  const navigate = (url: URL) => {
    if (!requested || url.origin !== location.origin || isClarityPageEligible(url.href)) return false;
    stop();
    location.assign(url.href);
    return true;
  };
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest?.("a");
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    if (navigate(new URL(anchor.href, location.href))) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function(data: unknown, unused: string, url?: string | URL | null) {
      if (url != null && navigate(new URL(url, location.href))) return;
      return original.call(this, data, unused, url);
    };
  }
  window.addEventListener("popstate", event => {
    if (requested && !eligible()) { stop(); event.stopImmediatePropagation(); location.reload(); }
  }, true);
  window.addEventListener(CLARITY_PREFERENCE_EVENT, update);
  window.addEventListener("uapt-analytics-preference", () => {
    if (analyticsOptedOut()) {
      try { localStorage.removeItem("uapt.clarity.consent.v1"); } catch { /* Effective opt-out still wins. */ }
    }
    update();
  });
  window.addEventListener("storage", update);
  // First-party analytics remain governed by their existing preference.
  update();
}
