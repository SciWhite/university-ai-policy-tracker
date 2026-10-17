import { analyticsOptedOut } from "./analytics-preference";

export const CLARITY_CONSENT_KEY = "uapt.clarity.consent.v1";
export const CLARITY_PREFERENCE_EVENT = "uapt-clarity-preference";
export const CLARITY_CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
export type ClarityChoice = "granted" | "denied";

export function browserRejectsClarity(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || navigator.doNotTrack === "1";
}

export function clarityChoice(): ClarityChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(CLARITY_CONSENT_KEY) ?? "null");
    if (!saved || !["granted", "denied"].includes(saved.choice) ||
        !Number.isFinite(saved.at) || saved.at > Date.now() ||
        Date.now() - saved.at >= CLARITY_CONSENT_MAX_AGE_MS) return null;
    return saved.choice;
  } catch { return null; }
}

export function clarityAllowed(): boolean {
  return !analyticsOptedOut() && !browserRejectsClarity() && clarityChoice() === "granted";
}

export function setClarityChoice(choice: ClarityChoice) {
  try { window.localStorage.setItem(CLARITY_CONSENT_KEY, JSON.stringify({choice, at: Date.now()})); }
  catch { /* A blocked preference store never grants tracking permission. */ }
  window.dispatchEvent(new Event(CLARITY_PREFERENCE_EVENT));
}
