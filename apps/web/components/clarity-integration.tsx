"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { analyticsOptedOut } from "@/lib/analytics-preference";
import { browserRejectsClarity, clarityAllowed, clarityChoice, setClarityChoice, CLARITY_PREFERENCE_EVENT } from "@/lib/clarity-preference";
import { CLARITY_PROJECT_ID, installClarity, isClarityPageEligible } from "@/lib/clarity-client";
import { clarityCopy } from "@/lib/clarity-copy";
import { getLocaleFromPathname, withLocalePrefix, type SupportedLocale } from "@/lib/i18n";
import styles from "./clarity-integration.module.css";

function subscribe(update: () => void) {
  const events = [CLARITY_PREFERENCE_EVENT, "uapt-analytics-preference", "storage"];
  events.forEach(name => window.addEventListener(name, update));
  return () => events.forEach(name => window.removeEventListener(name, update));
}
function snapshot() { return `${clarityChoice() ?? "unset"}:${clarityAllowed()}:${analyticsOptedOut()}`; }
function usePreference() { return useSyncExternalStore(subscribe, snapshot, () => "pending"); }

export function ClarityIntegration() {
  const pathname = usePathname();
  const state = usePreference();
  const locale = getLocaleFromPathname(pathname);
  const copy = clarityCopy[locale];
  useEffect(() => {
    installClarity();
    window.dispatchEvent(new Event(CLARITY_PREFERENCE_EVENT));
  }, [pathname]);
  if (!CLARITY_PROJECT_ID || state !== "unset:false:false" || typeof window === "undefined" || !isClarityPageEligible(location.href, document.referrer)) return null;
  if (browserRejectsClarity()) return null;
  return <aside className={styles.banner} aria-label={copy.title} data-clarity-mask="true" data-i18n="preserve">
    <p><strong>{copy.title}</strong> {copy.description} <a href={withLocalePrefix("/privacy", locale)}>{copy.privacy}</a></p>
    <div className={styles.actions}>
      <button className="button button--secondary" type="button" onClick={() => setClarityChoice("granted")}>{copy.accept}</button>
      <button className="button button--secondary" type="button" onClick={() => setClarityChoice("denied")}>{copy.reject}</button>
    </div>
  </aside>;
}

export function ClarityPrivacyControl({ locale }: {locale: SupportedLocale}) {
  const state = usePreference();
  const copy = clarityCopy[locale];
  const enabled = state.split(":")[1] === "true";
  return <div data-clarity-mask="true">
    <button className="button button--secondary" type="button" disabled={state === "pending" || analyticsOptedOut() || browserRejectsClarity()}
      onClick={() => setClarityChoice(enabled ? "denied" : "granted")}>
      {enabled ? copy.disable : copy.enable}
    </button>
    <p role="status">{state === "pending" ? "" : enabled ? copy.on : copy.off}</p>
  </div>;
}
